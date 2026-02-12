/**
 * Global test setup file
 * Runs before all test suites
 */

import { beforeEach, afterEach, vi } from 'vitest';
import type { Logger } from '../src/logger.js';

// Mock console methods to prevent pollution of test output
// while still capturing logs for verification
const originalConsoleError = console.error;

beforeEach(() => {
  // Suppress console.error during tests unless explicitly testing logging
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Export utilities for tests that need to verify logging
export const restoreConsoleError = () => {
  console.error = originalConsoleError;
};

/**
 * Create a mock logger for testing
 * Returns a logger with all methods mocked as vi.fn()
 */
export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
    levels: { values: {}, labels: {} },
    bindings: vi.fn(),
    flush: vi.fn(),
    isLevelEnabled: vi.fn().mockReturnValue(true),
    levelVal: 30,
    version: '9.6.0',
    LOG_VERSION: 1,
  } as unknown as Logger;
}
