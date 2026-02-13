import type { CliOptions } from './cli.js';

export interface ServerConfig {
  wsPort: number;
  wsHost: string;
  httpPort: number;
  httpHost: string;
  logLevel: string;
  logLevelFile?: string;
  logFile?: string;
  requestLog?: string;
  responseLog?: string;
  prettyLogs: boolean;
}

/**
 * Merge CLI options with environment variables and apply defaults
 * Precedence: CLI > Environment Variables > Defaults
 */
export function getConfig(cliOptions: CliOptions): ServerConfig {
  // Apply verbose flag override
  let logLevel = cliOptions.logLevel || 'info';
  if (cliOptions.verbose) {
    logLevel = 'debug';
  }

  // Validate CLI port ranges before merging
  if (cliOptions.wsPort !== undefined && (cliOptions.wsPort < 1 || cliOptions.wsPort > 65535)) {
    throw new Error(`Invalid WebSocket port: ${cliOptions.wsPort}. Must be between 1 and 65535.`);
  }
  if (
    cliOptions.httpPort !== undefined &&
    (cliOptions.httpPort < 1 || cliOptions.httpPort > 65535)
  ) {
    throw new Error(`Invalid HTTP port: ${cliOptions.httpPort}. Must be between 1 and 65535.`);
  }

  // Get ports with CLI > env > default precedence
  const wsPort = cliOptions.wsPort || parseInt(process.env.REMNOTE_WS_PORT || '3002', 10);
  const httpPort = cliOptions.httpPort || parseInt(process.env.REMNOTE_HTTP_PORT || '3001', 10);

  // Get hosts with CLI > env > default precedence
  // SECURITY: WebSocket ALWAYS binds to localhost, regardless of env var or CLI option
  const wsHost = '127.0.0.1';
  const httpHost = cliOptions.httpHost || process.env.REMNOTE_HTTP_HOST || '127.0.0.1';

  // Validate port conflicts
  if (wsPort === httpPort) {
    throw new Error(`WebSocket port and HTTP port cannot be the same (both set to ${wsPort})`);
  }

  // File log level defaults to console log level if not specified
  const logLevelFile = cliOptions.logLevelFile || (cliOptions.logFile ? logLevel : undefined);

  // Pretty logs in development (when using pino-pretty)
  const prettyLogs = process.stdout.isTTY === true;

  return {
    wsPort,
    wsHost,
    httpPort,
    httpHost,
    logLevel,
    logLevelFile,
    logFile: cliOptions.logFile,
    requestLog: cliOptions.requestLog,
    responseLog: cliOptions.responseLog,
    prettyLogs,
  };
}
