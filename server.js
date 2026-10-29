const http = require('node:http');

const DEFAULT_PORT = 3000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

let port;
let server;

function resolvePort(rawValue) {
  if (rawValue === undefined || rawValue === '') {
    return DEFAULT_PORT;
  }

  if (!/^[0-9]+$/.test(rawValue)) {
    throw new Error('Invalid PORT value "' + rawValue + '": PORT must be an integer between 1024 and 65535. Unset PORT to use the default 3000.');
  }

  const value = Number(rawValue);
  const shown = Number.isFinite(value) && !String(value).includes('e') ? value : rawValue;

  if (value < MIN_PORT) {
    throw new Error('Port ' + shown + ' is below the minimum: ports 1-1023 are privileged and require elevated access. Set PORT to a value between 1024 and 65535, or unset PORT to use the default 3000.');
  }

  if (value > MAX_PORT) {
    throw new Error('Port ' + shown + ' is above the maximum: PORT must be between 1024 and 65535. Unset PORT to use the default 3000.');
  }

  return value;
}

function requestPath(url) {
  // Route matching consumes the path alone, so the request target is cut at the first '?' and a query string cannot change the route.
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function logRequest(method, path) {
  console.log(new Date().toISOString() + ' ' + method + ' ' + path);
}

function routeRequest(method, path) {
  if (method === 'GET' && path === '/hello') {
    return { statusCode: 200, body: 'Hello world' };
  }

  return { statusCode: 404, body: 'Not Found' };
}

function sendResponse(res, statusCode, body) {
  // The length is set explicitly because Node frames res.end(body) with chunked encoding when it is absent.
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function handleRequest(req, res) {
  const path = requestPath(req.url);
  logRequest(req.method, path);
  const { statusCode, body } = routeRequest(req.method, path);
  sendResponse(res, statusCode, body);
}

function handleServerError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + port + ' is already in use (EADDRINUSE). Stop the process using that port, or set PORT to a free port.');
  } else {
    console.error('Server failed to start on port ' + port + ': ' + err.message);
  }

  process.exit(1);
}

function shutdown() {
  if (!server.listening) {
    return;
  }

  console.log('Shutting down server on port ' + port);

  server.close(() => {
    process.exit(0);
  });

  // Idle keep-alive sockets keep the close callback from firing, so they are released where the API exists (Node.js v18.2.0+).
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
}

function startServer() {
  try {
    port = resolvePort(process.env.PORT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  server = http.createServer(handleRequest);

  // The error listener is registered before listen() so a bind failure arrives as an event instead of an unhandled throw.
  server.on('error', handleServerError);

  server.listen(port, () => {
    console.log('Server listening on port ' + port);
  });

  process.on('SIGINT', shutdown);
}

startServer();
