// The unauthenticated file editor is reachable only on this computer.
process.env.BIND_HOST = '127.0.0.1';
process.env.PORT = '8081';
await import('decap-server');
