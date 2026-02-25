/**
 * Test server utilities
 * Helper functions for creating test servers and waiting for readiness
 */

import { createConnection } from 'net';
import { createServer } from 'net';

/**
 * Ask the OS for an available ephemeral port.
 *
 * This avoids flaky collisions from pseudo-random fixed ranges.
 */
export async function getAvailablePort(host = '127.0.0.1'): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();

    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve ephemeral port')));
        return;
      }

      const { port } = address;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
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

/**
 * Wait for HTTP server to be ready to accept connections
 *
 * Uses lightweight TCP connection probes with exponential backoff to ensure
 * the server's kernel-level TCP listener is ready. This prevents ECONNREFUSED
 * errors on slower CI environments where there's a small delay between
 * listen() callback firing and actual connection readiness.
 *
 * Performance: ~1-2ms on local machines (typical), up to ~5s on slow CI
 *
 * @param port - Port number to check
 * @param maxAttempts - Maximum retry attempts (default: 15)
 * @param initialDelayMs - Initial delay between retries (default: 10ms)
 * @returns Promise that resolves when server is ready
 * @throws Error if server not ready after max attempts
 */
export async function waitForHttpServer(
  port: number,
  maxAttempts = 15,
  initialDelayMs = 10
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ port, host: '127.0.0.1' }, () => {
          socket.end();
          resolve();
        });

        socket.on('error', (err) => {
          lastError = err;
          socket.destroy();
          reject(err);
        });

        socket.setTimeout(1000);
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      return; // Success!
    } catch (err) {
      if (attempt < maxAttempts - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await wait(delay);
      }
    }
  }

  throw new Error(
    `Server not ready after ${maxAttempts} attempts. Last error: ${lastError?.message || 'unknown'}`
  );
}
