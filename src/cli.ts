import { Command } from 'commander';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export interface CliOptions {
  wsPort?: number;
  httpPort?: number;
  logLevel?: string;
  logLevelFile?: string;
  verbose?: boolean;
  logFile?: string;
  requestLog?: string;
  responseLog?: string;
}

const validLogLevels = ['debug', 'info', 'warn', 'error'];

/**
 * Parse CLI arguments and return typed options
 */
export function parseCliArgs(): CliOptions {
  const program = new Command();

  program
    .name('remnote-mcp-server')
    .description('MCP server bridge for RemNote knowledge base')
    .version(packageJson.version)
    .option('--ws-port <number>', 'WebSocket port (default: 3002, env: REMNOTE_WS_PORT)', parsePort)
    .option(
      '--http-port <number>',
      'HTTP MCP port (default: 3001, env: REMNOTE_HTTP_PORT)',
      parsePort
    )
    .option(
      '--log-level <level>',
      `Console log level: ${validLogLevels.join(', ')} (default: info)`,
      validateLogLevel
    )
    .option(
      '--log-level-file <level>',
      `File log level (default: same as --log-level)`,
      validateLogLevel
    )
    .option('--verbose', 'Shorthand for --log-level debug')
    .option('--log-file <path>', 'Log to file (default: console only)')
    .option('--request-log <path>', 'Log all WebSocket requests to file (JSON Lines)')
    .option('--response-log <path>', 'Log all WebSocket responses to file (JSON Lines)');

  program.parse();

  const options = program.opts<CliOptions>();

  // Validate port conflicts
  if (options.wsPort && options.httpPort && options.wsPort === options.httpPort) {
    console.error('Error: WebSocket port and HTTP port cannot be the same');
    process.exit(1);
  }

  return options;
}

/**
 * Parse and validate port number
 */
function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${value}. Must be between 1 and 65535.`);
  }
  return port;
}

/**
 * Validate log level string
 */
function validateLogLevel(value: string): string {
  if (!validLogLevels.includes(value.toLowerCase())) {
    throw new Error(`Invalid log level: ${value}. Valid levels: ${validLogLevels.join(', ')}`);
  }
  return value.toLowerCase();
}
