#!/usr/bin/env node
import { createRequire } from 'module';
import { WebSocketServer } from './websocket-server.js';
import { HttpMcpServer } from './http-server.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const WS_PORT = parseInt(process.env.REMNOTE_WS_PORT || '3002', 10);
const HTTP_PORT = parseInt(process.env.REMNOTE_HTTP_PORT || '3001', 10);

async function main() {
  // Initialize WebSocket server for RemNote plugin
  const wsServer = new WebSocketServer(WS_PORT);

  // Log connection status
  wsServer.onClientConnect(() => {
    console.error('[RemNote Bridge] RemNote plugin connected');
  });

  wsServer.onClientDisconnect(() => {
    console.error('[RemNote Bridge] RemNote plugin disconnected');
  });

  // Start WebSocket server
  await wsServer.start();
  console.error(`[WebSocket Server] Listening on port ${WS_PORT}`);

  // Initialize HTTP MCP server
  const httpServer = new HttpMcpServer(HTTP_PORT, wsServer, {
    name: 'remnote-mcp-server',
    version: packageJson.version,
  });

  await httpServer.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MCP Server] Shutting down...');
    await httpServer.stop();
    await wsServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
