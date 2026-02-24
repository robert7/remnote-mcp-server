import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from '../websocket-server.js';
import { CreateNoteSchema } from '../schemas/remnote-schemas.js';
import { SearchSchema } from '../schemas/remnote-schemas.js';
import { ReadNoteSchema } from '../schemas/remnote-schemas.js';
import { UpdateNoteSchema } from '../schemas/remnote-schemas.js';
import { AppendJournalSchema } from '../schemas/remnote-schemas.js';
import { checkVersionCompatibility } from '../version-compat.js';
import type { Logger } from '../logger.js';

export const CREATE_NOTE_TOOL = {
  name: 'remnote_create_note',
  description: 'Create a new note in RemNote with optional content, parent, and tags',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'The title of the note' },
      content: { type: 'string', description: 'Content as child bullets (newline-separated)' },
      parentId: { type: 'string', description: 'Parent Rem ID' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply' },
    },
    required: ['title'],
  },
};

export const SEARCH_TOOL = {
  name: 'remnote_search',
  description:
    'Search the RemNote knowledge base. Results are sorted by type: documents first, then concepts, descriptors, portals, and plain text. Use includeContent: "markdown" to render child subtree as indented markdown.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query text' },
      limit: { type: 'number', description: 'Maximum results (1-150, default: 50)' },
      includeContent: {
        type: 'string',
        enum: ['none', 'markdown'],
        description:
          'Content rendering mode: "none" omits content (default), "markdown" renders child subtree as indented markdown',
      },
      depth: {
        type: 'number',
        description: 'Depth of child hierarchy to render (0-10, default: 3)',
      },
      childLimit: {
        type: 'number',
        description: 'Maximum children per level (1-500, default: 20)',
      },
      maxContentLength: {
        type: 'number',
        description: 'Maximum character length for rendered content (default: 3000)',
      },
    },
    required: ['query'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        description:
          'Search results sorted by type (documents, concepts, descriptors, portals, text)',
        items: {
          type: 'object',
          properties: {
            remId: { type: 'string', description: 'Unique Rem ID' },
            title: { type: 'string', description: 'Rendered title with markdown formatting' },
            headline: {
              type: 'string',
              description:
                'Display-oriented full line: title + type-aware delimiter + detail (e.g. "Term :: Definition")',
            },
            detail: {
              type: 'string',
              description: 'Back text for CDF/flashcard Rems (omitted if none)',
            },
            aliases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternate names for the Rem (omitted if none)',
            },
            remType: {
              type: 'string',
              description:
                'Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
            },
            cardDirection: {
              type: 'string',
              description:
                'Flashcard direction: forward, reverse, or bidirectional (omitted if not a flashcard)',
            },
            content: {
              type: 'string',
              description:
                'Rendered markdown content of child subtree (only when includeContent="markdown")',
            },
            contentProperties: {
              type: 'object',
              description: 'Metadata about rendered content',
              properties: {
                childrenRendered: {
                  type: 'number',
                  description: 'Number of children included in rendered content',
                },
                childrenTotal: {
                  type: 'number',
                  description: 'Total children in subtree (capped at 2000)',
                },
                contentTruncated: {
                  type: 'boolean',
                  description: 'Whether content was truncated by maxContentLength',
                },
              },
            },
          },
        },
      },
    },
  },
};

export const READ_NOTE_TOOL = {
  name: 'remnote_read_note',
  description:
    'Read a specific note from RemNote by its Rem ID. Returns metadata and rendered markdown content of the child subtree. Use includeContent: "none" to skip content rendering.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID to read' },
      depth: {
        type: 'number',
        description: 'Depth of child hierarchy to render (0-10, default: 5)',
      },
      includeContent: {
        type: 'string',
        enum: ['none', 'markdown'],
        description:
          'Content rendering mode: "markdown" renders child subtree (default), "none" omits content',
      },
      childLimit: {
        type: 'number',
        description: 'Maximum children per level (1-500, default: 100)',
      },
      maxContentLength: {
        type: 'number',
        description: 'Maximum character length for rendered content (default: 100000)',
      },
    },
    required: ['remId'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'Unique Rem ID' },
      title: { type: 'string', description: 'Rendered title with markdown formatting' },
      headline: {
        type: 'string',
        description:
          'Display-oriented full line: title + type-aware delimiter + detail (e.g. "Term :: Definition")',
      },
      detail: {
        type: 'string',
        description: 'Back text for CDF/flashcard Rems (omitted if none)',
      },
      aliases: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternate names for the Rem (omitted if none)',
      },
      remType: {
        type: 'string',
        description:
          'Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
      },
      cardDirection: {
        type: 'string',
        description:
          'Flashcard direction: forward, reverse, or bidirectional (omitted if not a flashcard)',
      },
      content: {
        type: 'string',
        description:
          'Rendered markdown content of child subtree (when includeContent="markdown", which is the default)',
      },
      contentProperties: {
        type: 'object',
        description: 'Metadata about rendered content',
        properties: {
          childrenRendered: {
            type: 'number',
            description: 'Number of children included in rendered content',
          },
          childrenTotal: {
            type: 'number',
            description: 'Total children in subtree (capped at 2000)',
          },
          contentTruncated: {
            type: 'boolean',
            description: 'Whether content was truncated by maxContentLength',
          },
        },
      },
    },
  },
};

export const UPDATE_NOTE_TOOL = {
  name: 'remnote_update_note',
  description: 'Update an existing note in RemNote (change title, append content, or modify tags)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID to update' },
      title: { type: 'string', description: 'New title' },
      appendContent: { type: 'string', description: 'Content to append as children' },
      addTags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
      removeTags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove' },
    },
    required: ['remId'],
  },
};

export const APPEND_JOURNAL_TOOL = {
  name: 'remnote_append_journal',
  description: "Append content to today's daily document in RemNote",
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: "Content to append to today's daily document" },
      timestamp: { type: 'boolean', description: 'Include timestamp (default: true)' },
    },
    required: ['content'],
  },
};

export const STATUS_TOOL = {
  name: 'remnote_status',
  description: 'Check the connection status and statistics of the RemNote MCP bridge',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export function registerAllTools(server: Server, wsServer: WebSocketServer, logger: Logger) {
  const toolLogger = logger.child({ context: 'tools' });

  // Single CallTool handler for all tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const startTime = Date.now();

    toolLogger.debug({ tool: toolName, args: request.params.arguments }, 'Executing tool');

    try {
      let result;

      switch (toolName) {
        case 'remnote_create_note': {
          const args = CreateNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('create_note', args);
          break;
        }

        case 'remnote_search': {
          const args = SearchSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('search', args);
          break;
        }

        case 'remnote_read_note': {
          const args = ReadNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('read_note', args);
          break;
        }

        case 'remnote_update_note': {
          const args = UpdateNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('update_note', args);
          break;
        }

        case 'remnote_append_journal': {
          const args = AppendJournalSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('append_journal', args);
          break;
        }

        case 'remnote_status': {
          const connected = wsServer.isConnected();
          const serverVersion = wsServer.getServerVersion();
          const bridgeVersion = wsServer.getBridgeVersion();

          if (!connected) {
            result = { connected: false, serverVersion, message: 'RemNote plugin not connected' };
          } else {
            const statusResult = await wsServer.sendRequest('get_status', {});
            const versionWarning = bridgeVersion
              ? checkVersionCompatibility(serverVersion, bridgeVersion)
              : null;
            result = {
              connected: true,
              serverVersion,
              ...(typeof statusResult === 'object' ? statusResult : {}),
              ...(versionWarning ? { version_warning: versionWarning } : {}),
            };
          }
          break;
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      toolLogger.debug(
        {
          tool: toolName,
          duration_ms: Date.now() - startTime,
        },
        'Tool completed'
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      toolLogger.error(
        {
          tool: toolName,
          error: error instanceof Error ? error.message : String(error),
        },
        'Tool failed'
      );

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Register list_tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    toolLogger.debug('Listing available tools');

    return {
      tools: [
        CREATE_NOTE_TOOL,
        SEARCH_TOOL,
        READ_NOTE_TOOL,
        UPDATE_NOTE_TOOL,
        APPEND_JOURNAL_TOOL,
        STATUS_TOOL,
      ],
    };
  });
}
