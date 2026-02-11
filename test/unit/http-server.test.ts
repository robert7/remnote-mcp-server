import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpMcpServer } from '../../src/http-server.js';
import { WebSocketServer } from '../../src/websocket-server.js';

// Mock WebSocketServer
vi.mock('../../src/websocket-server.js', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sendRequest: vi.fn().mockResolvedValue({ status: 'ok' }),
    isConnected: vi.fn().mockReturnValue(true),
    onClientConnect: vi.fn(),
    onClientDisconnect: vi.fn(),
  })),
}));

describe('HttpMcpServer', () => {
  let httpServer: HttpMcpServer;
  let mockWsServer: WebSocketServer;
  let port: number;

  beforeEach(() => {
    // Use random port to avoid conflicts
    port = 30000 + Math.floor(Math.random() * 10000);
    mockWsServer = new WebSocketServer(3002);

    httpServer = new HttpMcpServer(port, mockWsServer, {
      name: 'test-server',
      version: '1.0.0',
    });
  });

  afterEach(async () => {
    await httpServer.stop();
  });

  describe('Server Lifecycle', () => {
    it('should start and bind to specified port', async () => {
      await httpServer.start();

      // Verify server is listening by making a request
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      expect(response.status).toBe(200);
    });

    it('should stop and unbind from port', async () => {
      await httpServer.start();
      await httpServer.stop();

      // Verify server is no longer listening
      await expect(
        fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({}),
        })
      ).rejects.toThrow();
    });
  });

  describe('Session Initialization', () => {
    it('should initialize new session and return session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      expect(response.status).toBe(200);

      // Should have session ID header
      const sessionId = response.headers.get('mcp-session-id');
      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');

      // Should increment active session count
      expect(httpServer.getActiveSessionCount()).toBe(1);
    });

    it('should handle multiple concurrent session initializations', async () => {
      await httpServer.start();

      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      // Initialize 3 sessions concurrently
      const responses = await Promise.all([
        fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify(initRequest),
        }),
        fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify(initRequest),
        }),
        fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify(initRequest),
        }),
      ]);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should have 3 unique session IDs
      const sessionIds = responses.map((r) => r.headers.get('mcp-session-id'));
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(3);
      expect(httpServer.getActiveSessionCount()).toBe(3);
    });
  });

  describe('Session Requests', () => {
    it('should handle requests with valid session ID', async () => {
      await httpServer.start();

      // Initialize session
      const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      const sessionId = initResponse.headers.get('mcp-session-id')!;

      // Make request with session ID
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBe(sessionId);
    });

    it('should reject request with invalid session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': 'invalid-session-id',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Invalid session ID');
    });

    it('should reject non-initialize request without session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Missing mcp-session-id header');
    });
  });

  describe('Session Termination', () => {
    it('should terminate session via DELETE request', async () => {
      await httpServer.start();

      // Initialize session
      const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      const sessionId = initResponse.headers.get('mcp-session-id')!;
      expect(httpServer.getActiveSessionCount()).toBe(1);

      // Terminate session
      const deleteResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId,
        },
      });

      expect(deleteResponse.status).toBe(200);
      // SDK's handleRequest for DELETE returns empty body
      expect(httpServer.getActiveSessionCount()).toBe(0);
    });

    it('should return 404 when terminating non-existent session', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': 'non-existent-session',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Session not found');
    });

    it('should return 400 when DELETE missing session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json, text/event-stream',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing mcp-session-id header');
    });
  });

  describe('SSE Stream (GET)', () => {
    it('should return SSE stream with valid session ID', async () => {
      await httpServer.start();

      // Initialize session
      const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      const sessionId = initResponse.headers.get('mcp-session-id')!;

      // Request SSE stream (don't await - it's a long-lived connection)
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toContain('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
    });

    it('should return 404 for GET with invalid session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': 'invalid-session',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Session not found');
    });

    it('should return 400 for GET without session ID', async () => {
      await httpServer.start();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/event-stream',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing mcp-session-id header');
    });
  });

  describe('Session Management', () => {
    it('should track active session count', async () => {
      await httpServer.start();

      expect(httpServer.getActiveSessionCount()).toBe(0);

      // Initialize first session
      await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      expect(httpServer.getActiveSessionCount()).toBe(1);

      // Initialize second session
      await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 2,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      expect(httpServer.getActiveSessionCount()).toBe(2);
    });

    it('should close all sessions on server stop', async () => {
      await httpServer.start();

      // Initialize 2 sessions
      await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 2,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        }),
      });

      expect(httpServer.getActiveSessionCount()).toBe(2);

      // Stop server
      await httpServer.stop();

      expect(httpServer.getActiveSessionCount()).toBe(0);
    });
  });
});
