/**
 * WebSocketServer unit tests
 * Tests for the WebSocket bridge server implementation
 *
 * Note: These tests use real WebSocketServer instances on random ports
 * to avoid complex mocking issues while still providing good test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from '../../src/websocket-server.js';
import { WebSocket } from 'ws';
import { getRandomPort, wait } from '../helpers/test-server.js';
import { createMockLogger } from '../setup.js';

describe('WebSocketServer - Lifecycle', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
  });

  afterEach(async () => {
    await wsServer.stop();
  });

  it('should start server successfully', async () => {
    await expect(wsServer.start()).resolves.toBeUndefined();
  });

  it('should stop server successfully', async () => {
    await wsServer.start();
    await expect(wsServer.stop()).resolves.toBeUndefined();
  });

  it('should handle stop when server not started', async () => {
    await expect(wsServer.stop()).resolves.toBeUndefined();
  });

  it('should handle multiple stop calls', async () => {
    await wsServer.start();
    await wsServer.stop();
    await expect(wsServer.stop()).resolves.toBeUndefined();
  });

  it('should not be connected initially', () => {
    expect(wsServer.isConnected()).toBe(false);
  });

  it('should reject when port is already in use', async () => {
    await wsServer.start();

    const duplicateServer = new WebSocketServer(port, '127.0.0.1', createMockLogger());
    await expect(duplicateServer.start()).rejects.toThrow();
    await duplicateServer.stop();
  });
});

describe('WebSocketServer - Connection State', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should report connected after client connects', async () => {
    const connectPromise = new Promise<void>((resolve) => {
      wsServer.onClientConnect(() => resolve());
    });

    client = new WebSocket(`ws://localhost:${port}`);
    await connectPromise;

    expect(wsServer.isConnected()).toBe(true);
  });

  it('should report disconnected after client closes', async () => {
    const disconnectPromise = new Promise<void>((resolve) => {
      wsServer.onClientDisconnect(() => resolve());
    });

    client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    client.close();
    await disconnectPromise;

    expect(wsServer.isConnected()).toBe(false);
  });

  it('should throw when sending request without connection', async () => {
    await expect(wsServer.sendRequest('test', {})).rejects.toThrow('RemNote plugin not connected');
  });

  it('should trigger onClientConnect callback', async () => {
    let callbackTriggered = false;
    wsServer.onClientConnect(() => {
      callbackTriggered = true;
    });

    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    expect(callbackTriggered).toBe(true);
  });

  it('should trigger onClientDisconnect callback', async () => {
    let callbackTriggered = false;
    wsServer.onClientDisconnect(() => {
      callbackTriggered = true;
    });

    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    client.close();
    await wait(100);

    expect(callbackTriggered).toBe(true);
  });
});

describe('WebSocketServer - Single Client Model', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client1: WebSocket;
  let client2: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();
  });

  afterEach(async () => {
    if (client1 && client1.readyState === WebSocket.OPEN) {
      client1.close();
    }
    if (client2 && client2.readyState === WebSocket.OPEN) {
      client2.close();
    }
    await wsServer.stop();
  });

  it('should accept first client connection', async () => {
    client1 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    expect(wsServer.isConnected()).toBe(true);
  });

  it('should reject second client with code 1008', async () => {
    client1 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      client2 = new WebSocket(`ws://localhost:${port}`);
      client2.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const result = await closePromise;
    expect(result.code).toBe(1008);
    expect(result.reason).toBe('Only one client allowed');
  });

  it('should allow new connection after first client disconnects', async () => {
    client1 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    client1.close();
    await wait(100);

    client2 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    expect(wsServer.isConnected()).toBe(true);
  });
});

describe('WebSocketServer - Request/Response', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();

    client = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      wsServer.onClientConnect(() => resolve());
    });
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should send request with correct format', async () => {
    const messagePromise = new Promise<string>((resolve) => {
      client.on('message', (data) => {
        resolve(data.toString());
      });
    });

    const requestPromise = wsServer.sendRequest('test_action', { foo: 'bar' });

    const message = await messagePromise;
    const parsed = JSON.parse(message);

    expect(parsed).toHaveProperty('id');
    expect(parsed.action).toBe('test_action');
    expect(parsed.payload).toEqual({ foo: 'bar' });

    // Clean up - respond to request
    client.send(JSON.stringify({ id: parsed.id, result: 'ok' }));
    await requestPromise;
  });

  it('should resolve with response result', async () => {
    let requestId: string;

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      requestId = request.id;
      client.send(JSON.stringify({ id: requestId, result: { data: 'test result' } }));
    });

    const result = await wsServer.sendRequest('test', {});
    expect(result).toEqual({ data: 'test result' });
  });

  it('should reject with response error', async () => {
    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, error: 'Test error message' }));
    });

    await expect(wsServer.sendRequest('test', {})).rejects.toThrow('Test error message');
  });

  it('should handle multiple concurrent requests', async () => {
    const receivedRequests: { id: string; action: string }[] = [];

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      receivedRequests.push({ id: request.id, action: request.action });

      // Respond immediately
      client.send(JSON.stringify({ id: request.id, result: `result-${request.action}` }));
    });

    const [result1, result2, result3] = await Promise.all([
      wsServer.sendRequest('action1', {}),
      wsServer.sendRequest('action2', {}),
      wsServer.sendRequest('action3', {}),
    ]);

    expect(result1).toBe('result-action1');
    expect(result2).toBe('result-action2');
    expect(result3).toBe('result-action3');
    expect(receivedRequests).toHaveLength(3);
  });

  it('should timeout request after 5 seconds', async () => {
    // Don't respond to request - let it timeout
    client.on('message', () => {
      // Intentionally do nothing
    });

    const startTime = Date.now();
    await expect(wsServer.sendRequest('slow', {})).rejects.toThrow('Request timeout');
    const elapsed = Date.now() - startTime;

    // Should timeout around 5000ms (allow some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(4900);
    expect(elapsed).toBeLessThan(5500);
  }, 10000);

  it('should reject pending requests on disconnect', async () => {
    // Set up error handlers before making requests
    const request1 = wsServer.sendRequest('action1', {}).catch((e) => e);
    const request2 = wsServer.sendRequest('action2', {}).catch((e) => e);

    await wait(100);

    // Close connection without responding
    client.close();
    await wait(100);

    const result1 = await request1;
    const result2 = await request2;

    expect(result1).toBeInstanceOf(Error);
    expect(result1.message).toContain('Connection lost');
    expect(result2).toBeInstanceOf(Error);
    expect(result2.message).toContain('Connection lost');
  });
});

describe('WebSocketServer - Heartbeat Protocol', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();

    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should respond to ping with pong', async () => {
    const pongPromise = new Promise<void>((resolve) => {
      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          resolve();
        }
      });
    });

    client.send(JSON.stringify({ type: 'ping' }));

    await expect(pongPromise).resolves.toBeUndefined();
  });

  it('should handle pong messages without error', async () => {
    // Send pong (shouldn't cause errors)
    client.send(JSON.stringify({ type: 'pong' }));
    await wait(100);

    // Connection should still be alive
    expect(wsServer.isConnected()).toBe(true);
  });
});

describe('WebSocketServer - Error Handling', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should handle malformed JSON gracefully', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    // Send invalid JSON
    client.send('not valid json');
    await wait(100);

    // Connection should still work
    expect(wsServer.isConnected()).toBe(true);
  });

  it('should handle unknown message types', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    // Send unknown message type
    client.send(JSON.stringify({ unknown: 'field' }));
    await wait(100);

    // Connection should still work
    expect(wsServer.isConnected()).toBe(true);
  });

  it('should handle response for unknown request ID', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    // Send response for non-existent request
    client.send(JSON.stringify({ id: 'nonexistent-id', result: 'data' }));
    await wait(100);

    // Connection should still work
    expect(wsServer.isConnected()).toBe(true);
  });
});

describe('WebSocketServer - Logging', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, '127.0.0.1', mockLogger);
    await wsServer.start();
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should create child logger with context', () => {
    expect(mockLogger.child).toHaveBeenCalledWith({ context: 'websocket-server' });
  });

  it('should log server start', () => {
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { port, host: '127.0.0.1' },
      'WebSocket server started'
    );
  });

  it('should log server stop', async () => {
    mockLogger.debug = vi.fn(); // Reset
    await wsServer.stop();
    expect(mockLogger.debug).toHaveBeenCalledWith('WebSocket server stopped');
  });

  it('should log client connection', async () => {
    mockLogger.info = vi.fn(); // Reset
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    expect(mockLogger.info).toHaveBeenCalledWith('WebSocket client connected');
  });

  it('should log client disconnection', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.info = vi.fn(); // Reset
    client.close();
    await wait(100);
    expect(mockLogger.info).toHaveBeenCalledWith('WebSocket client disconnected');
  });

  it('should log when rejecting multiple connections', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.warn = vi.fn(); // Reset

    const client2 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    expect(mockLogger.warn).toHaveBeenCalledWith('Rejecting connection: client already connected');
    client2.close();
  });

  it('should log sent requests', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.debug = vi.fn(); // Reset

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, result: 'ok' }));
    });

    await wsServer.sendRequest('test_action', { foo: 'bar' });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'test_action' }),
      'Sending request'
    );
  });

  it('should log received messages', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.debug = vi.fn(); // Reset

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, result: 'ok' }));
    });

    await wsServer.sendRequest('test', {});

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'response' }),
      'Received message'
    );
  });

  it('should log warning for unknown request ID', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.warn = vi.fn(); // Reset

    client.send(JSON.stringify({ id: 'unknown-id', result: 'data' }));
    await wait(100);

    expect(mockLogger.warn).toHaveBeenCalledWith({ id: 'unknown-id' }, 'Unknown request ID');
  });

  it('should log errors', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);
    mockLogger.error = vi.fn(); // Reset

    client.send('invalid json');
    await wait(100);

    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('WebSocketServer - Request/Response Logging', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockRequestLogger: ReturnType<typeof createMockLogger>;
  let mockResponseLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = getRandomPort();
    mockLogger = createMockLogger();
    mockRequestLogger = createMockLogger();
    mockResponseLogger = createMockLogger();
    wsServer = new WebSocketServer(
      port,
      '127.0.0.1',
      mockLogger,
      mockRequestLogger,
      mockResponseLogger
    );
    await wsServer.start();
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should log requests when request logger is provided', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, result: 'ok' }));
    });

    await wsServer.sendRequest('test_action', { foo: 'bar' });

    expect(mockRequestLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request',
        action: 'test_action',
        payload: { foo: 'bar' },
      })
    );
  });

  it('should log responses when response logger is provided', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, result: 'ok' }));
    });

    await wsServer.sendRequest('test_action', {});

    expect(mockResponseLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        duration_ms: expect.any(Number),
        error: null,
      })
    );
  });

  it('should log error responses', async () => {
    client = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: request.id, error: 'Test error' }));
    });

    await wsServer.sendRequest('test_action', {}).catch(() => {
      // Ignore error
    });

    expect(mockResponseLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        error: 'Test error',
      })
    );
  });
});
