import { Command } from 'commander';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export interface CliOptions {
  wsPort?: number;
  httpPort?: number;
  httpHost?: string;
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
      '--http-host <host>',
      'HTTP server bind address (default: 127.0.0.1, env: REMNOTE_HTTP_HOST). Use 0.0.0.0 for ngrok/cloud access',
      validateHost
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

/**
 * Validate host string
 */
function validateHost(value: string): string {
  // Allow localhost variations and 0.0.0.0
  if (value === 'localhost' || value === '127.0.0.1' || value === '0.0.0.0') {
    return value;
  }

  // Validate IPv4 format
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Pattern.test(value)) {
    throw new Error(
      `Invalid host: ${value}. Must be localhost, 127.0.0.1, 0.0.0.0, or a valid IPv4 address`
    );
  }

  // Validate each octet is 0-255
  const octets = value.split('.').map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    throw new Error(`Invalid host: ${value}. IPv4 octets must be between 0 and 255`);
  }

  return value;
}
