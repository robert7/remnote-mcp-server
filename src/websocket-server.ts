import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { BridgeRequest, BridgeResponse, BridgeMessage } from './types/bridge.js';
import type { Logger } from './logger.js';

export class WebSocketServer {
  private wss: WSServer | null = null;
  private client: WebSocket | null = null;
  private port: number;
  private logger: Logger;
  private requestLogger: Logger | null = null;
  private responseLogger: Logger | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private connectCallbacks: Array<() => void> = [];
  private disconnectCallbacks: Array<() => void> = [];

  constructor(port: number, logger: Logger, requestLogger?: Logger, responseLogger?: Logger) {
    this.port = port;
    this.logger = logger.child({ context: 'websocket-server' });
    this.requestLogger = requestLogger || null;
    this.responseLogger = responseLogger || null;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WSServer({ port: this.port }, () => {
        this.logger.debug({ port: this.port }, 'WebSocket server started');
        resolve();
      });

      this.wss.on('error', (error) => {
        this.logger.error({ error }, 'WebSocket server error');
        reject(error);
      });

      this.wss.on('connection', (ws) => {
        // Only allow single client connection
        if (this.client && this.client.readyState === WebSocket.OPEN) {
          this.logger.warn('Rejecting connection: client already connected');
          ws.close(1008, 'Only one client allowed');
          return;
        }

        this.client = ws;
        this.logger.info('WebSocket client connected');
        this.connectCallbacks.forEach((cb) => cb());

        ws.on('message', (data) => {
          try {
            this.handleMessage(data.toString());
          } catch (error) {
            this.logger.error({ error }, 'Error handling message');
          }
        });

        ws.on('close', () => {
          this.logger.info('WebSocket client disconnected');
          this.client = null;

          // Reject all pending requests
          for (const [_id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection lost'));
          }
          this.pendingRequests.clear();

          this.disconnectCallbacks.forEach((cb) => cb());
        });

        ws.on('error', (error) => {
          this.logger.error({ error }, 'WebSocket client error');
        });
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.close();
        this.client = null;
      }

      if (this.wss) {
        this.wss.close(() => {
          this.logger.debug('WebSocket server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async sendRequest(action: string, payload: Record<string, unknown>): Promise<unknown> {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      throw new Error(
        'RemNote plugin not connected. Please ensure the plugin is installed and running.'
      );
    }

    const id = randomUUID();
    const request: BridgeRequest = { id, action, payload };
    const startTime = Date.now();

    this.logger.debug({ id, action }, 'Sending request');

    // Log request if configured
    if (this.requestLogger) {
      this.requestLogger.info({ type: 'request', id, action, payload });
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${action}`));
      }, 5000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          // Log response if configured
          if (this.responseLogger) {
            this.responseLogger.info({
              type: 'response',
              id,
              duration_ms: Date.now() - startTime,
              error: null,
            });
          }
          resolve(result);
        },
        reject: (error) => {
          // Log error response if configured
          if (this.responseLogger) {
            this.responseLogger.info({
              type: 'response',
              id,
              duration_ms: Date.now() - startTime,
              error: error.message,
            });
          }
          reject(error);
        },
        timeout,
      });

      try {
        this.client!.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  onClientConnect(callback: () => void): void {
    this.connectCallbacks.push(callback);
  }

  onClientDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as BridgeMessage;

      this.logger.debug(
        {
          type: 'type' in message ? message.type : 'response',
        },
        'Received message'
      );

      // Handle pong response to ping
      if ('type' in message && message.type === 'pong') {
        return;
      }

      // Handle ping - respond with pong
      if ('type' in message && message.type === 'ping') {
        if (this.client && this.client.readyState === WebSocket.OPEN) {
          this.client.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      // Handle response to our request
      if ('id' in message) {
        const response = message as BridgeResponse;
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve(response.result);
          }
        } else {
          this.logger.warn({ id: response.id }, 'Unknown request ID');
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Error parsing message');
    }
  }
}
