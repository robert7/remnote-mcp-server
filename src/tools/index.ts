import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from '../websocket-server.js';
import { CreateNoteSchema } from '../schemas/remnote-schemas.js';
import { SearchSchema } from '../schemas/remnote-schemas.js';
import { SearchByTagSchema } from '../schemas/remnote-schemas.js';
import { ReadNoteSchema } from '../schemas/remnote-schemas.js';
import { UpdateNoteSchema } from '../schemas/remnote-schemas.js';
import { SetDocumentStatusSchema } from '../schemas/remnote-schemas.js';
import { ListChildrenSchema } from '../schemas/remnote-schemas.js';
import { MoveNoteSchema } from '../schemas/remnote-schemas.js';
import { InsertChildrenSchema } from '../schemas/remnote-schemas.js';
import { ReplaceChildrenSchema } from '../schemas/remnote-schemas.js';
import { UpdateTagsSchema } from '../schemas/remnote-schemas.js';
import { SetPropertySchema } from '../schemas/remnote-schemas.js';
import { AppendJournalSchema } from '../schemas/remnote-schemas.js';
import { ReadTableSchema } from '../schemas/remnote-schemas.js';
import { checkVersionCompatibility } from '../version-compat.js';
import type { Logger } from '../logger.js';

const NAVIGATION_PRESET = {
  contentMode: 'structured',
  view: 'compact',
  depth: 1,
  childLimit: 500,
} as const;

const ANCESTOR_SCHEMA = {
  type: 'object' as const,
  properties: {
    remId: { type: 'string', description: 'Ancestor Rem ID' },
    title: { type: 'string', description: 'Rendered ancestor title' },
    remType: {
      type: 'string',
      description: 'Ancestor Rem classification when available',
    },
  },
  required: ['remId', 'title'],
  additionalProperties: false,
};

const TAG_INFO_SCHEMA = {
  type: 'object' as const,
  properties: {
    tagRemId: { type: 'string', description: 'Exact tag Rem ID' },
    name: { type: 'string', description: 'Human-readable tag name' },
  },
  required: ['tagRemId', 'name'],
  additionalProperties: false,
};

const INLINE_REF_SCHEMA = {
  type: 'object' as const,
  properties: {
    text: { type: 'string', description: 'Rendered target text used in output' },
    targetRemId: { type: 'string', description: 'Exact target Rem ID' },
    kind: { type: 'string', enum: ['rem'], description: 'Inline reference kind' },
  },
  required: ['text', 'targetRemId', 'kind'],
  additionalProperties: false,
};

const MATCHED_REM_SCHEMA = {
  type: 'object' as const,
  properties: {
    remId: { type: 'string', description: 'Directly tagged Rem ID' },
    title: { type: 'string', description: 'Rendered title with markdown formatting' },
    headline: { type: 'string', description: 'Display-oriented full line' },
    inlineRefs: {
      type: 'array',
      items: INLINE_REF_SCHEMA,
      description: 'Resolvable inline Rem references from the matched Rem title/headline',
    },
    remType: {
      type: 'string',
      description:
        'Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
    },
    parentRemId: {
      type: 'string',
      description: 'Direct parent Rem ID (omitted for top-level Rems)',
    },
    parentTitle: {
      type: 'string',
      description: 'Direct parent title/front text (omitted for top-level Rems)',
    },
    ancestors: {
      type: 'array',
      items: ANCESTOR_SCHEMA,
      description: 'Parent-first ancestor chain when ancestorDepth is greater than zero',
    },
    ancestorsTruncated: {
      type: 'boolean',
      description: 'Whether the ancestor chain was capped by ancestorDepth',
    },
    tags: {
      type: 'array',
      items: TAG_INFO_SCHEMA,
      description: 'Direct tags applied to the matched Rem as exact tag Rem IDs plus names',
    },
  },
  required: ['remId', 'title', 'headline', 'remType'],
  additionalProperties: false,
};

export const CREATE_NOTE_TOOL = {
  name: 'remnote_create_note',
  description:
    'Create a new note in RemNote with optional content, parent, and exact tag Rem IDs. Supports hierarchical markdown, flashcard syntax (e.g. "- Term :: Definition"), and exact inline Rem references as [[id:<remId>]]. At least one of title or content must be provided. Recommended preflight once per session: remnote_status.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description:
          'The title of the note (optional if content is provided). Supports exact Rem references as [[id:<remId>]].',
      },
      content: {
        type: 'string',
        description:
          'Content as plain text, child bullets, or hierarchical markdown. Use [[id:<remId>]] for exact Rem references.',
      },
      parentId: { type: 'string', description: 'Parent Rem ID' },
      tagRemIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exact tag Rem IDs to apply',
      },
      asDocument: {
        type: 'boolean',
        description:
          'Mark the created title/root Rem as a document while preserving any concept/card status',
      },
    },
    required: [],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of created Rems (title at index 0, top-to-bottom)',
      },
      titles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Extracted text for each created Rem (title Rem ID at index 0, top-to-bottom)',
      },
    },
    required: ['remIds', 'titles'],
  },
};

export const SEARCH_TOOL = {
  name: 'remnote_search',
  description:
    'Search the RemNote knowledge base. Supports cursor paging through hasMore/nextCursor. For whole-KB orientation, prefer contentMode="structured" with view="compact", depth=1, and childLimit=500. Request ancestorDepth when hierarchy context matters.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query text' },
      parentRemId: {
        type: 'string',
        minLength: 1,
        description:
          "Optional non-empty Rem ID. Scope the search to within this Rem's subtree. The Rem itself is excluded from results.",
      },
      limit: { type: 'number', description: 'Maximum results (1-150, default: 50)' },
      cursor: {
        type: 'string',
        description: 'Opaque cursor returned by a previous remnote_search response',
      },
      contentMode: {
        type: 'string',
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "none" omits content (default), "markdown" renders child subtree as indented markdown, "structured" returns nested child objects with remIds',
      },
      view: {
        type: 'string',
        enum: ['compact', 'standard', 'full'],
        description: 'Output detail level: compact, standard, or full',
      },
      ancestorDepth: {
        type: 'number',
        description: 'Number of parent Rems to include, direct parent first (0-20, default: 0)',
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
            inlineRefs: {
              type: 'array',
              items: INLINE_REF_SCHEMA,
              description:
                'Resolvable inline Rem references from the rendered title/headline. Markdown text preserves these as [[Target Title]].',
            },
            parentRemId: {
              type: 'string',
              description: 'Direct parent Rem ID (omitted for top-level Rems)',
            },
            parentTitle: {
              type: 'string',
              description: 'Direct parent title/front text (omitted for top-level Rems)',
            },
            ancestors: {
              type: 'array',
              items: ANCESTOR_SCHEMA,
              description: 'Parent-first ancestor chain when ancestorDepth is greater than zero',
            },
            ancestorsTruncated: {
              type: 'boolean',
              description: 'Whether the ancestor chain was capped by ancestorDepth',
            },
            aliases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternate names for the Rem (omitted if none)',
            },
            tags: {
              type: 'array',
              items: TAG_INFO_SCHEMA,
              description:
                'Direct tags applied to the returned Rem as exact tag Rem IDs plus names (omitted if none or unavailable from the bridge runtime)',
            },
            remType: {
              type: 'string',
              description:
                'Rem classification: document, dailyDocument, concept, descriptor, portal, or text',
            },
            matchedRems: {
              type: 'array',
              items: MATCHED_REM_SCHEMA,
              description:
                'For remnote_search_by_tag context mode, direct Rems carrying the requested tag that produced this context result',
            },
            contextRemId: {
              type: 'string',
              description:
                'For remnote_search_by_tag tagged mode, resolved ancestor/context Rem ID for this direct match',
            },
            contextTitle: {
              type: 'string',
              description:
                'For remnote_search_by_tag tagged mode, resolved ancestor/context title for this direct match',
            },
            contextReason: {
              type: 'string',
              enum: ['ancestor-document', 'ancestor-concept', 'ancestor-context', 'self'],
              description:
                'For remnote_search_by_tag tagged mode, why the context Rem was selected',
            },
            cardDirection: {
              type: 'string',
              description:
                'Flashcard direction: forward, reverse, or bidirectional (omitted if not a flashcard)',
            },
            content: {
              type: 'string',
              description:
                'Rendered markdown content of child subtree (only when contentMode="markdown")',
            },
            contentStructured: {
              type: 'array',
              description:
                'Structured child subtree with nested remIds and metadata (only when contentMode="structured")',
              items: {
                type: 'object',
                properties: {
                  remId: { type: 'string', description: 'Child Rem ID' },
                  title: { type: 'string', description: 'Rendered child title' },
                  headline: {
                    type: 'string',
                    description: 'Display-oriented child line with type-aware delimiter',
                  },
                  inlineRefs: {
                    type: 'array',
                    items: INLINE_REF_SCHEMA,
                    description: 'Resolvable inline Rem references from the child title/headline',
                  },
                  aliases: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Alternate names for the child Rem (omitted if none)',
                  },
                  tags: {
                    type: 'array',
                    items: TAG_INFO_SCHEMA,
                    description:
                      'Direct tags applied to the child Rem as exact tag Rem IDs plus names (omitted if none or unavailable from the bridge runtime)',
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
                    description:
                      'Nested child nodes (same shape recursively; omitted for leaf nodes)',
                    items: { type: 'object' },
                  },
                },
                required: ['remId', 'title', 'headline', 'remType'],
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
      hasMore: {
        type: 'boolean',
        description: 'Whether more results are available through nextCursor',
      },
      nextCursor: {
        type: 'string',
        description: 'Opaque cursor for the next page when hasMore is true',
      },
      truncated: {
        type: 'boolean',
        description:
          'Whether search results may be incomplete because the bridge hit its snapshot cap',
      },
      truncationReason: {
        type: 'string',
        enum: ['cursor_snapshot_limit'],
        description: 'Reason search results may be incomplete when truncated is true',
      },
    },
  },
};

export const SEARCH_BY_TAG_TOOL = {
  name: 'remnote_search_by_tag',
  description:
    'Find notes by exact tag Rem ID. Supports cursor paging through hasMore/nextCursor. Default resultMode="context" returns resolved ancestor context targets with matchedRems; resultMode="tagged" returns directly tagged Rems with context metadata. Request ancestorDepth to include parent-first ancestors on both context results and matchedRems.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tagRemId: {
        type: 'string',
        description: 'Exact tag Rem ID to search',
      },
      resultMode: {
        type: 'string',
        enum: ['context', 'tagged'],
        description:
          '"context" returns resolved ancestor context targets with matchedRems (default); "tagged" returns directly tagged Rems with context metadata',
      },
      limit: { type: 'number', description: 'Maximum results (1-150, default: 50)' },
      contentMode: {
        type: 'string',
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "none" omits content (default), "markdown" renders child subtree as indented markdown, "structured" returns nested child objects with remIds',
      },
      view: {
        type: 'string',
        enum: ['compact', 'standard', 'full'],
        description: 'Output detail level: compact, standard, or full',
      },
      ancestorDepth: {
        type: 'number',
        description: 'Number of parent Rems to include, direct parent first (0-20, default: 0)',
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
      cursor: {
        type: 'string',
        description: 'Opaque cursor returned by a previous remnote_search_by_tag response',
      },
      timeoutMs: {
        type: 'number',
        description:
          'Per-call bridge wait timeout in milliseconds (1-60000, default: 15000). Does not cancel plugin-side work.',
      },
    },
    required: ['tagRemId'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      results: SEARCH_TOOL.outputSchema.properties.results,
      hasMore: SEARCH_TOOL.outputSchema.properties.hasMore,
      nextCursor: SEARCH_TOOL.outputSchema.properties.nextCursor,
      truncated: SEARCH_TOOL.outputSchema.properties.truncated,
      truncationReason: SEARCH_TOOL.outputSchema.properties.truncationReason,
    },
  },
};

export const READ_NOTE_TOOL = {
  name: 'remnote_read_note',
  description:
    'Read a specific note from RemNote by its Rem ID. For hierarchy traversal, prefer contentMode="structured" and start shallow (depth=1, childLimit=500), then deepen only selected branches. Request ancestorDepth when placement context matters.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID to read' },
      depth: {
        type: 'number',
        description: 'Depth of child hierarchy to render (0-10, default: 5)',
      },
      contentMode: {
        type: 'string',
        enum: ['none', 'markdown', 'structured'],
        description:
          'Content rendering mode: "markdown" renders child subtree (default), "structured" returns nested child objects with remIds, "none" omits content',
      },
      view: {
        type: 'string',
        enum: ['compact', 'standard', 'full'],
        description: 'Output detail level: compact, standard, or full',
      },
      ancestorDepth: {
        type: 'number',
        description: 'Number of parent Rems to include, direct parent first (0-20, default: 0)',
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
      inlineRefs: {
        type: 'array',
        items: INLINE_REF_SCHEMA,
        description:
          'Resolvable inline Rem references from the rendered title/headline. Markdown text preserves these as [[Target Title]].',
      },
      parentRemId: {
        type: 'string',
        description: 'Direct parent Rem ID (omitted for top-level Rems)',
      },
      parentTitle: {
        type: 'string',
        description: 'Direct parent title/front text (omitted for top-level Rems)',
      },
      ancestors: {
        type: 'array',
        items: ANCESTOR_SCHEMA,
        description: 'Parent-first ancestor chain when ancestorDepth is greater than zero',
      },
      ancestorsTruncated: {
        type: 'boolean',
        description: 'Whether the ancestor chain was capped by ancestorDepth',
      },
      aliases: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternate names for the Rem (omitted if none)',
      },
      tags: {
        type: 'array',
        items: TAG_INFO_SCHEMA,
        description:
          'Direct tags applied to the returned Rem as exact tag Rem IDs plus names (omitted if none or unavailable from the bridge runtime)',
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
          'Rendered markdown content of child subtree (when contentMode="markdown", which is the default)',
      },
      contentStructured: {
        type: 'array',
        description:
          'Structured child subtree with nested remIds and metadata (only when contentMode="structured")',
        items: {
          type: 'object',
          properties: {
            remId: { type: 'string', description: 'Child Rem ID' },
            title: { type: 'string', description: 'Rendered child title' },
            headline: {
              type: 'string',
              description: 'Display-oriented child line with type-aware delimiter',
            },
            inlineRefs: {
              type: 'array',
              items: INLINE_REF_SCHEMA,
              description: 'Resolvable inline Rem references from the child title/headline',
            },
            aliases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternate names for the child Rem (omitted if none)',
            },
            tags: {
              type: 'array',
              items: TAG_INFO_SCHEMA,
              description:
                'Direct tags applied to the child Rem as exact tag Rem IDs plus names (omitted if none or unavailable from the bridge runtime)',
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
              description: 'Nested child nodes (same shape recursively; omitted for leaf nodes)',
              items: { type: 'object' },
            },
          },
          required: ['remId', 'title', 'headline', 'remType'],
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

export const LIST_CHILDREN_TOOL = {
  name: 'remnote_list_children',
  description:
    'List direct child Rems under a parent without rendering a subtree. Use for cheap hierarchy traversal; page with nextCursor when hasMore is true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      parentRemId: { type: 'string', description: 'Parent Rem ID whose direct children to list' },
      limit: { type: 'number', description: 'Maximum direct children (1-150, default: 50)' },
      cursor: {
        type: 'string',
        description: 'Opaque cursor returned by a previous remnote_list_children response',
      },
      view: {
        type: 'string',
        enum: ['compact', 'standard', 'full'],
        description: 'Output detail level for child metadata: compact, standard, or full',
      },
      ancestorDepth: {
        type: 'number',
        description: 'Number of parent Rems to include for each child, direct parent first',
      },
    },
    required: ['parentRemId'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      children: {
        type: 'array',
        items: SEARCH_TOOL.outputSchema.properties.results.items,
      },
      hasMore: SEARCH_TOOL.outputSchema.properties.hasMore,
      nextCursor: SEARCH_TOOL.outputSchema.properties.nextCursor,
      totalChildren: {
        type: 'number',
        description: 'Total direct children observed when listing this parent',
      },
    },
  },
};

export const MOVE_NOTE_TOOL = {
  name: 'remnote_move_note',
  description:
    'Safely move an existing Rem and its subtree under a new parent. Defaults to dryRun=true; pass dryRun=false only after user approval. expectedOldParentRemId rejects stale move proposals.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'Rem ID to move' },
      newParentRemId: { type: 'string', description: 'New parent Rem ID' },
      position: {
        type: 'string',
        enum: ['first', 'last', 'before', 'after'],
        description: 'Where to place the moved Rem under the new parent (default: last)',
      },
      siblingRemId: {
        type: 'string',
        description: 'Sibling Rem ID required for before/after positioning',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without mutating RemNote (default: true)',
      },
      expectedOldParentRemId: {
        type: 'string',
        description: 'Reject if the current direct parent differs from this Rem ID',
      },
      ancestorDepth: {
        type: 'number',
        description: 'Number of parent Rems to include before/after the move',
      },
    },
    required: ['remId', 'newParentRemId'],
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string' },
      title: { type: 'string' },
      dryRun: { type: 'boolean' },
      oldParentRemId: { type: 'string' },
      oldParentTitle: { type: 'string' },
      newParentRemId: { type: 'string' },
      newParentTitle: { type: 'string' },
      position: { type: 'string', enum: ['first', 'last', 'before', 'after'] },
      siblingRemId: { type: 'string' },
      ancestorsBefore: { type: 'array', items: ANCESTOR_SCHEMA },
      ancestorsBeforeTruncated: { type: 'boolean' },
      ancestorsAfter: { type: 'array', items: ANCESTOR_SCHEMA },
      ancestorsAfterTruncated: { type: 'boolean' },
    },
    required: ['remId', 'title', 'dryRun', 'newParentRemId', 'newParentTitle', 'position'],
  },
};

export const UPDATE_NOTE_TOOL = {
  name: 'remnote_update_note',
  description:
    'Update note metadata in RemNote. Use this tool for title changes only. The title supports exact Rem references as [[id:<remId>]].',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID to update' },
      title: {
        type: 'string',
        description: 'New title. Use [[id:<remId>]] for exact Rem references.',
      },
    },
    required: ['remId', 'title'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of updated/affected Rems',
      },
      titles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Extracted text for updated Rems',
      },
    },
    required: ['remIds', 'titles'],
  },
};

export const SET_DOCUMENT_STATUS_TOOL = {
  name: 'remnote_set_document_status',
  description:
    'Preview or set whether an existing Rem is marked as a document. Uses dryRun=true by default, preserves Rem ID, children, parent, tags, and concept/card status, and requires write operations to be enabled.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID whose document status should change' },
      isDocument: {
        type: 'boolean',
        description: 'Whether the Rem should be marked as a document',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview the document-status change without mutating RemNote (default: true)',
      },
      expectedOldRemType: {
        type: 'string',
        enum: ['document', 'dailyDocument', 'concept', 'descriptor', 'portal', 'text'],
        description:
          'Optional stale-context guard; reject if current remType differs from this value',
      },
    },
    required: ['remId', 'isDocument'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID that was checked or changed' },
      title: { type: 'string', description: 'Rendered title/front text' },
      oldRemType: {
        type: 'string',
        description: 'Bridge remType before the requested document-status change',
      },
      newRemType: {
        type: 'string',
        description: 'Bridge remType after the change, or previewed remType for dry runs',
      },
      oldIsDocument: {
        type: 'boolean',
        description: 'Document status before the requested change',
      },
      newIsDocument: {
        type: 'boolean',
        description: 'Document status after the change, or previewed status for dry runs',
      },
      requestedIsDocument: {
        type: 'boolean',
        description: 'Requested document status',
      },
      dryRun: {
        type: 'boolean',
        description: 'Whether the request was only a preview',
      },
      changed: {
        type: 'boolean',
        description: 'Whether RemNote was actually mutated by this call',
      },
      wouldChange: {
        type: 'boolean',
        description: 'Whether the requested status differs from the current status',
      },
      sdkSupportsDocumentStatus: {
        type: 'boolean',
        description: 'Whether the bridge runtime exposes a safe SDK document-status setter',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important side-effect notes, especially around preserved card status',
      },
      cardDirectionBefore: {
        type: 'string',
        description: 'Card direction before the change when available',
      },
      cardDirectionAfter: {
        type: 'string',
        description: 'Card direction after the change when available',
      },
    },
    required: [
      'remId',
      'title',
      'oldRemType',
      'newRemType',
      'oldIsDocument',
      'newIsDocument',
      'requestedIsDocument',
      'dryRun',
      'changed',
      'wouldChange',
      'sdkSupportsDocumentStatus',
    ],
  },
};

export const INSERT_CHILDREN_TOOL = {
  name: 'remnote_insert_children',
  description:
    'Insert new child Rems under a parent at a deterministic position without replacing existing children. Use this for tag description nodes and hierarchy maintenance.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      parentRemId: {
        type: 'string',
        description: 'Parent Rem ID that will receive the new children',
      },
      content: {
        type: 'string',
        description:
          'Markdown content to insert as child Rems. Use [[id:<remId>]] for exact Rem references.',
      },
      position: {
        type: 'string',
        enum: ['first', 'last', 'before', 'after'],
        description: 'Where to insert the new child Rems',
      },
      siblingRemId: {
        type: 'string',
        description: 'Sibling Rem ID required when position is before or after',
      },
    },
    required: ['parentRemId', 'content', 'position'],
    additionalProperties: false,
  },
  outputSchema: UPDATE_NOTE_TOOL.outputSchema,
};

export const REPLACE_CHILDREN_TOOL = {
  name: 'remnote_replace_children',
  description:
    'Replace all direct children under a parent Rem. This is destructive because existing child Rem IDs are removed and may be blocked by bridge policy.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      parentRemId: {
        type: 'string',
        description: 'Parent Rem ID whose direct children will be replaced',
      },
      content: {
        type: 'string',
        description:
          'Markdown content to use as replacement children; empty string clears all direct children. Use [[id:<remId>]] for exact Rem references.',
      },
    },
    required: ['parentRemId', 'content'],
    additionalProperties: false,
  },
  outputSchema: UPDATE_NOTE_TOOL.outputSchema,
};

export const UPDATE_TAGS_TOOL = {
  name: 'remnote_update_tags',
  description:
    'Add or remove tags from a note by exact tag Rem IDs. Use this for production tagging workflows to avoid ambiguous name lookup.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID whose tags should change' },
      addTagRemIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Exact tag Rem IDs to add',
      },
      removeTagRemIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Exact tag Rem IDs to remove',
      },
    },
    required: ['remId'],
    additionalProperties: false,
  },
  outputSchema: UPDATE_NOTE_TOOL.outputSchema,
};

export const SET_PROPERTY_TOOL = {
  name: 'remnote_set_property',
  description:
    'Set or clear a tag/table property value on a Rem by exact IDs. The bridge verifies the property belongs to the supplied tag/table Rem, adds the tag idempotently, then writes the property value. For select properties, pass the option Rem ID as value.kind="rem_reference".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID whose tag property should be set' },
      tagRemId: {
        type: 'string',
        description: 'Exact tag/table Rem ID that owns the property',
      },
      propertyRemId: {
        type: 'string',
        description: 'Exact property Rem ID under the tag/table Rem',
      },
      value: {
        oneOf: [
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'text' },
              text: {
                type: 'string',
                description:
                  'Plain text or markdown property value. Use [[id:<remId>]] for exact Rem references.',
              },
            },
            required: ['kind', 'text'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'rem_reference' },
              remId: {
                type: 'string',
                description: 'Referenced Rem ID; use select-option Rem IDs here too',
              },
            },
            required: ['kind', 'remId'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'clear' },
            },
            required: ['kind'],
            additionalProperties: false,
          },
        ],
        description:
          'Property value. Use text for plain values, rem_reference for Rem references and select options, or clear to remove the value.',
      },
    },
    required: ['remId', 'tagRemId', 'propertyRemId', 'value'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remId: { type: 'string', description: 'The Rem ID whose property was set' },
      tagRemId: { type: 'string', description: 'Exact tag/table Rem ID' },
      propertyRemId: { type: 'string', description: 'Exact property Rem ID' },
      valueKind: {
        type: 'string',
        enum: ['text', 'rem_reference', 'clear'],
        description: 'The value payload kind applied by the bridge',
      },
    },
    required: ['remId', 'tagRemId', 'propertyRemId', 'valueKind'],
  },
};

export const APPEND_JOURNAL_TOOL = {
  name: 'remnote_append_journal',
  description:
    "Append content to today's daily document in RemNote with optional exact tag Rem IDs. Recommended preflight once per session: remnote_status.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        description:
          "Content to append to today's daily document (markdown supported). Use [[id:<remId>]] for exact Rem references.",
      },
      timestamp: { type: 'boolean', description: 'Include timestamp (default: true)' },
      tagRemIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exact tag Rem IDs to apply',
      },
    },
    required: ['content'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      remIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of created journal Rems',
      },
      titles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Extracted text for created Rems',
      },
    },
    required: ['remIds', 'titles'],
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
        description: 'Whether bridge allows write actions',
      },
      acceptReplaceOperation: {
        type: 'boolean',
        description: 'Whether bridge allows remnote_replace_children operations',
      },
      message: {
        type: 'string',
        description: 'Connection status message (for disconnected states)',
      },
    },
    required: ['connected', 'serverVersion'],
  },
};

export const READ_TABLE_TOOL = {
  name: 'remnote_read_table',
  description:
    'Read an Advanced Table from RemNote by exact title or Rem ID. Returns the table schema (columns with property types) and row data (cell values). Use this when you need structured tabular data. For simple tag-based queries without table structure, prefer remnote_search_by_tag.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tableRemId: {
        type: 'string',
        description: 'Table Rem ID',
      },
      tableTitle: {
        type: 'string',
        description: 'Exact Advanced Table title',
      },
      limit: {
        type: 'number',
        description: 'Maximum rows to return (1-150, default: 50)',
      },
      offset: {
        type: 'number',
        description: '0-based row offset for pagination (default: 0)',
      },
      propertyFilter: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only return these property/column names (all if omitted)',
      },
    },
    description: 'Provide exactly one of tableRemId or tableTitle.',
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      tableId: { type: 'string', description: 'Rem ID of the table/tag' },
      tableName: { type: 'string', description: 'Display name of the table' },
      columns: {
        type: 'array',
        description: 'Table columns (properties)',
        items: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'Property Rem ID' },
            name: { type: 'string', description: 'Column/property name' },
            type: {
              type: 'string',
              description:
                'Property type (text, number, date, checkbox, single_select, multi_select, url, etc.)',
            },
          },
          required: ['propertyId', 'name', 'type'],
        },
      },
      rows: {
        type: 'array',
        description: 'Table rows with cell values',
        items: {
          type: 'object',
          properties: {
            remId: { type: 'string', description: 'Row Rem ID' },
            name: { type: 'string', description: 'Row name (first column / Rem text)' },
            values: {
              type: 'object',
              description: 'Cell values keyed by propertyId',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['remId', 'name', 'values'],
        },
      },
      totalRows: { type: 'number', description: 'Total number of rows in the table' },
      rowsReturned: { type: 'number', description: 'Number of rows returned in this response' },
    },
    required: ['tableId', 'tableName', 'columns', 'rows', 'totalRows', 'rowsReturned'],
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
              contentMode: { type: 'string' },
              view: { type: 'string' },
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

export const ALL_TOOLS = [
  CREATE_NOTE_TOOL,
  SEARCH_TOOL,
  SEARCH_BY_TAG_TOOL,
  READ_NOTE_TOOL,
  LIST_CHILDREN_TOOL,
  UPDATE_NOTE_TOOL,
  SET_DOCUMENT_STATUS_TOOL,
  MOVE_NOTE_TOOL,
  INSERT_CHILDREN_TOOL,
  REPLACE_CHILDREN_TOOL,
  UPDATE_TAGS_TOOL,
  SET_PROPERTY_TOOL,
  APPEND_JOURNAL_TOOL,
  PLAYBOOK_TOOL,
  STATUS_TOOL,
  READ_TABLE_TOOL,
] as const;

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

        case 'remnote_search': {
          const args = SearchSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('search', args);
          break;
        }

        case 'remnote_search_by_tag': {
          const args = SearchByTagSchema.parse(request.params.arguments);
          const { timeoutMs, ...payload } = args;
          result = await wsServer.sendRequest('search_by_tag', payload, timeoutMs);
          break;
        }

        case 'remnote_read_note': {
          const args = ReadNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('read_note', args);
          break;
        }

        case 'remnote_list_children': {
          const args = ListChildrenSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('list_children', args);
          break;
        }

        case 'remnote_update_note': {
          const args = UpdateNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('update_note', args);
          break;
        }

        case 'remnote_set_document_status': {
          const args = SetDocumentStatusSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('set_document_status', args);
          break;
        }

        case 'remnote_insert_children': {
          const args = InsertChildrenSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('insert_children', args);
          break;
        }

        case 'remnote_move_note': {
          const args = MoveNoteSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('move_note', args);
          break;
        }

        case 'remnote_replace_children': {
          const args = ReplaceChildrenSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('replace_children', args);
          break;
        }

        case 'remnote_update_tags': {
          const args = UpdateTagsSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('update_tags', args);
          break;
        }

        case 'remnote_set_property': {
          const args = SetPropertySchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('set_property', args);
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
            playbookVersion: '1.7.0',
            summary:
              'Use this playbook to check RemNote connection and write gates, navigate by remId with paged search/read/list workflows, request nearby ancestors when hierarchy context matters, choose compact/full output views, and apply safe exact-ID writes including inline [[id:<remId>]] references, tag property values, and dry-run-first document status changes.',
            recommendedStatusCheck: {
              tool: 'remnote_status',
              cadence: 'recommended once per session and before risky writes',
              rationale:
                'status exposes connection health, version compatibility warnings, and write-policy gates',
            },
            decisionTree: [
              'Need connection/capability context? Call remnote_status first.',
              'Need to orient across the KB? Use remnote_search with contentMode="structured", view="compact", depth=1, childLimit=500.',
              'Need broad search enumeration? Continue remnote_search or remnote_search_by_tag with nextCursor while hasMore is true.',
              'Need to search within a specific branch? Use remnote_search with parentRemId; keep the same parentRemId when continuing with nextCursor.',
              'Need tagged-note context/navigation? Use remnote_search_by_tag with tagRemId and default resultMode="context"; inspect matchedRems to see the direct tagged Rems behind each context result.',
              'Need hierarchy placement context? Add ancestorDepth, typically 5, to search/read/search_by_tag/list_children; ancestors are direct-parent first.',
              'Need strict tag verification? Use remnote_search_by_tag with resultMode="tagged", or verify the exact Rem in matchedRems from context mode.',
              'Need a large tag search to finish? Prefer cursor paging first; use remnote_search_by_tag.timeoutMs only as a bounded wait-time escape hatch.',
              'Need to traverse a specific branch cheaply? Use remnote_list_children on the parentRemId and page through direct children.',
              'Need to read a selected subtree? Use remnote_read_note on a chosen remId with contentMode="structured", depth=1, childLimit=500, then deepen selected branches.',
              'Need to follow inline graph references? Inspect inlineRefs on search/read results and structured child nodes for exact target Rem IDs.',
              'Need tabular/structured data from an Advanced Table? Use remnote_read_table with either tableTitle or tableRemId. Use propertyFilter to limit columns for large tables.',
              'Need a human-readable summary? Switch to contentMode="markdown" on search/read results.',
              'Need to rename a note? Use remnote_update_note with remId and title only; use [[id:<remId>]] inside the title for exact inline Rem references.',
              'Need to create a note? Use remnote_create_note; pass tagRemIds for exact-ID tag assignment, [[id:<remId>]] for exact inline Rem references, and asDocument=true when the title/root Rem should be a document.',
              'Need to mark an existing Rem as a document? Use remnote_set_document_status dryRun first, include expectedOldRemType for stale-context protection, then rerun with dryRun=false after approval.',
              'Need to append to today journal? Use remnote_append_journal; pass tagRemIds when the journal entry should be tagged and [[id:<remId>]] for exact inline Rem references.',
              'Need to insert children? Use remnote_insert_children with an explicit position; use [[id:<remId>]] for exact inline Rem references.',
              'Need to move a note? Use remnote_move_note dryRun first, include expectedOldParentRemId for stale-context protection, then rerun with dryRun=false after approval.',
              'Need to replace children? Check remnote_status first; remnote_replace_children requires acceptReplaceOperation=true and supports [[id:<remId>]] for exact inline Rem references.',
              'Need to update tags on an existing note? Use remnote_update_tags with exact tag Rem IDs.',
              'Need to set a tag/table property value? Use remnote_set_property with exact remId, tagRemId, propertyRemId, and a text/rem_reference/clear value payload. For select properties, pass the option Rem ID as rem_reference.remId; for inline references in text values, use [[id:<remId>]].',
            ],
            navigationPresets: {
              orientation: NAVIGATION_PRESET,
              branchTraversal: NAVIGATION_PRESET,
            },
            contentModes: {
              structured:
                'ID-first traversal mode. Returns contentStructured with child remIds and inlineRefs for deterministic follow-up reads.',
              markdown:
                'Summary mode. Returns rendered markdown content for human-facing synthesis; inline Rem references render as [[Target Title]].',
              none: 'Metadata-only mode when content is not needed.',
            },
            outputViews: {
              compact:
                'Small metadata surface for broad discovery. Omits tags, aliases, inlineRefs, and diagnostic fields unless another option requires them.',
              standard: 'Normal discovery metadata for most agent workflows.',
              full: 'Verbose metadata for diagnostics or detailed audits.',
            },
            writePolicy: {
              statusTool: 'remnote_status',
              requiredFields: ['acceptWriteOperations', 'acceptReplaceOperation'],
              guidance: [
                'Create/update/insert/replace/tag/journal writes require acceptWriteOperations=true.',
                'remnote_update_note is metadata-only; use insert_children, replace_children, and update_tags for structural or tag writes.',
                'remnote_set_document_status changes only document status; it preserves concept/card status and defaults to dryRun=true.',
                'remnote_replace_children requires acceptReplaceOperation=true.',
                'remnote_insert_children preserves existing child Rem IDs; remnote_replace_children removes them.',
                'remnote_move_note preserves the moved Rem ID and subtree; dryRun defaults to true.',
                'All production tag writes use exact tag Rem IDs: create_note.tagRemIds, append_journal.tagRemIds, and update_tags add/remove arrays.',
                'Markdown-capable write fields support [[id:<remId>]] to create real inline references to existing Rems without name lookup.',
                'remnote_set_property writes exact-ID tag/table property values and requires acceptWriteOperations=true.',
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

        case 'remnote_read_table': {
          const args = ReadTableSchema.parse(request.params.arguments);
          result = await wsServer.sendRequest('read_table', args);
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
        structuredContent: result as { [key: string]: unknown },
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

    return { tools: [...ALL_TOOLS] };
  });
}
