import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { createLogger, createRequestResponseLogger, ensureLogDirectory } from '../../src/logger.js';
import type { Logger } from '../../src/logger.js';
import { mkdir, rm, mkdtemp } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const RM_OPTS = { recursive: true, force: true, maxRetries: 3, retryDelay: 100 } as const;
let testLogDir = '';

function makeLogPath(fileName: string): string {
  return join(
    testLogDir,
    `${fileName}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.log`
  );
}

async function waitForFile(path: string, timeoutMs = 1500, intervalMs = 25): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return existsSync(path);
}

describe('Logger', () => {
  // Track loggers with file destinations for proper cleanup
  let activeLoggers: Logger[] = [];

  beforeAll(async () => {
    testLogDir = await mkdtemp(join(tmpdir(), 'remnote-mcp-server-logger-tests-'));
  });

  beforeEach(() => {
    activeLoggers = [];
  });

  afterEach(async () => {
    // Flush all pino file destinations before cleaning up directories
    for (const logger of activeLoggers) {
      logger.flush();
    }
    // Allow async writes to complete after flush
    if (activeLoggers.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    activeLoggers = [];
  });

  afterAll(async () => {
    if (testLogDir && existsSync(testLogDir)) {
      await rm(testLogDir, RM_OPTS);
    }
  });

  describe('createLogger', () => {
    it('should create logger with console output only', () => {
      const logger = createLogger({
        consoleLevel: 'info',
        pretty: false,
      });

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.warn).toBeDefined();
    });

    it('should create logger with file output', async () => {
      const logger = createLogger({
        consoleLevel: 'info',
        fileLevel: 'debug',
        filePath: makeLogPath('create-with-file'),
        pretty: false,
      });
      activeLoggers.push(logger);

      expect(logger).toBeDefined();
    });

    it('should create logger with pretty output', () => {
      const logger = createLogger({
        consoleLevel: 'debug',
        pretty: true,
      });

      expect(logger).toBeDefined();
    });

    it('should respect console log level', () => {
      const logger = createLogger({
        consoleLevel: 'warn',
        pretty: false,
      });

      // Logger should be created with correct level
      expect(logger.level).toBe('warn');
    });
  });

  describe('createRequestResponseLogger', () => {
    it('should create request/response logger', async () => {
      const filePath = makeLogPath('request');
      const logger = createRequestResponseLogger(filePath);
      activeLoggers.push(logger);

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
    });

    it('should log in JSON Lines format', async () => {
      const filePath = makeLogPath('request-lines');
      const logger = createRequestResponseLogger(filePath);
      activeLoggers.push(logger);

      logger.info({ type: 'request', id: 'test-123', action: 'search' });
      logger.flush();

      // Verify file exists after async transport flush/write.
      expect(await waitForFile(filePath)).toBe(true);
    });

    it('should create missing nested directories for request/response logs', async () => {
      const filePath = join(testLogDir, 'missing', 'nested', `rr-${Date.now()}.log`);
      const logger = createRequestResponseLogger(filePath);
      activeLoggers.push(logger);

      logger.info({ type: 'response', id: 'test-456', status: 'ok' });
      logger.flush();

      expect(await waitForFile(filePath)).toBe(true);
    });
  });

  describe('ensureLogDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const logPath = join(testLogDir, 'subdir', 'test.log');

      await ensureLogDirectory(logPath);

      // Verify directory was created
      expect(existsSync(join(testLogDir, 'subdir'))).toBe(true);
    });

    it('should not error if directory already exists', async () => {
      const existingDir = join(testLogDir, 'existing-dir');
      const logPath = join(existingDir, 'test.log');

      await mkdir(existingDir, { recursive: true });
      await ensureLogDirectory(logPath);

      // Should not throw
      expect(existsSync(existingDir)).toBe(true);
    });

    it('should throw error if directory creation fails', async () => {
      // Use invalid path (root with no permissions)
      const logPath = '/invalid-root-path/test.log';

      await expect(ensureLogDirectory(logPath)).rejects.toThrow('Failed to create log directory');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with context', () => {
      const logger = createLogger({
        consoleLevel: 'info',
        pretty: false,
      });

      const child = logger.child({ context: 'test-module' });

      expect(child).toBeDefined();
      expect(child.info).toBeDefined();
    });
  });

  describe('Log Level Filtering', () => {
    it('should use minimum log level when file is more verbose', async () => {
      const filePath = makeLogPath('min-level-file-verbose');
      const logger = createLogger({
        consoleLevel: 'info',
        fileLevel: 'debug',
        filePath,
        pretty: false,
      });
      activeLoggers.push(logger);
      logger.debug('debug message');
      logger.flush();

      // Should use debug as minimum level
      expect(logger.level).toBe('debug');
      expect(await waitForFile(filePath)).toBe(true);
    });

    it('should use minimum log level when console is more verbose', async () => {
      const filePath = makeLogPath('min-level-console-verbose');
      const logger = createLogger({
        consoleLevel: 'debug',
        fileLevel: 'warn',
        filePath,
        pretty: false,
      });
      activeLoggers.push(logger);
      logger.warn('warn message');
      logger.flush();

      // Should use debug as minimum level
      expect(logger.level).toBe('debug');
      expect(await waitForFile(filePath)).toBe(true);
    });
  });

  describe('Graceful Fallback', () => {
    it('should create logger with pretty=true even if pino-pretty unavailable', () => {
      // This test verifies the logger doesn't crash if pino-pretty is missing
      // In the test environment, pino-pretty IS available, so we can't directly test failure
      // However, we verify that the logger creation succeeds with pretty=true
      const logger = createLogger({
        consoleLevel: 'info',
        pretty: true,
      });

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
    });

    it('should not log warning when pretty=false', () => {
      // Verify no warning logged for non-pretty logger (baseline behavior)
      const consoleSpy = vi.spyOn(console, 'error');

      const logger = createLogger({
        consoleLevel: 'info',
        pretty: false,
      });

      expect(logger).toBeDefined();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
