/**
 * Mock implementations for testing
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';
import type { WebSocket } from 'ws';

/**
 * Mock WebSocket client with controllable state
 */
export class MockWebSocket extends EventEmitter {
  public readyState: number = 1; // OPEN
  public sentMessages: string[] = [];

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.emit('close', code, reason);
  }

  // Simulate receiving a message from server
  simulateMessage(data: string): void {
    this.emit('message', Buffer.from(data));
  }

  // Simulate error
  simulateError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * Mock WebSocketServer
 */
export class MockWebSocketServer extends EventEmitter {
  public clients = new Set<WebSocket>();
  private connectionHandler?: (ws: WebSocket) => void;

  constructor(
    public options: { port: number },
    callback?: () => void
  ) {
    super();
    if (callback) {
      // Simulate async server start
      setImmediate(callback);
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    if (event === 'connection') {
      this.connectionHandler = handler as (ws: WebSocket) => void;
    }
    return super.on(event, handler);
  }

  close(callback?: () => void): void {
    if (callback) {
      setImmediate(callback);
    }
  }

  // Test helper: simulate client connection
  simulateConnection(ws: WebSocket): void {
    this.clients.add(ws);
    if (this.connectionHandler) {
      this.connectionHandler(ws);
    }
    this.emit('connection', ws);
  }

  // Test helper: simulate error
  simulateError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * Mock MCP Server
 */
export class MockMCPServer {
  private handlers = new Map<string, (request: unknown) => Promise<unknown>>();

  setRequestHandler(schema: { method: string }, handler: (request: unknown) => Promise<unknown>) {
    this.handlers.set(schema.method, handler);
  }

  // Test helper: call a registered handler
  async callHandler(method: string, request: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`No handler registered for method: ${method}`);
    }
    return handler(request);
  }

  // Test helper: check if handler is registered
  hasHandler(method: string): boolean {
    return this.handlers.has(method);
  }
}

/**
 * Create mock factory for WebSocketServer
 */
export function createMockWSServerFactory() {
  const instances: MockWebSocketServer[] = [];

  const factory = vi.fn((options: { port: number }, callback?: () => void) => {
    const instance = new MockWebSocketServer(options, callback);
    instances.push(instance);
    return instance;
  });

  return { factory, instances };
}
