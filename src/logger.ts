import pino from 'pino';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export type { Logger } from 'pino';

export interface LoggerConfig {
  consoleLevel: string;
  fileLevel?: string;
  filePath?: string;
  pretty?: boolean;
}

/**
 * Create a Pino logger with the specified configuration
 */
export function createLogger(config: LoggerConfig): pino.Logger {
  const targets: pino.TransportTargetOptions[] = [];

  // Console transport with graceful fallback
  if (config.pretty) {
    targets.push({
      level: config.consoleLevel,
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    });
  } else {
    targets.push({
      level: config.consoleLevel,
      target: 'pino/file',
      options: { destination: 2 }, // stderr
    });
  }

  // File transport (if configured)
  if (config.filePath && config.fileLevel) {
    targets.push({
      level: config.fileLevel,
      target: 'pino/file',
      options: { destination: config.filePath, mkdir: true },
    });
  }

  // Wrap initialization to handle transport errors
  try {
    return pino({
      level: getMinLevel(config.consoleLevel, config.fileLevel),
      transport: {
        targets,
      },
    });
  } catch (error) {
    // Fall back to basic JSON logger if transport fails
    const message = error instanceof Error ? error.message : String(error);

    // Only warn if pretty was requested (otherwise it's expected behavior)
    if (config.pretty) {
      console.error('[Logger] pino-pretty not available, falling back to JSON logging:', message);
    }

    // Create fallback logger with JSON output to stderr
    const fallbackTargets: pino.TransportTargetOptions[] = [
      {
        level: config.consoleLevel,
        target: 'pino/file',
        options: { destination: 2 }, // stderr
      },
    ];

    // Add file transport if configured
    if (config.filePath && config.fileLevel) {
      fallbackTargets.push({
        level: config.fileLevel,
        target: 'pino/file',
        options: { destination: config.filePath, mkdir: true },
      });
    }

    return pino({
      level: getMinLevel(config.consoleLevel, config.fileLevel),
      transport: {
        targets: fallbackTargets,
      },
    });
  }
}

/**
 * Create a logger for request/response logging (JSON Lines format)
 */
export function createRequestResponseLogger(filePath: string): pino.Logger {
  return pino(
    {
      level: 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.destination({ dest: filePath, mkdir: true })
  );
}

/**
 * Ensure directory exists for log file
 */
export async function ensureLogDirectory(filePath: string): Promise<void> {
  try {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create log directory for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get minimum log level between console and file
 */
function getMinLevel(consoleLevel: string, fileLevel?: string): string {
  const levels: Record<string, number> = {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
  };

  const consoleLevelNum = levels[consoleLevel] || 30;
  const fileLevelNum = fileLevel ? levels[fileLevel] || 30 : Infinity;

  const minLevelNum = Math.min(consoleLevelNum, fileLevelNum);

  // Return level name for minimum level number
  for (const [name, num] of Object.entries(levels)) {
    if (num === minLevelNum) {
      return name;
    }
  }

  return 'info';
}
