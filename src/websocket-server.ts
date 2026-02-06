import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { BridgeRequest, BridgeResponse, BridgeMessage } from './types/bridge.js';

export class WebSocketServer {
  private wss: WSServer | null = null;
  private client: WebSocket | null = null;
  private port: number;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private connectCallbacks: Array<() => void> = [];
  private disconnectCallbacks: Array<() => void> = [];

  constructor(port: number) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WSServer({ port: this.port }, () => {
        resolve();
      });

      this.wss.on('error', (error) => {
        console.error('[WebSocket Server] Error:', error);
        reject(error);
      });

      this.wss.on('connection', (ws) => {
        // Only allow single client connection
        if (this.client && this.client.readyState === WebSocket.OPEN) {
          console.error('[WebSocket Server] Rejecting connection: client already connected');
          ws.close(1008, 'Only one client allowed');
          return;
        }

        this.client = ws;
        console.error('[WebSocket Server] Client connected');
        this.connectCallbacks.forEach(cb => cb());

        ws.on('message', (data) => {
          try {
            this.handleMessage(data.toString());
          } catch (error) {
            console.error('[WebSocket Server] Error handling message:', error);
          }
        });

        ws.on('close', () => {
          console.error('[WebSocket Server] Client disconnected');
          this.client = null;

          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection lost'));
          }
          this.pendingRequests.clear();

          this.disconnectCallbacks.forEach(cb => cb());
        });

        ws.on('error', (error) => {
          console.error('[WebSocket Server] Client error:', error);
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
      throw new Error('RemNote plugin not connected. Please ensure the plugin is installed and running.');
    }

    const id = randomUUID();
    const request: BridgeRequest = { id, action, payload };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${action}`));
      }, 5000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

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
          console.error('[WebSocket Server] Received response for unknown request ID:', response.id);
        }
      }
    } catch (error) {
      console.error('[WebSocket Server] Error parsing message:', error);
    }
  }
}
