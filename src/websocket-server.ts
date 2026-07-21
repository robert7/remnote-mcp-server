import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { BridgeRequest, BridgeResponse, BridgeMessage } from './types/bridge.js';
import { checkVersionCompatibility } from './version-compat.js';
import type { Logger } from './logger.js';

export const REQUEST_TIMEOUT_MS = 15000;
export const MAX_REQUEST_TIMEOUT_MS = 60000;
export const HELLO_TIMEOUT_MS = 2000;
const POLICY_VIOLATION = 1008;
const INCOMPATIBLE_BRIDGE_REASON =
  'Wrong/incompatible RemNote plugin installed. Install MCP/OpenClaw Automation Bridge matching server.';
const BRIDGE_REJECTION_LOG_PREFIX = `Rejecting bridge connection: ${INCOMPATIBLE_BRIDGE_REASON}`;

export class WebSocketServer {
  private wss: WSServer | null = null;
  private client: WebSocket | null = null;
  private port: number;
  private host: string;
  private logger: Logger;
  private requestLogger: Logger | null = null;
  private responseLogger: Logger | null = null;
  private serverVersion: string;
  private bridgeVersion: string | null = null;
  private clientAccepted = false;
  private helloTimeout: NodeJS.Timeout | null = null;
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

  constructor(
    port: number,
    host: string,
    logger: Logger,
    serverVersion: string,
    requestLogger?: Logger,
    responseLogger?: Logger
  ) {
    this.port = port;
    this.host = host;
    this.logger = logger.child({ context: 'websocket-server' });
    this.serverVersion = serverVersion;
    this.requestLogger = requestLogger || null;
    this.responseLogger = responseLogger || null;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WSServer({ port: this.port, host: this.host }, () => {
        this.logger.debug({ port: this.port, host: this.host }, 'WebSocket server started');
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
          ws.close(POLICY_VIOLATION, 'Only one client allowed');
          return;
        }

        this.client = ws;
        this.clientAccepted = false;
        this.logger.info('WebSocket client connected');
        this.helloTimeout = setTimeout(() => {
          if (this.client === ws && !this.clientAccepted && ws.readyState === WebSocket.OPEN) {
            this.logger.warn(`${BRIDGE_REJECTION_LOG_PREFIX} Detail: hello timeout.`);
            ws.close(POLICY_VIOLATION, INCOMPATIBLE_BRIDGE_REASON);
          }
        }, HELLO_TIMEOUT_MS);

        setImmediate(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            return;
          }

          ws.send(
            JSON.stringify({
              type: 'companion_info',
              kind: 'mcp-server',
              version: this.serverVersion,
            })
          );
        });

        ws.on('message', (data) => {
          try {
            this.handleMessage(data.toString());
          } catch (error) {
            this.logger.error({ error }, 'Error handling message');
          }
        });

        ws.on('close', () => {
          this.logger.info('WebSocket client disconnected');
          const wasAccepted = this.clientAccepted;
          if (this.client === ws) {
            this.client = null;
            this.bridgeVersion = null;
            this.clientAccepted = false;
            this.clearHelloTimeout();
          }

          // Reject all pending requests
          for (const [_id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection lost'));
          }
          this.pendingRequests.clear();

          if (wasAccepted) {
            this.disconnectCallbacks.forEach((cb) => cb());
          }
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
        this.bridgeVersion = null;
        this.clientAccepted = false;
        this.clearHelloTimeout();
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

  async sendRequest(
    action: string,
    payload: Record<string, unknown>,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error(
        'RemNote plugin not connected. Please ensure the plugin is installed and running.'
      );
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_REQUEST_TIMEOUT_MS) {
      throw new Error(
        `Request timeout must be an integer between 1 and ${MAX_REQUEST_TIMEOUT_MS}ms`
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
      }, timeoutMs);

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
    return this.client !== null && this.client.readyState === WebSocket.OPEN && this.clientAccepted;
  }

  getBridgeVersion(): string | null {
    return this.bridgeVersion;
  }

  getServerVersion(): string {
    return this.serverVersion;
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

      // Handle hello from bridge plugin
      if ('type' in message && message.type === 'hello') {
        if (typeof message.version !== 'string') {
          this.rejectBridge('Bridge hello missing version', INCOMPATIBLE_BRIDGE_REASON);
          return;
        }

        const warning = checkVersionCompatibility(this.serverVersion, message.version);
        if (warning) {
          this.rejectBridge(warning, INCOMPATIBLE_BRIDGE_REASON);
          return;
        }

        this.bridgeVersion = message.version;
        this.clientAccepted = true;
        this.clearHelloTimeout();
        this.logger.info({ bridgeVersion: message.version }, 'Bridge identified');
        this.connectCallbacks.forEach((cb) => cb());
        return;
      }

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
        if (!this.clientAccepted) {
          this.rejectBridge(
            'Bridge sent response before compatible hello',
            INCOMPATIBLE_BRIDGE_REASON
          );
          return;
        }

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

      if (!this.clientAccepted) {
        this.rejectBridge(
          'Bridge sent message before compatible hello',
          INCOMPATIBLE_BRIDGE_REASON
        );
      }
    } catch (error) {
      this.logger.error({ error }, 'Error parsing message');
      if (!this.clientAccepted) {
        this.rejectBridge(
          'Bridge sent invalid JSON before compatible hello',
          INCOMPATIBLE_BRIDGE_REASON
        );
      }
    }
  }

  private rejectBridge(detail: string, closeReason: string): void {
    this.logger.warn({ detail }, BRIDGE_REJECTION_LOG_PREFIX);
    this.clearHelloTimeout();

    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.close(POLICY_VIOLATION, closeReason);
    }
  }

  private clearHelloTimeout(): void {
    if (!this.helloTimeout) {
      return;
    }

    clearTimeout(this.helloTimeout);
    this.helloTimeout = null;
  }
}
