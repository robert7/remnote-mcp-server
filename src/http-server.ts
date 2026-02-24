import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Express, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { WebSocketServer } from './websocket-server.js';
import { registerAllTools } from './tools/index.js';
import type { Logger } from './logger.js';

interface ServerInfo {
  name: string;
  version: string;
}

export class HttpMcpServer {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;
  private port: number;
  private host: string;
  private wsServer: WebSocketServer;
  private serverInfo: ServerInfo;
  private logger: Logger;
  private serverInstanceId: string;
  private transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(
    port: number,
    host: string,
    wsServer: WebSocketServer,
    serverInfo: ServerInfo,
    logger: Logger
  ) {
    this.port = port;
    this.host = host;
    this.wsServer = wsServer;
    this.serverInfo = serverInfo;
    this.logger = logger.child({ context: 'http-server' });
    this.serverInstanceId = randomUUID();

    // Create Express app with JSON parsing
    this.app = express();
    this.app.use(express.json());

    // Route handlers
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // POST: Handle session initialization and requests
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        const body = req.body;

        // Check if this is an initialize request
        const isInitializeRequest = body && body.method === 'initialize' && body.jsonrpc === '2.0';

        this.logger.debug(
          {
            sessionId: sessionId || 'none',
            method: body?.method || 'unknown',
          },
          'POST request received'
        );

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
        this.logger.error(
          {
            error,
            sessionId: req.headers['mcp-session-id'] as string | undefined,
          },
          'Error handling POST request'
        );
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
    this.app.get('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      this.logger.debug({ sessionId: sessionId || 'none' }, 'SSE stream opened');

      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }

      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `Session not found: ${sessionId}` });
        return;
      }

      // Let transport handle SSE stream setup
      await transport.handleRequest(req, res);
    });

    // DELETE: Terminate session
    this.app.delete('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      this.logger.debug({ sessionId: sessionId || 'none' }, 'Session termination requested');

      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }

      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `Session not found: ${sessionId}` });
        return;
      }

      // Let transport handle session termination
      await transport.handleRequest(req, res);
    });
  }

  private async initializeNewSession(req: Request, res: Response, body: unknown): Promise<void> {
    // Create new transport with session ID generator
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        this.transports.set(sessionId, transport);
        this.logger.info({ sessionId }, 'New MCP session initialized');
      },
    });

    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId && this.transports.has(sessionId)) {
        this.logger.info({ sessionId }, 'MCP session closed');
        this.transports.delete(sessionId);
      }
    };

    // Create new MCP server instance for this session
    const server = new Server(this.serverInfo, {
      capabilities: {
        tools: {},
      },
    });

    // Register all tools with the shared WebSocket server
    registerAllTools(server, this.wsServer, this.logger);

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
      this.logger.warn(
        {
          requestedSessionId: sessionId,
          method: (body as { method?: unknown })?.method ?? 'unknown',
          serverInstanceId: this.serverInstanceId,
        },
        'Invalid MCP session ID received; client must reinitialize session'
      );

      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `Invalid session ID: ${sessionId}. Session may have expired or server was restarted. Reinitialize MCP session (initialize + notifications/initialized).`,
          data: {
            reason: 'session_invalidated',
            requiresReinitialize: true,
            retryable: true,
            serverInstanceId: this.serverInstanceId,
          },
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
        this.server = this.app.listen(this.port, this.host, () => {
          this.logger.info(
            { port: this.port, host: this.host, serverInstanceId: this.serverInstanceId },
            'HTTP server started'
          );
          resolve();
        });

        this.server.on('error', (error) => {
          this.logger.error({ error }, 'HTTP server error');
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    // Close all active transports
    for (const [sessionId, transport] of this.transports.entries()) {
      try {
        this.logger.debug({ sessionId }, 'Closing MCP session');
        await transport.close();
        this.transports.delete(sessionId);
      } catch (error) {
        this.logger.error({ sessionId, error }, 'Error closing session');
      }
    }

    // Close HTTP server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('HTTP server stopped');
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
