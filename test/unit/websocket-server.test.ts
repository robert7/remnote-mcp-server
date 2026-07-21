/**
 * WebSocketServer unit tests
 * Tests for the WebSocket bridge server implementation
 *
 * Note: These tests use real WebSocketServer instances on OS-assigned available ports
 * to avoid complex mocking issues while still providing good test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HELLO_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  WebSocketServer,
} from '../../src/websocket-server.js';
import { WebSocket } from 'ws';
import { getAvailablePort, wait } from '../helpers/test-server.js';
import { createMockLogger } from '../setup.js';

const TEST_WS_HOST = '127.0.0.1';
const TEST_SERVER_VERSION = '0.5.1';
const TEST_BRIDGE_VERSION = '0.5.0';
const INCOMPATIBLE_BRIDGE_REASON =
  'Wrong/incompatible RemNote plugin installed. Install MCP/OpenClaw Automation Bridge matching server.';
const BRIDGE_REJECTION_LOG_PREFIX = `Rejecting bridge connection: ${INCOMPATIBLE_BRIDGE_REASON}`;
const START_RETRIES = 5;
const RETRY_DELAY_MS = 20;

type MockLogger = ReturnType<typeof createMockLogger>;

function isAddrInUseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

async function createStartedServer({
  mockLogger,
  requestLogger,
  responseLogger,
}: {
  mockLogger: MockLogger;
  requestLogger?: MockLogger;
  responseLogger?: MockLogger;
}): Promise<{ wsServer: WebSocketServer; port: number }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < START_RETRIES; attempt++) {
    const port = await getAvailablePort();
    const wsServer = new WebSocketServer(
      port,
      TEST_WS_HOST,
      mockLogger,
      TEST_SERVER_VERSION,
      requestLogger,
      responseLogger
    );

    try {
      await wsServer.start();
      return { wsServer, port };
    } catch (error) {
      await wsServer.stop();

      if (!isAddrInUseError(error)) {
        throw error;
      }

      lastError = error;
      await wait(RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to start WebSocket test server');
}

async function openWebSocket(port: number): Promise<WebSocket> {
  const client = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });
  return client;
}

async function connectAcceptedClient(
  wsServer: WebSocketServer,
  port: number,
  bridgeVersion = TEST_BRIDGE_VERSION
): Promise<WebSocket> {
  const connectPromise = new Promise<void>((resolve) => {
    wsServer.onClientConnect(() => resolve());
  });
  const client = await openWebSocket(port);
  client.send(JSON.stringify({ type: 'hello', version: bridgeVersion }));
  await connectPromise;
  return client;
}

describe('WebSocketServer - Lifecycle', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    port = await getAvailablePort();
    mockLogger = createMockLogger();
    wsServer = new WebSocketServer(port, TEST_WS_HOST, mockLogger, TEST_SERVER_VERSION);
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

    const duplicateServer = new WebSocketServer(
      port,
      TEST_WS_HOST,
      createMockLogger(),
      TEST_SERVER_VERSION
    );
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
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should report connected after client connects', async () => {
    client = await connectAcceptedClient(wsServer, port);

    expect(wsServer.isConnected()).toBe(true);
  });

  it('should report disconnected after client closes', async () => {
    const disconnectPromise = new Promise<void>((resolve) => {
      wsServer.onClientDisconnect(() => resolve());
    });

    client = await connectAcceptedClient(wsServer, port);

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

    client = await connectAcceptedClient(wsServer, port);

    expect(callbackTriggered).toBe(true);
  });

  it('should trigger onClientDisconnect callback', async () => {
    let callbackTriggered = false;
    wsServer.onClientDisconnect(() => {
      callbackTriggered = true;
    });

    client = await connectAcceptedClient(wsServer, port);

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
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;
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
    client1 = await connectAcceptedClient(wsServer, port);

    expect(wsServer.isConnected()).toBe(true);
  });

  it('should reject second client with code 1008', async () => {
    client1 = await connectAcceptedClient(wsServer, port);

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
    client1 = await connectAcceptedClient(wsServer, port);

    client1.close();
    await wait(100);

    client2 = await connectAcceptedClient(wsServer, port);

    expect(wsServer.isConnected()).toBe(true);
  });
});

describe('WebSocketServer - Request/Response', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;

    client = await connectAcceptedClient(wsServer, port);
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
        const message = JSON.parse(data.toString());
        if (message.id && message.action) {
          resolve(JSON.stringify(message));
        }
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
      if (!request.id || !request.action) {
        return;
      }
      requestId = request.id;
      client.send(JSON.stringify({ id: requestId, result: { data: 'test result' } }));
    });

    const result = await wsServer.sendRequest('test', {});
    expect(result).toEqual({ data: 'test result' });
  });

  it('should reject with response error', async () => {
    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (!request.id || !request.action) {
        return;
      }
      client.send(JSON.stringify({ id: request.id, error: 'Test error message' }));
    });

    await expect(wsServer.sendRequest('test', {})).rejects.toThrow('Test error message');
  });

  it('should handle multiple concurrent requests', async () => {
    const receivedRequests: { id: string; action: string }[] = [];

    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (!request.id || !request.action) {
        return;
      }
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

  it('should timeout request after 15 seconds', async () => {
    // Don't respond to request - let it timeout
    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (!request.id || !request.action) {
        return;
      }
      // Intentionally do nothing
    });

    vi.useFakeTimers();
    try {
      const requestPromise = wsServer.sendRequest('slow', {});
      const expectation = expect(requestPromise).rejects.toThrow('Request timeout');

      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should honor a per-call request timeout', async () => {
    client.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (!request.id || !request.action) {
        return;
      }
    });

    vi.useFakeTimers();
    try {
      const requestPromise = wsServer.sendRequest('slow', {}, 2500);
      const expectation = expect(requestPromise).rejects.toThrow('Request timeout');

      await vi.advanceTimersByTimeAsync(2499);
      await vi.advanceTimersByTimeAsync(1);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reject invalid per-call request timeout values', async () => {
    await expect(wsServer.sendRequest('slow', {}, MAX_REQUEST_TIMEOUT_MS + 1)).rejects.toThrow(
      'Request timeout must be an integer'
    );
  });

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
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;

    client = await connectAcceptedClient(wsServer, port);
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

describe('WebSocketServer - Hello Message', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;

    client = await openWebSocket(port);
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should store bridge version from hello message', async () => {
    expect(wsServer.getBridgeVersion()).toBeNull();

    client.send(JSON.stringify({ type: 'hello', version: '0.5.0' }));
    await wait(100);

    expect(wsServer.getBridgeVersion()).toBe('0.5.0');
  });

  it('should log bridge version on hello', async () => {
    mockLogger.info = vi.fn();

    client.send(JSON.stringify({ type: 'hello', version: '0.5.0' }));
    await wait(100);

    expect(mockLogger.info).toHaveBeenCalledWith({ bridgeVersion: '0.5.0' }, 'Bridge identified');
  });

  it('should reject incompatible version mismatch', async () => {
    mockLogger.warn = vi.fn();

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      client.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    client.send(JSON.stringify({ type: 'hello', version: '0.6.0' }));
    const result = await closePromise;

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining('Version mismatch') }),
      BRIDGE_REJECTION_LOG_PREFIX
    );
    expect(result).toEqual({ code: 1008, reason: INCOMPATIBLE_BRIDGE_REASON });
    expect(wsServer.isConnected()).toBe(false);
  });

  it('should not log warning on compatible versions', async () => {
    mockLogger.warn = vi.fn();

    client.send(JSON.stringify({ type: 'hello', version: '0.5.2' }));
    await wait(100);

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should reject malformed hello versions', async () => {
    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      client.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    client.send(JSON.stringify({ type: 'hello', version: 'not-semver' }));
    const result = await closePromise;

    expect(result).toEqual({ code: 1008, reason: INCOMPATIBLE_BRIDGE_REASON });
    expect(wsServer.isConnected()).toBe(false);
  });

  it(
    'should reject connections that never send hello',
    async () => {
      const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
        client.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      const result = await closePromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${BRIDGE_REJECTION_LOG_PREFIX} Detail: hello timeout.`
      );
      expect(result).toEqual({ code: 1008, reason: INCOMPATIBLE_BRIDGE_REASON });
      expect(wsServer.isConnected()).toBe(false);
    },
    HELLO_TIMEOUT_MS + 1000
  );

  it('should reject requests before compatible hello is accepted', async () => {
    await expect(wsServer.sendRequest('test', {})).rejects.toThrow('RemNote plugin not connected');
  });

  it('should clear bridge version on disconnect', async () => {
    client.send(JSON.stringify({ type: 'hello', version: '0.5.0' }));
    await wait(100);
    expect(wsServer.getBridgeVersion()).toBe('0.5.0');

    client.close();
    await wait(100);
    expect(wsServer.getBridgeVersion()).toBeNull();
  });

  it('should expose server version', () => {
    expect(wsServer.getServerVersion()).toBe('0.5.1');
  });

  it('should announce MCP server identity on connect', async () => {
    const closePromise = new Promise<void>((resolve) => {
      client.once('close', () => resolve());
    });
    client.close();
    await closePromise;

    const messagePromise = new Promise<string>((resolve, reject) => {
      const nextClient = new WebSocket(`ws://localhost:${port}`);
      nextClient.once('message', (data) => resolve(data.toString()));
      nextClient.once('error', reject);
      client = nextClient;
    });

    const initialMessage = await messagePromise;
    expect(JSON.parse(initialMessage)).toEqual({
      type: 'companion_info',
      kind: 'mcp-server',
      version: '0.5.1',
    });
  });
});

describe('WebSocketServer - Error Handling', () => {
  let wsServer: WebSocketServer;
  let port: number;
  let client: WebSocket;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should handle malformed JSON gracefully', async () => {
    client = await connectAcceptedClient(wsServer, port);

    // Send invalid JSON
    client.send('not valid json');
    await wait(100);

    // Connection should still work
    expect(wsServer.isConnected()).toBe(true);
  });

  it('should handle unknown message types', async () => {
    client = await connectAcceptedClient(wsServer, port);

    // Send unknown message type
    client.send(JSON.stringify({ unknown: 'field' }));
    await wait(100);

    // Connection should still work
    expect(wsServer.isConnected()).toBe(true);
  });

  it('should handle response for unknown request ID', async () => {
    client = await connectAcceptedClient(wsServer, port);

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
    mockLogger = createMockLogger();
    const started = await createStartedServer({ mockLogger });
    wsServer = started.wsServer;
    port = started.port;
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
    client = await connectAcceptedClient(wsServer, port);
    mockLogger.info = vi.fn(); // Reset
    client.close();
    await wait(100);
    expect(mockLogger.info).toHaveBeenCalledWith('WebSocket client disconnected');
  });

  it('should log when rejecting multiple connections', async () => {
    client = await connectAcceptedClient(wsServer, port);
    mockLogger.warn = vi.fn(); // Reset

    const client2 = new WebSocket(`ws://localhost:${port}`);
    await wait(100);

    expect(mockLogger.warn).toHaveBeenCalledWith('Rejecting connection: client already connected');
    client2.close();
  });

  it('should log sent requests', async () => {
    client = await connectAcceptedClient(wsServer, port);
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
    client = await connectAcceptedClient(wsServer, port);
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
    client = await connectAcceptedClient(wsServer, port);
    mockLogger.warn = vi.fn(); // Reset

    client.send(JSON.stringify({ id: 'unknown-id', result: 'data' }));
    await wait(100);

    expect(mockLogger.warn).toHaveBeenCalledWith({ id: 'unknown-id' }, 'Unknown request ID');
  });

  it('should log errors', async () => {
    client = await connectAcceptedClient(wsServer, port);
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
    mockLogger = createMockLogger();
    mockRequestLogger = createMockLogger();
    mockResponseLogger = createMockLogger();
    const started = await createStartedServer({
      mockLogger,
      requestLogger: mockRequestLogger,
      responseLogger: mockResponseLogger,
    });
    wsServer = started.wsServer;
    port = started.port;
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    await wsServer.stop();
  });

  it('should log requests when request logger is provided', async () => {
    client = await connectAcceptedClient(wsServer, port);

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
    client = await connectAcceptedClient(wsServer, port);

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
    client = await connectAcceptedClient(wsServer, port);

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
