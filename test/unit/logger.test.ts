import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, createRequestResponseLogger, ensureLogDirectory } from '../../src/logger.js';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type pino from 'pino';

const TEST_LOG_DIR = join(process.cwd(), 'test-logs');

// Type for pino destination with flush capability
interface FlushableDestination {
  flush?: (cb: () => void) => void;
}

describe('Logger', () => {
  let testLogger: pino.Logger | null = null;

  beforeEach(async () => {
    // Clean up test logs directory
    if (existsSync(TEST_LOG_DIR)) {
      await rm(TEST_LOG_DIR, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Flush and close any open logger streams
    if (testLogger) {
      await new Promise<void>((resolve) => {
        // Access the internal stream via pino symbols
        // This is necessary to properly flush file streams before cleanup
        const streamSymbol = Object.getOwnPropertySymbols(testLogger as object).find(
          (s) => s.toString() === 'Symbol(pino.stream)'
        );

        const dest = streamSymbol
          ? ((testLogger as unknown as Record<symbol, unknown>)[
              streamSymbol
            ] as FlushableDestination)
          : null;

        if (dest && typeof dest.flush === 'function') {
          dest.flush(() => {
            testLogger = null;
            resolve();
          });
        } else {
          testLogger = null;
          resolve();
        }
      });
    }

    // Clean up test logs directory
    if (existsSync(TEST_LOG_DIR)) {
      await rm(TEST_LOG_DIR, { recursive: true, force: true });
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

    it('should create logger with file output', () => {
      const logger = createLogger({
        consoleLevel: 'info',
        fileLevel: 'debug',
        filePath: join(TEST_LOG_DIR, 'test.log'),
        pretty: false,
      });

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
      await mkdir(TEST_LOG_DIR, { recursive: true });
      const filePath = join(TEST_LOG_DIR, 'request.jsonl');
      testLogger = createRequestResponseLogger(filePath);

      expect(testLogger).toBeDefined();
      expect(testLogger.info).toBeDefined();
    });

    it('should log in JSON Lines format', async () => {
      await mkdir(TEST_LOG_DIR, { recursive: true });
      const filePath = join(TEST_LOG_DIR, 'request.jsonl');
      testLogger = createRequestResponseLogger(filePath);

      testLogger.info({ type: 'request', id: 'test-123', action: 'search' });

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify file exists
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('ensureLogDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const logPath = join(TEST_LOG_DIR, 'subdir', 'test.log');

      await ensureLogDirectory(logPath);

      // Verify directory was created
      expect(existsSync(join(TEST_LOG_DIR, 'subdir'))).toBe(true);
    });

    it('should not error if directory already exists', async () => {
      const logPath = join(TEST_LOG_DIR, 'test.log');

      await mkdir(TEST_LOG_DIR, { recursive: true });
      await ensureLogDirectory(logPath);

      // Should not throw
      expect(existsSync(TEST_LOG_DIR)).toBe(true);
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
    it('should use minimum log level when file is more verbose', () => {
      const logger = createLogger({
        consoleLevel: 'info',
        fileLevel: 'debug',
        filePath: join(TEST_LOG_DIR, 'test.log'),
        pretty: false,
      });

      // Should use debug as minimum level
      expect(logger.level).toBe('debug');
    });

    it('should use minimum log level when console is more verbose', () => {
      const logger = createLogger({
        consoleLevel: 'debug',
        fileLevel: 'warn',
        filePath: join(TEST_LOG_DIR, 'test.log'),
        pretty: false,
      });

      // Should use debug as minimum level
      expect(logger.level).toBe('debug');
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
