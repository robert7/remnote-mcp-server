import { describe, it, expect, afterEach } from 'vitest';
import { waitForHttpServer } from '../helpers/test-server.js';
import { createServer, Server } from 'http';

describe('waitForHttpServer', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }
  });

  it('should resolve immediately for running server', async () => {
    const port = 3456;
    server = createServer();
    await new Promise<void>((resolve) => {
      server!.listen(port, () => resolve());
    });

    const start = Date.now();
    await waitForHttpServer(port);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50); // Should be very fast
  });

  it('should retry and eventually succeed for delayed server', async () => {
    const port = 3457;

    // Start server after a short delay
    setTimeout(() => {
      server = createServer();
      server.listen(port);
    }, 20);

    await waitForHttpServer(port, 10, 2);
    expect(server).not.toBeNull();
  });

  it('should fail with descriptive error after max attempts', async () => {
    const port = 3458; // No server listening

    await expect(waitForHttpServer(port, 3, 1)).rejects.toThrow(
      /Server not ready after 3 attempts/
    );
  });

  it('should use exponential backoff timing', async () => {
    const port = 3459; // No server
    const start = Date.now();

    try {
      await waitForHttpServer(port, 5, 2);
    } catch {
      // Expected to fail
    }

    const duration = Date.now() - start;
    // 2 + 4 + 8 + 16 = 30ms minimum (exponential delays)
    expect(duration).toBeGreaterThanOrEqual(25);
  });
});
