export {};

process.env.NODE_ENV = 'production';
await import('./scripts/node-server.ts');
