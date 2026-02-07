/**
 * Global test setup file
 * Runs before all test suites
 */

import { beforeEach, afterEach, vi } from 'vitest';

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
