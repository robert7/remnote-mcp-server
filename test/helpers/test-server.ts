/**
 * Test server utilities
 * Helper functions for creating test WebSocket servers on random ports
 */

/**
 * Get a random port between 3000 and 4000 for testing
 */
export function getRandomPort(): number {
  return Math.floor(Math.random() * 1000) + 3000;
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a timeout
 */
export function timeoutPromise<T>(ms: number, message = 'Timeout'): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Race a promise against a timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  return Promise.race([promise, timeoutPromise<T>(ms, message)]);
}
