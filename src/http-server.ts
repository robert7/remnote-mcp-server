import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { WebSocketServer } from './websocket-server.js';
import { registerAllTools } from './tools/index.js';

interface ServerInfo {
  name: string;
  version: string;
}

export class HttpMcpServer {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;
  private port: number;
  private wsServer: WebSocketServer;
  private serverInfo: ServerInfo;
  private transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(port: number, wsServer: WebSocketServer, serverInfo: ServerInfo) {
    this.port = port;
    this.wsServer = wsServer;
    this.serverInfo = serverInfo;

    // Use SDK's DNS rebinding protection and JSON parsing
    this.app = createMcpExpressApp();

    // Route handlers
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const router = express.Router();

    // POST: Handle session initialization and requests
    router.post('/', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        const body = req.body;

        // Check if this is an initialize request
        const isInitializeRequest =
          body && body.method === 'initialize' && body.jsonrpc === '2.0';

        if (!sessionId && isInitializeRequest) {
          // New session initialization
          await this.initializeNewSession(req, res, body);
        } else if (sessionId) {
          // Existing session request
          await this.handleSessionRequest(sessionId, req, res, body);
        } else {
          // Missing session ID for non-initialize request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Missing mcp-session-id header for non-initialize request',
            },
            id: body?.id ?? null,
          });
        }
      } catch (error) {
        console.error('[HTTP Server] Error handling POST request:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
          id: null,
        });
      }
    });

    // GET: SSE stream for session notifications
    router.get('/', (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId) {
        res.status(400).json({
          error: 'Missing mcp-session-id header',
        });
        return;
      }

      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({
          error: `Session not found: ${sessionId}`,
        });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Handle SSE stream
      transport.handleSseStream(req, res);
    });

    // DELETE: Terminate session
    router.delete('/', (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId) {
        res.status(400).json({
          error: 'Missing mcp-session-id header',
        });
        return;
      }

      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({
          error: `Session not found: ${sessionId}`,
        });
        return;
      }

      // Remove transport
      this.transports.delete(sessionId);
      console.error(`[HTTP Server] Session terminated: ${sessionId}`);

      res.status(200).json({ success: true });
    });

    // Mount router at /mcp
    this.app.use('/mcp', router);
  }

  private async initializeNewSession(req: Request, res: Response, body: unknown): Promise<void> {
    // Create new transport with session ID generator
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        this.transports.set(sessionId, transport);
        console.error(`[HTTP Server] New session initialized: ${sessionId}`);
      },
    });

    // Create new MCP server instance for this session
    const server = new Server(this.serverInfo, {
      capabilities: {
        tools: {},
      },
    });

    // Register all tools with the shared WebSocket server
    registerAllTools(server, this.wsServer);

    // Connect server to transport
    await server.connect(transport);

    // Handle the initialize request
    await transport.handleRequest(req, res, body);
  }

  private async handleSessionRequest(
    sessionId: string,
    req: Request,
    res: Response,
    body: unknown
  ): Promise<void> {
    const transport = this.transports.get(sessionId);

    if (!transport) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Invalid session ID: ${sessionId}`,
        },
        id: (body as { id?: unknown })?.id ?? null,
      });
      return;
    }

    await transport.handleRequest(req, res, body);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.error(`[HTTP Server] Listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('[HTTP Server] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active sessions
      for (const [sessionId, _transport] of this.transports.entries()) {
        this.transports.delete(sessionId);
        console.error(`[HTTP Server] Closed session: ${sessionId}`);
      }

      if (this.server) {
        this.server.close(() => {
          console.error('[HTTP Server] Server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getActiveSessionCount(): number {
    return this.transports.size;
  }
}
