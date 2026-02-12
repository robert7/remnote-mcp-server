#!/usr/bin/env node
import { createRequire } from 'module';
import { WebSocketServer } from './websocket-server.js';
import { HttpMcpServer } from './http-server.js';
import { parseCliArgs } from './cli.js';
import { getConfig } from './config.js';
import { createLogger, ensureLogDirectory, createRequestResponseLogger } from './logger.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

async function main() {
  // Parse CLI arguments and merge with environment variables
  const cliOptions = parseCliArgs();
  const config = getConfig(cliOptions);

  // Ensure log directories exist
  if (config.logFile) {
    await ensureLogDirectory(config.logFile);
  }
  if (config.requestLog) {
    await ensureLogDirectory(config.requestLog);
  }
  if (config.responseLog) {
    await ensureLogDirectory(config.responseLog);
  }

  // Create logger
  const logger = createLogger({
    consoleLevel: config.logLevel,
    fileLevel: config.logLevelFile,
    filePath: config.logFile,
    pretty: config.prettyLogs,
  });

  // Create request/response loggers if configured
  const requestLogger = config.requestLog
    ? createRequestResponseLogger(config.requestLog)
    : undefined;
  const responseLogger = config.responseLog
    ? createRequestResponseLogger(config.responseLog)
    : undefined;

  // Initialize WebSocket server for RemNote plugin
  const wsServer = new WebSocketServer(config.wsPort, logger, requestLogger, responseLogger);

  // Log connection status
  wsServer.onClientConnect(() => {
    logger.info('RemNote plugin connected');
  });

  wsServer.onClientDisconnect(() => {
    logger.info('RemNote plugin disconnected');
  });

  // Start WebSocket server
  await wsServer.start();

  // Initialize HTTP MCP server
  const httpServer = new HttpMcpServer(
    config.httpPort,
    wsServer,
    {
      name: 'remnote-mcp-server',
      version: packageJson.version,
    },
    logger
  );

  await httpServer.start();

  // Log startup message
  logger.info(
    {
      wsPort: config.wsPort,
      httpPort: config.httpPort,
    },
    `RemNote MCP Server v${packageJson.version} listening`
  );

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down');
    await httpServer.stop();
    await wsServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  // Pre-logger error handling
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
