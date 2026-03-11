import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from '../websocket-server.js';
import { CreateNoteSchema, CreateNoteMdSchema } from '../schemas/remnote-schemas.js';
import { SearchSchema } from '../schemas/remnote-schemas.js';
import { SearchByTagSchema } from '../schemas/remnote-schemas.js';
import { ReadNoteSchema } from '../schemas/remnote-schemas.js';
import { UpdateNoteSchema } from '../schemas/remnote-schemas.js';
import { AppendJournalSchema } from '../schemas/remnote-schemas.js';
import { checkVersionCompatibility } from '../version-compat.js';
import type { Logger } from '../logger.js';

const NAVIGATION_PRESET = {
  includeContent: 'structured',
  depth: 1,
  childLimit: 500,
} as const;

export const CREATE_NOTE_TOOL = {
  name: 'remnote_create_note',
  description:
    'Create a new note (or flashcard if provided with backText) in RemNote with optional content, parent, tags, backText, and card type (default with concept card). Recommended preflight once per session: remnote_status.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'The title of the note (front text for cards)' },
      content: { type: 'string', description: 'Content as child bullets (newline-separated)' },
      parentId: { type: 'string', description: 'Parent Rem ID' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply' },
      backText: { type: 'string', description: 'Optional back text to create a flashcard' },
      isConcept: { type: 'boolean', description: 'Whether to explicitly create a Concept card' },
      isDescriptor: { type: 'boolean', description: 'Whether to explicitly create a Descriptor card' },
    },
    required: ['title'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'Created note/card Rem ID' },
      title: { type: 'string', description: 'Created note title (front text)' },
      backText: { type: 'string', description: 'Back text if a card was created' },
    },
    required: ['remId', 'title'],
  },
};

export const CREATE_NOTE_MD_TOOL = {
  name: 'remnote_create_note_md',
  description:
    'Create a hierarchical note tree in RemNote from a markdown string (indented bullets). Automatically parses indentations (- or *) into parent-child Rem relationships.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: 'Markdown text to convert into a hierarchical tree' },
      title: { type: 'string', description: 'Optional parent Rem title to enclose the tree' },
      parentId: { type: 'string', description: 'Parent Rem ID where the tree will be created' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply to the root/title Rem' },
    },
    required: ['content'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remIds: { type: 'array', items: { type: 'string' }, description: 'List of created Rem IDs (root first)' },
      title: { type: 'string', description: 'Title of the root Rem, if provided' },
    },
    required: ['remIds'],
  },
};

export const SEARCH_TOOL = {
  name: 'remnote_search',
  description:
    'Search the RemNote knowledge base. For whole-KB orientation, prefer includeContent="structured" with depth=1 and childLimit=500, then follow remIds with remnote_read_note. Use includeContent="markdown" for human-readable summaries.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query text' },
      limit: { type: 'number', description: 'Maximum results (1-150, default: 50)' },
      includeContent: {
        type: 'string',
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "none" omits content (default), "markdown" renders child subtree as indented markdown, "structured" returns nested child objects with remIds',
      },
      depth: {
        type: 'number',
        description:
          'Depth of child hierarchy to render for markdown/structured content (0-10, default: 1)',
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
            parentRemId: {
              type: 'string',
              description: 'Direct parent Rem ID (omitted for top-level Rems)',
            },
            parentTitle: {
              type: 'string',
              description: 'Direct parent title/front text (omitted for top-level Rems)',
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
            contentStructured: {
              type: 'array',
              description:
                'Structured child subtree with nested remIds and metadata (only when includeContent="structured")',
              items: {
                type: 'object',
                properties: {
                  remId: { type: 'string', description: 'Child Rem ID' },
                  title: { type: 'string', description: 'Rendered child title' },
                  headline: {
                    type: 'string',
                    description: 'Display-oriented child line with type-aware delimiter',
                  },
                  aliases: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Alternate names for the child Rem (omitted if none)',
                  },
                  remType: {
                    type: 'string',
                    description:
                      'Child Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
                  },
                  cardDirection: {
                    type: 'string',
                    description:
                      'Child flashcard direction: forward, reverse, or bidirectional (omitted if not a flashcard)',
                  },
                  children: {
                    type: 'array',
                    description: 'Nested child nodes (same shape recursively)',
                    items: { type: 'object' },
                  },
                },
                required: ['remId', 'title', 'headline', 'remType', 'children'],
              },
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

export const SEARCH_BY_TAG_TOOL = {
  name: 'remnote_search_by_tag',
  description:
    'Find notes by tag and return resolved ancestor context targets (nearest document/daily document when available, otherwise nearest non-document ancestor). Supports the same includeContent modes as remnote_search.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tag: {
        type: 'string',
        description: 'Tag name to search (with or without # prefix)',
      },
      limit: { type: 'number', description: 'Maximum results (1-150, default: 50)' },
      includeContent: {
        type: 'string',
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "none" omits content (default), "markdown" renders child subtree as indented markdown, "structured" returns nested child objects with remIds',
      },
      depth: {
        type: 'number',
        description:
          'Depth of child hierarchy to render for markdown/structured content (0-10, default: 1)',
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
    required: ['tag'],
  },
  outputSchema: SEARCH_TOOL.outputSchema,
};

export const READ_NOTE_TOOL = {
  name: 'remnote_read_note',
  description:
    'Read a specific note from RemNote by its Rem ID. For hierarchy traversal, prefer includeContent="structured" and start shallow (depth=1, childLimit=500), then deepen only selected branches. Use includeContent="markdown" for summarization.',
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
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "markdown" renders child subtree (default), "structured" returns nested child objects with remIds, "none" omits content',
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
      parentRemId: {
        type: 'string',
        description: 'Direct parent Rem ID (omitted for top-level Rems)',
      },
      parentTitle: {
        type: 'string',
        description: 'Direct parent title/front text (omitted for top-level Rems)',
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
      contentStructured: {
        type: 'array',
        description:
          'Structured child subtree with nested remIds and metadata (only when includeContent="structured")',
        items: {
          type: 'object',
          properties: {
            remId: { type: 'string', description: 'Child Rem ID' },
            title: { type: 'string', description: 'Rendered child title' },
            headline: {
              type: 'string',
              description: 'Display-oriented child line with type-aware delimiter',
            },
            aliases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternate names for the child Rem (omitted if none)',
            },
            remType: {
              type: 'string',
              description:
                'Child Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
            },
            cardDirection: {
              type: 'string',
              description:
                'Child flashcard direction: forward, reverse, or bidirectional (omitted if not a flashcard)',
            },
            children: {
              type: 'array',
              description: 'Nested child nodes (same shape recursively)',
              items: { type: 'object' },
            },
          },
          required: ['remId', 'title', 'headline', 'remType', 'children'],
        },
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
  description:
    'Update an existing note in RemNote (change title, append content, replace content, or modify tags). Recommended preflight once per session: remnote_status. appendContent and replaceContent are mutually exclusive. replaceContent may be blocked by bridge policy.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID to update' },
      title: { type: 'string', description: 'New title' },
      appendContent: { type: 'string', description: 'Content to append as children' },
      replaceContent: {
        type: 'string',
        description: 'Content to replace direct children (empty string clears children)',
      },
      addTags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
      removeTags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove' },
    },
    required: ['remId'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', description: 'Whether the update succeeded' },
      remId: { type: 'string', description: 'Updated note Rem ID' },
    },
    required: ['success', 'remId'],
  },
};

export const APPEND_JOURNAL_TOOL = {
  name: 'remnote_append_journal',
  description:
    "Append content to today's daily document in RemNote. Recommended preflight once per session: remnote_status.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: "Content to append to today's daily document" },
      timestamp: { type: 'boolean', description: 'Include timestamp (default: true)' },
    },
    required: ['content'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'Created journal entry Rem ID' },
      content: { type: 'string', description: 'Final journal entry text written to RemNote' },
    },
    required: ['remId', 'content'],
  },
};

export const STATUS_TOOL = {
  name: 'remnote_status',
  description:
    'Check bridge connection health, compatibility warnings, and write-policy capabilities. Recommended once per session before write operations.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      connected: { type: 'boolean', description: 'Whether bridge plugin is currently connected' },
      serverVersion: { type: 'string', description: 'MCP server version' },
      pluginVersion: { type: 'string', description: 'Connected bridge plugin version' },
      version_warning: {
        type: 'string',
        description: 'Compatibility warning when server/bridge versions differ',
      },
      acceptWriteOperations: {
        type: 'boolean',
        description: 'Whether bridge allows write actions (create/update/journal)',
      },
      acceptReplaceOperation: {
        type: 'boolean',
        description: 'Whether bridge allows update replaceContent operations',
      },
      message: {
        type: 'string',
        description: 'Connection status message (for disconnected states)',
      },
    },
    required: ['connected', 'serverVersion'],
  },
};

export const PLAYBOOK_TOOL = {
  name: 'remnote_get_playbook',
  description:
    'Get an operations playbook for MCP agents: status-first recommendation, navigation presets, content-mode guidance, and write-safety decision tree.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      playbookVersion: { type: 'string' },
      summary: { type: 'string' },
      recommendedStatusCheck: {
        type: 'object',
        properties: {
          tool: { type: 'string' },
          cadence: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
      decisionTree: {
        type: 'array',
        items: { type: 'string' },
      },
      navigationPresets: {
        type: 'object',
        properties: {
          orientation: {
            type: 'object',
            properties: {
              includeContent: { type: 'string' },
              depth: { type: 'number' },
              childLimit: { type: 'number' },
            },
          },
        },
      },
      contentModes: {
        type: 'object',
        properties: {
          structured: { type: 'string' },
          markdown: { type: 'string' },
          none: { type: 'string' },
        },
      },
      writePolicy: {
        type: 'object',
        properties: {
          statusTool: { type: 'string' },
          requiredFields: { type: 'array', items: { type: 'string' } },
          guidance: { type: 'array', items: { type: 'string' } },
        },
      },
      currentStatus: {
        type: 'object',
        description: 'Current remnote_status snapshot when available',
      },
    },
    required: ['playbookVersion', 'summary', 'decisionTree', 'navigationPresets', 'contentModes'],
  },
};

export function registerAllTools(server: Server, wsServer: WebSocketServer, logger: Logger) {
  const toolLogger = logger.child({ context: 'tools' });

  async function buildStatusResult(): Promise<Record<string, unknown>> {
    const connected = wsServer.isConnected();
    const serverVersion = wsServer.getServerVersion();
    const bridgeVersion = wsServer.getBridgeVersion();

    if (!connected) {
      return { connected: false, serverVersion, message: 'RemNote plugin not connected' };
    }

    const statusResult = await wsServer.sendRequest('get_status', {});
    const statusObj =
      typeof statusResult === 'object' && statusResult !== null
        ? (statusResult as Record<string, unknown>)
        : {};
    const fallbackBridgeVersion =
      typeof statusObj.pluginVersion === 'string' ? statusObj.pluginVersion : null;
    const effectiveBridgeVersion = bridgeVersion ?? fallbackBridgeVersion;
    const versionWarning = effectiveBridgeVersion
      ? checkVersionCompatibility(serverVersion, effectiveBridgeVersion)
      : null;

    return {
      connected: true,
      serverVersion,
      ...statusObj,
      ...(versionWarning ? { version_warning: versionWarning } : {}),
    };
  }

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

        case 'remnote_create_note_md': {
          const args = CreateNoteMdSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('create_note_md', args);
          break;
        }

        case 'remnote_search': {
          const args = SearchSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('search', args);
          break;
        }

        case 'remnote_search_by_tag': {
          const args = SearchByTagSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('search_by_tag', args);
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

        case 'remnote_get_playbook': {
          let currentStatus: Record<string, unknown>;
          try {
            currentStatus = await buildStatusResult();
          } catch (statusError) {
            currentStatus = {
              connected: false,
              statusProbeError:
                statusError instanceof Error ? statusError.message : String(statusError),
            };
          }

          result = {
            playbookVersion: '1.0.0',
            summary:
              'Use this playbook to navigate RemNote efficiently via remIds, and to apply write-safety checks before mutations.',
            recommendedStatusCheck: {
              tool: 'remnote_status',
              cadence: 'recommended once per session and before risky writes',
              rationale:
                'status exposes connection health, version compatibility warnings, and write-policy gates',
            },
            decisionTree: [
              'Need connection/capability context? Call remnote_status first.',
              'Need to orient across the KB? Use remnote_search with includeContent="structured", depth=1, childLimit=500.',
              'Need to traverse a specific branch? Use remnote_read_note on a chosen remId with includeContent="structured", depth=1, childLimit=500, then recurse by child remIds.',
              'Need a human-readable summary? Switch to includeContent="markdown" on search/read results.',
              'Need to modify content? Check remnote_status: if acceptWriteOperations is false, stop; if using replaceContent, ensure acceptReplaceOperation is true.',
            ],
            navigationPresets: {
              orientation: NAVIGATION_PRESET,
              branchTraversal: NAVIGATION_PRESET,
            },
            contentModes: {
              structured:
                'ID-first traversal mode. Returns contentStructured with child remIds for deterministic follow-up reads.',
              markdown:
                'Summary mode. Returns rendered markdown content for human-facing synthesis, not deterministic child ID traversal.',
              none: 'Metadata-only mode when content is not needed.',
            },
            writePolicy: {
              statusTool: 'remnote_status',
              requiredFields: ['acceptWriteOperations', 'acceptReplaceOperation'],
              guidance: [
                'Create/update/journal require acceptWriteOperations=true.',
                'replaceContent updates require acceptReplaceOperation=true.',
                'appendContent and replaceContent cannot be used in the same remnote_update_note call.',
              ],
            },
            currentStatus,
          };
          break;
        }

        case 'remnote_status': {
          result = await buildStatusResult();
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
        CREATE_NOTE_MD_TOOL,
        SEARCH_TOOL,
        SEARCH_BY_TAG_TOOL,
        READ_NOTE_TOOL,
        UPDATE_NOTE_TOOL,
        APPEND_JOURNAL_TOOL,
        PLAYBOOK_TOOL,
        STATUS_TOOL,
      ],
    };
  });
}
