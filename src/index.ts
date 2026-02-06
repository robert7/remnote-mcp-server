#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from './websocket-server.js';
import { registerAllTools } from './tools/index.js';

const WS_PORT = parseInt(process.env.REMNOTE_WS_PORT || '3002', 10);

async function main() {
  // Initialize MCP server
  const mcpServer = new Server(
    {
      name: 'remnote-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Initialize WebSocket server for RemNote plugin
  const wsServer = new WebSocketServer(WS_PORT);

  // Log connection status to stderr (stdio reserved for MCP)
  wsServer.onClientConnect(() => {
    console.error('[RemNote Bridge] RemNote plugin connected');
  });

  wsServer.onClientDisconnect(() => {
    console.error('[RemNote Bridge] RemNote plugin disconnected');
  });

  // Start WebSocket server
  await wsServer.start();
  console.error(`[WebSocket Server] Listening on port ${WS_PORT}`);

  // Register all RemNote MCP tools
  registerAllTools(mcpServer, wsServer);

  // Set up stdio transport for MCP
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error('[MCP Server] Server started on stdio');

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[MCP Server] Shutting down...');
    await wsServer.stop();
    await mcpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
