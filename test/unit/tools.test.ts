/**
 * Tools unit tests
 * Tests for MCP tool registration and handler logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAllTools,
  CREATE_NOTE_TOOL,
  SEARCH_TOOL,
  SEARCH_BY_TAG_TOOL,
  READ_NOTE_TOOL,
  UPDATE_NOTE_TOOL,
  SET_DOCUMENT_STATUS_TOOL,
  LIST_CHILDREN_TOOL,
  INSERT_CHILDREN_TOOL,
  MOVE_NOTE_TOOL,
  REPLACE_CHILDREN_TOOL,
  UPDATE_TAGS_TOOL,
  SET_PROPERTY_TOOL,
  APPEND_JOURNAL_TOOL,
  PLAYBOOK_TOOL,
  STATUS_TOOL,
  READ_TABLE_TOOL,
  ALL_TOOLS,
} from '../../src/tools/index.js';
import { WebSocketServer } from '../../src/websocket-server.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  validCreateNoteInput,
  validSearchInput,
  validSearchByTagInput,
  validReadNoteInput,
  validUpdateNoteInput,
  validSetDocumentStatusInput,
  validInsertChildrenInput,
  validReplaceChildrenInput,
  validUpdateTagsInput,
  validSetPropertyInput,
  validAppendJournalInput,
  validReadTableInput,
  sampleMutatingResult,
  sampleNoteResult,
  sampleSearchResults,
  sampleStatusResult,
  sampleTableResult,
} from '../helpers/fixtures.js';
import { createMockLogger } from '../setup.js';

// Mock MCP Server
class MockMCPServer {
  private handlers = new Map<unknown, (request: unknown) => Promise<unknown>>();

  setRequestHandler(schema: unknown, handler: (request: unknown) => Promise<unknown>) {
    this.handlers.set(schema, handler);
  }

  async callHandler(schema: unknown, request: unknown): Promise<unknown> {
    const handler = this.handlers.get(schema);
    if (!handler) {
      throw new Error(`No handler registered for schema`);
    }
    return handler(request);
  }

  hasHandler(schema: unknown): boolean {
    return this.handlers.has(schema);
  }
}

type ToolSuccessResult = {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function expectStructuredToolResult(result: ToolSuccessResult, expected: Record<string, unknown>) {
  expect(result.isError).toBeUndefined();
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  expect(JSON.parse(result.content[0].text)).toEqual(expected);
  expect(result.structuredContent).toEqual(expected);
}

describe('Tool Definitions', () => {
  it('should advertise OpenAI-compatible top-level input schemas', () => {
    // OpenAI/Codex rejects MCP tool input schemas with top-level JSON Schema
    // composition keywords. Keep runtime-only constraints in Zod schemas instead.
    const disallowedTopLevelKeywords = ['anyOf', 'oneOf', 'allOf', 'enum', 'not'];

    for (const tool of ALL_TOOLS) {
      const schema = tool.inputSchema as Record<string, unknown>;

      expect(schema.type, `${tool.name} inputSchema.type`).toBe('object');
      expect(schema.properties, `${tool.name} inputSchema.properties`).toBeDefined();
      for (const keyword of disallowedTopLevelKeywords) {
        expect(schema, `${tool.name} inputSchema top-level ${keyword}`).not.toHaveProperty(keyword);
      }
    }
  });

  it('should have correct name for CREATE_NOTE_TOOL', () => {
    expect(CREATE_NOTE_TOOL.name).toBe('remnote_create_note');
  });

  it('should allow optional title field for CREATE_NOTE_TOOL', () => {
    expect(CREATE_NOTE_TOOL.inputSchema.required).not.toContain('title');
  });

  it('should advertise exact tag Rem IDs for CREATE_NOTE_TOOL', () => {
    const properties = CREATE_NOTE_TOOL.inputSchema.properties as Record<string, unknown>;
    expect(properties.tagRemIds).toBeDefined();
    expect(properties.tags).toBeUndefined();
  });

  it('should advertise optional asDocument for CREATE_NOTE_TOOL', () => {
    const properties = CREATE_NOTE_TOOL.inputSchema.properties as Record<string, unknown>;
    expect(properties.asDocument).toBeDefined();
  });

  it('should have correct name for SEARCH_TOOL', () => {
    expect(SEARCH_TOOL.name).toBe('remnote_search');
  });

  it('should have required query field for SEARCH_TOOL', () => {
    expect(SEARCH_TOOL.inputSchema.required).toContain('query');
  });

  it('should have correct name for SEARCH_BY_TAG_TOOL', () => {
    expect(SEARCH_BY_TAG_TOOL.name).toBe('remnote_search_by_tag');
  });

  it('should have required tagRemId field for SEARCH_BY_TAG_TOOL', () => {
    expect(SEARCH_BY_TAG_TOOL.inputSchema.required).toContain('tagRemId');
    expect(SEARCH_BY_TAG_TOOL.inputSchema.properties).toHaveProperty('tagRemId');
    expect(SEARCH_BY_TAG_TOOL.inputSchema.properties).toHaveProperty('resultMode');
    expect(SEARCH_BY_TAG_TOOL.inputSchema.properties).not.toHaveProperty('tag');
  });

  it('should advertise direct tag-match metadata for SEARCH_BY_TAG_TOOL', () => {
    const resultProps = ((
      SEARCH_BY_TAG_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;

    expect(resultProps).toHaveProperty('matchedRems');
    expect(resultProps).toHaveProperty('contextRemId');
    expect(resultProps).toHaveProperty('contextTitle');
    expect(resultProps).toHaveProperty('contextReason');
  });

  it('should advertise structured search content mode and contentStructured output', () => {
    const contentMode = (
      SEARCH_TOOL.inputSchema.properties.contentMode as {
        enum?: string[];
      }
    ).enum;
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;

    expect(contentMode).toContain('structured');
    expect(searchResultProps.contentStructured).toBeDefined();
  });

  it('should advertise structured child nodes with optional children arrays', () => {
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;
    const searchChildSchema = (
      searchResultProps.contentStructured as {
        items?: { properties?: Record<string, unknown>; required?: string[] };
      }
    ).items;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;
    const readChildSchema = (
      readProps.contentStructured as {
        items?: { properties?: Record<string, unknown>; required?: string[] };
      }
    ).items;

    for (const schema of [searchChildSchema, readChildSchema]) {
      expect(schema?.properties).toHaveProperty('children');
      expect(schema?.required).toEqual(['remId', 'title', 'headline', 'remType']);
      expect(schema?.required).not.toContain('children');
    }
  });

  it('should advertise cursor paging for SEARCH_TOOL and SEARCH_BY_TAG_TOOL', () => {
    const outputProps = SEARCH_TOOL.outputSchema.properties as Record<string, unknown>;
    const searchByTagOutputProps = SEARCH_BY_TAG_TOOL.outputSchema.properties as Record<
      string,
      unknown
    >;

    expect(SEARCH_TOOL.inputSchema.properties).toHaveProperty('cursor');
    expect(SEARCH_BY_TAG_TOOL.inputSchema.properties).toHaveProperty('cursor');
    expect(SEARCH_BY_TAG_TOOL.inputSchema.properties).toHaveProperty('timeoutMs');
    expect(outputProps).toHaveProperty('hasMore');
    expect(outputProps).toHaveProperty('nextCursor');
    expect(outputProps).toHaveProperty('truncated');
    expect(outputProps).toHaveProperty('truncationReason');
    expect(searchByTagOutputProps).toHaveProperty('hasMore');
    expect(searchByTagOutputProps).toHaveProperty('nextCursor');
    expect(searchByTagOutputProps).toHaveProperty('truncated');
    expect(searchByTagOutputProps).toHaveProperty('truncationReason');
  });

  it('should not advertise detail in search/read output schemas', () => {
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;

    expect(searchResultProps.detail).toBeUndefined();
    expect(readProps.detail).toBeUndefined();
  });

  it('should advertise parent context fields in search/read output schemas', () => {
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;

    expect(searchResultProps.parentRemId).toBeDefined();
    expect(searchResultProps.parentTitle).toBeDefined();
    expect(searchResultProps.ancestors).toBeDefined();
    expect(searchResultProps.ancestorsTruncated).toBeDefined();
    expect(readProps.parentRemId).toBeDefined();
    expect(readProps.parentTitle).toBeDefined();
    expect(readProps.ancestors).toBeDefined();
    expect(readProps.ancestorsTruncated).toBeDefined();
  });

  it('should advertise tag fields in search/read output schemas', () => {
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;
    const searchChildProps = ((
      searchResultProps.contentStructured as { items?: { properties?: Record<string, unknown> } }
    )?.items?.properties ?? {}) as Record<string, unknown>;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;
    const readChildProps = ((
      readProps.contentStructured as { items?: { properties?: Record<string, unknown> } }
    )?.items?.properties ?? {}) as Record<string, unknown>;

    expect(searchResultProps.tags).toBeDefined();
    expect(searchChildProps.tags).toBeDefined();
    expect(readProps.tags).toBeDefined();
    expect(readChildProps.tags).toBeDefined();
    expect(
      (
        (searchResultProps.tags as { items?: { properties?: Record<string, unknown> } }).items
          ?.properties ?? {}
      ).tagRemId
    ).toBeDefined();
    expect(
      (
        (searchResultProps.tags as { items?: { properties?: Record<string, unknown> } }).items
          ?.properties ?? {}
      ).name
    ).toBeDefined();
  });

  it('should advertise inline Rem reference metadata in search/read output schemas', () => {
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;
    const searchChildProps = ((
      searchResultProps.contentStructured as { items?: { properties?: Record<string, unknown> } }
    )?.items?.properties ?? {}) as Record<string, unknown>;
    const matchedRemProps = ((
      searchResultProps.matchedRems as { items?: { properties?: Record<string, unknown> } }
    )?.items?.properties ?? {}) as Record<string, unknown>;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;
    const readChildProps = ((
      readProps.contentStructured as { items?: { properties?: Record<string, unknown> } }
    )?.items?.properties ?? {}) as Record<string, unknown>;

    expect(searchResultProps.inlineRefs).toBeDefined();
    expect(searchChildProps.inlineRefs).toBeDefined();
    expect(matchedRemProps.inlineRefs).toBeDefined();
    expect(readProps.inlineRefs).toBeDefined();
    expect(readChildProps.inlineRefs).toBeDefined();
    expect(
      (
        (readProps.inlineRefs as { items?: { properties?: Record<string, unknown> } }).items
          ?.properties ?? {}
      ).targetRemId
    ).toBeDefined();
  });

  it('should have correct name for READ_NOTE_TOOL', () => {
    expect(READ_NOTE_TOOL.name).toBe('remnote_read_note');
  });

  it('should have required remId field for READ_NOTE_TOOL', () => {
    expect(READ_NOTE_TOOL.inputSchema.required).toContain('remId');
  });

  it('should advertise structured read content mode and contentStructured output', () => {
    const contentMode = (
      READ_NOTE_TOOL.inputSchema.properties.contentMode as {
        enum?: string[];
      }
    ).enum;
    const readProps = (READ_NOTE_TOOL.outputSchema.properties ?? {}) as Record<string, unknown>;

    expect(contentMode).toContain('structured');
    expect(readProps.contentStructured).toBeDefined();
  });

  it('should have correct name for UPDATE_NOTE_TOOL', () => {
    expect(UPDATE_NOTE_TOOL.name).toBe('remnote_update_note');
  });

  it('should have required remId field for UPDATE_NOTE_TOOL', () => {
    expect(UPDATE_NOTE_TOOL.inputSchema.required).toContain('remId');
    expect(UPDATE_NOTE_TOOL.inputSchema.required).toContain('title');
  });

  it('should not advertise old mixed update fields in UPDATE_NOTE_TOOL input schema', () => {
    const properties = UPDATE_NOTE_TOOL.inputSchema.properties as Record<string, unknown>;
    expect(properties.appendContent).toBeUndefined();
    expect(properties.replaceContent).toBeUndefined();
    expect(properties.addTags).toBeUndefined();
    expect(properties.removeTags).toBeUndefined();
  });

  it('should advertise document status mutation as a dry-run-first tool', () => {
    expect(SET_DOCUMENT_STATUS_TOOL.name).toBe('remnote_set_document_status');
    expect(SET_DOCUMENT_STATUS_TOOL.inputSchema.required).toEqual(['remId', 'isDocument']);
    expect(SET_DOCUMENT_STATUS_TOOL.inputSchema.properties).toHaveProperty('dryRun');
    expect(SET_DOCUMENT_STATUS_TOOL.inputSchema.properties).toHaveProperty('expectedOldRemType');
    expect(SET_DOCUMENT_STATUS_TOOL.outputSchema.required).toContain('wouldChange');
  });

  it('should expose split write tools', () => {
    expect(LIST_CHILDREN_TOOL.name).toBe('remnote_list_children');
    expect(INSERT_CHILDREN_TOOL.name).toBe('remnote_insert_children');
    expect(MOVE_NOTE_TOOL.name).toBe('remnote_move_note');
    expect(SET_DOCUMENT_STATUS_TOOL.name).toBe('remnote_set_document_status');
    expect(REPLACE_CHILDREN_TOOL.name).toBe('remnote_replace_children');
    expect(UPDATE_TAGS_TOOL.name).toBe('remnote_update_tags');
    expect(SET_PROPERTY_TOOL.name).toBe('remnote_set_property');
  });

  it('should advertise insert children as a plain top-level object schema', () => {
    const schema = INSERT_CHILDREN_TOOL.inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.properties.siblingRemId).toBeDefined();
    expect(schema.required).toEqual(['parentRemId', 'content', 'position']);
  });

  it('should advertise tag mutation arrays without top-level composition keywords', () => {
    const schema = UPDATE_TAGS_TOOL.inputSchema as {
      properties: Record<string, { minItems?: number }>;
      required: string[];
    };

    expect(schema.required).toEqual(['remId']);
    expect(schema.properties.addTagRemIds.minItems).toBe(1);
    expect(schema.properties.removeTagRemIds.minItems).toBe(1);
  });

  it('should have plural remIds and titles in UPDATE_NOTE_TOOL output schema', () => {
    const properties = UPDATE_NOTE_TOOL.outputSchema.properties as Record<string, unknown>;
    expect(properties.remIds).toBeDefined();
    expect(properties.titles).toBeDefined();
  });

  it('should have correct name for APPEND_JOURNAL_TOOL', () => {
    expect(APPEND_JOURNAL_TOOL.name).toBe('remnote_append_journal');
  });

  it('should have required content field for APPEND_JOURNAL_TOOL', () => {
    expect(APPEND_JOURNAL_TOOL.inputSchema.required).toContain('content');
  });

  it('should advertise exact tag Rem IDs for APPEND_JOURNAL_TOOL', () => {
    const properties = APPEND_JOURNAL_TOOL.inputSchema.properties as Record<string, unknown>;
    expect(properties.tagRemIds).toBeDefined();
    expect(properties.tags).toBeUndefined();
  });

  it('should have plural remIds and titles in APPEND_JOURNAL_TOOL output schema', () => {
    const properties = APPEND_JOURNAL_TOOL.outputSchema.properties as Record<string, unknown>;
    expect(properties.remIds).toBeDefined();
    expect(properties.titles).toBeDefined();
  });

  it('should have correct name for STATUS_TOOL', () => {
    expect(STATUS_TOOL.name).toBe('remnote_status');
  });

  it('should have no required fields for STATUS_TOOL', () => {
    expect(STATUS_TOOL.inputSchema.required || []).toHaveLength(0);
  });

  it('should have correct name for PLAYBOOK_TOOL', () => {
    expect(PLAYBOOK_TOOL.name).toBe('remnote_get_playbook');
  });

  it('should have no required fields for PLAYBOOK_TOOL', () => {
    expect(PLAYBOOK_TOOL.inputSchema.required || []).toHaveLength(0);
  });

  it('should have correct name for READ_TABLE_TOOL', () => {
    expect(READ_TABLE_TOOL.name).toBe('remnote_read_table');
  });

  it('should document explicit identifier fields for READ_TABLE_TOOL', () => {
    expect(READ_TABLE_TOOL.inputSchema.properties.tableRemId).toBeDefined();
    expect(READ_TABLE_TOOL.inputSchema.properties.tableTitle).toBeDefined();
  });

  it('should have correct output schema for READ_TABLE_TOOL', () => {
    const properties = READ_TABLE_TOOL.outputSchema.properties as Record<string, unknown>;
    expect(properties.tableId).toBeDefined();
    expect(properties.tableName).toBeDefined();
    expect(properties.columns).toBeDefined();
    expect(properties.rows).toBeDefined();
    expect(properties.totalRows).toBeDefined();
    expect(properties.rowsReturned).toBeDefined();
  });
});

describe('Tool Registration', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: WebSocketServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {} as WebSocketServer; // We'll mock methods as needed
  });

  it('should register CallTool handler', () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());
    expect(mockServer.hasHandler(CallToolRequestSchema)).toBe(true);
  });

  it('should register ListTools handler', () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());
    expect(mockServer.hasHandler(ListToolsRequestSchema)).toBe(true);
  });

  it('should return all 16 tools in list', async () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());

    const result = (await mockServer.callHandler(ListToolsRequestSchema, {})) as {
      tools: unknown[];
    };

    expect(result.tools).toHaveLength(16);
  });

  it('should include all tool names in list', async () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());

    const result = (await mockServer.callHandler(ListToolsRequestSchema, {})) as {
      tools: { name: string }[];
    };

    const names = result.tools.map((t) => t.name);
    expect(names).toContain('remnote_create_note');
    expect(names).toContain('remnote_search');
    expect(names).toContain('remnote_search_by_tag');
    expect(names).toContain('remnote_read_note');
    expect(names).toContain('remnote_update_note');
    expect(names).toContain('remnote_set_document_status');
    expect(names).toContain('remnote_insert_children');
    expect(names).toContain('remnote_replace_children');
    expect(names).toContain('remnote_update_tags');
    expect(names).toContain('remnote_set_property');
    expect(names).toContain('remnote_append_journal');
    expect(names).toContain('remnote_get_playbook');
    expect(names).toContain('remnote_status');
    expect(names).toContain('remnote_read_table');
  });
});

describe('Tool Handlers - create_note', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleNoteResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with create_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_create_note', arguments: validCreateNoteInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('create_note', validCreateNoteInput);
  });

  it('should return formatted JSON result', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_create_note', arguments: validCreateNoteInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleNoteResult);
  });

  it('should allow input without title', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_create_note', arguments: { content: '- item' } },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBeUndefined();
    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('create_note', { content: '- item' });
  });

  it('should forward asDocument to the bridge', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_create_note',
        arguments: { ...validCreateNoteInput, asDocument: true },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('create_note', {
      ...validCreateNoteInput,
      asDocument: true,
    });
  });
});

describe('Tool Handlers - search', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleSearchResults),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with search action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      ...validSearchInput,
      depth: 1,
      childLimit: 20,
      maxContentLength: 3000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should return formatted JSON result', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleSearchResults);
  });

  it('should apply default values from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: { query: 'test' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      limit: 50, // default
      contentMode: 'none', // default
      depth: 1, // default
      childLimit: 20, // default
      maxContentLength: 3000, // default
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should pass through contentMode structured', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search',
        arguments: { query: 'test', contentMode: 'structured', depth: 2 },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      limit: 50,
      contentMode: 'structured',
      depth: 2,
      childLimit: 20,
      maxContentLength: 3000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should pass through cursor', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search',
        arguments: { query: 'test', limit: 25, cursor: 'search:v1:id:25:hash' },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      limit: 25,
      cursor: 'search:v1:id:25:hash',
      contentMode: 'none',
      depth: 1,
      childLimit: 20,
      maxContentLength: 3000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should pass through parentRemId', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search',
        arguments: { query: 'test', parentRemId: 'some-parent-rem-id' },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      parentRemId: 'some-parent-rem-id',
      limit: 50,
      contentMode: 'none',
      depth: 1,
      childLimit: 20,
      maxContentLength: 3000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });
});

describe('Tool Handlers - search_by_tag', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleSearchResults),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with search_by_tag action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search_by_tag', arguments: validSearchByTagInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'search_by_tag',
      {
        ...validSearchByTagInput,
        depth: 1,
        childLimit: 20,
        maxContentLength: 3000,
        ancestorDepth: 0,
        view: 'standard',
      },
      undefined
    );
  });

  it('should apply default values from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search_by_tag', arguments: { tagRemId: 'daily-tag-rem-id' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'search_by_tag',
      {
        tagRemId: 'daily-tag-rem-id',
        resultMode: 'context',
        limit: 50,
        contentMode: 'none',
        depth: 1,
        childLimit: 20,
        maxContentLength: 3000,
        ancestorDepth: 0,
        view: 'standard',
      },
      undefined
    );
  });

  it('should pass through tagged resultMode', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search_by_tag',
        arguments: { tagRemId: 'daily-tag-rem-id', resultMode: 'tagged' },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'search_by_tag',
      {
        tagRemId: 'daily-tag-rem-id',
        resultMode: 'tagged',
        limit: 50,
        contentMode: 'none',
        depth: 1,
        childLimit: 20,
        maxContentLength: 3000,
        ancestorDepth: 0,
        view: 'standard',
      },
      undefined
    );
  });

  it('should pass through cursor and use timeoutMs as request timeout only', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search_by_tag',
        arguments: {
          tagRemId: 'daily-tag-rem-id',
          cursor: 'search_by_tag:v1:id:2:hash',
          timeoutMs: 30000,
        },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'search_by_tag',
      {
        tagRemId: 'daily-tag-rem-id',
        resultMode: 'context',
        limit: 50,
        cursor: 'search_by_tag:v1:id:2:hash',
        contentMode: 'none',
        depth: 1,
        childLimit: 20,
        maxContentLength: 3000,
        ancestorDepth: 0,
        view: 'standard',
      },
      30000
    );
  });

  it('should return structuredContent for tag search results', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search_by_tag', arguments: validSearchByTagInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleSearchResults);
  });
});

describe('Tool Handlers - read_note', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };
  const sampleReadNoteResult = {
    remId: 'rem-id-123',
    title: 'Root Note',
    headline: 'Root Note',
    tags: [{ tagRemId: 'tag-project', name: 'project' }],
    remType: 'document',
    content: '- Child note',
    contentProperties: {
      childrenRendered: 1,
      childrenTotal: 1,
      contentTruncated: false,
    },
  };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleReadNoteResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with read_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_note', arguments: validReadNoteInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_note', {
      ...validReadNoteInput,
      contentMode: 'markdown',
      childLimit: 100,
      maxContentLength: 100000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should apply default depth from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_note', arguments: { remId: 'rem-123' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_note', {
      remId: 'rem-123',
      depth: 5, // default
      contentMode: 'markdown', // default
      childLimit: 100, // default
      maxContentLength: 100000, // default
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should pass through contentMode structured', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_read_note',
        arguments: { remId: 'rem-123', contentMode: 'structured', depth: 2 },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_note', {
      remId: 'rem-123',
      depth: 2,
      contentMode: 'structured',
      childLimit: 100,
      maxContentLength: 100000,
      ancestorDepth: 0,
      view: 'standard',
    });
  });

  it('should return nested read_note content in structuredContent without colliding with MCP content', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_note', arguments: validReadNoteInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleReadNoteResult);
    expect(result.structuredContent?.content).toBe('- Child note');
    expect(Array.isArray(result.content)).toBe(true);
  });
});

describe('Tool Handlers - update_note', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleMutatingResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with update_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_update_note', arguments: validUpdateNoteInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('update_note', validUpdateNoteInput);
  });

  it('should return formatted JSON result with plural fields', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_update_note', arguments: validUpdateNoteInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleMutatingResult);
  });

  it('should reject old mixed update fields', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_update_note',
        arguments: {
          remId: 'rem-456',
          appendContent: 'append',
          replaceContent: 'replace',
        },
      },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unrecognized');
  });
});

describe('Tool Handlers - set_document_status', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };
  const sampleSetDocumentStatusResult = {
    remId: 'rem-id-456',
    title: 'Updated Title',
    oldRemType: 'concept',
    newRemType: 'document',
    oldIsDocument: false,
    newIsDocument: true,
    requestedIsDocument: true,
    dryRun: false,
    changed: true,
    wouldChange: true,
    sdkSupportsDocumentStatus: true,
  };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleSetDocumentStatusResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with set_document_status action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_set_document_status', arguments: validSetDocumentStatusInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'set_document_status',
      validSetDocumentStatusInput
    );
  });

  it('should default dryRun to true before forwarding', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_set_document_status',
        arguments: { remId: 'rem-id-456', isDocument: true },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('set_document_status', {
      remId: 'rem-id-456',
      isDocument: true,
      dryRun: true,
    });
  });

  it('should return formatted JSON result', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_set_document_status', arguments: validSetDocumentStatusInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleSetDocumentStatusResult);
  });

  it('should reject unknown fields', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_set_document_status',
        arguments: {
          remId: 'rem-id-456',
          isDocument: true,
          remType: 'document',
        },
      },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unrecognized');
  });
});

describe('Tool Handlers - list_children', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue({ children: [], hasMore: false, totalChildren: 0 }),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with list_children action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_list_children',
        arguments: { parentRemId: 'parent', limit: 10, ancestorDepth: 2 },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('list_children', {
      parentRemId: 'parent',
      limit: 10,
      ancestorDepth: 2,
      view: 'compact',
    });
  });
});

describe('Tool Handlers - split write tools', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleMutatingResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with insert_children action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_insert_children', arguments: validInsertChildrenInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'insert_children',
      validInsertChildrenInput
    );
  });

  it('should call wsServer.sendRequest with replace_children action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_replace_children', arguments: validReplaceChildrenInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'replace_children',
      validReplaceChildrenInput
    );
  });

  it('should call wsServer.sendRequest with update_tags action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_update_tags', arguments: validUpdateTagsInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('update_tags', validUpdateTagsInput);
  });

  it('should call wsServer.sendRequest with set_property action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_set_property', arguments: validSetPropertyInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('set_property', validSetPropertyInput);
  });

  it('should call wsServer.sendRequest with move_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_move_note',
        arguments: {
          remId: 'child',
          newParentRemId: 'parent',
          expectedOldParentRemId: 'old-parent',
          ancestorDepth: 2,
        },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('move_note', {
      remId: 'child',
      newParentRemId: 'parent',
      position: 'last',
      dryRun: true,
      expectedOldParentRemId: 'old-parent',
      ancestorDepth: 2,
    });
  });

  it('should reject insert before without siblingRemId', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_insert_children',
        arguments: { parentRemId: 'parent', content: 'Inserted', position: 'before' },
      },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('siblingRemId is required when position is before');
  });
});

describe('Tool Handlers - append_journal', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleMutatingResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with append_journal action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_append_journal', arguments: validAppendJournalInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith(
      'append_journal',
      validAppendJournalInput
    );
  });

  it('should apply default timestamp from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_append_journal', arguments: { content: 'test' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('append_journal', {
      content: 'test',
      timestamp: true, // default
    });
  });

  it('should return formatted JSON result with plural fields', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_append_journal', arguments: validAppendJournalInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleMutatingResult);
  });
});

describe('Tool Handlers - read_table', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleTableResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with read_table action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_table', arguments: validReadTableInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_table', {
      ...validReadTableInput,
      limit: 50,
      offset: 0,
    });
  });

  it('should apply default values from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_table', arguments: { tableTitle: 'My Table' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 50, // default
      offset: 0, // default
    });
  });

  it('should return formatted JSON result', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_table', arguments: validReadTableInput },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, sampleTableResult);
  });

  it('should pass through propertyFilter', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_read_table',
        arguments: { tableTitle: 'My Table', propertyFilter: ['Name', 'Status'] },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 50,
      offset: 0,
      propertyFilter: ['Name', 'Status'],
    });
  });
});

describe('Tool Handlers - status', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: {
    sendRequest: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getServerVersion: ReturnType<typeof vi.fn>;
    getBridgeVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleStatusResult),
      isConnected: vi.fn().mockReturnValue(true),
      getServerVersion: vi.fn().mockReturnValue('0.5.1'),
      getBridgeVersion: vi.fn().mockReturnValue('0.5.0'),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should check connection before sending request', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    });

    expect(mockWsServer.isConnected).toHaveBeenCalled();
  });

  it('should call wsServer.sendRequest when connected', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('get_status', {});
  });

  it('should return disconnected status when not connected', async () => {
    mockWsServer.isConnected.mockReturnValue(false);

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, {
      connected: false,
      serverVersion: '0.5.1',
      message: 'RemNote plugin not connected',
    });
  });

  it('should include connected: true in response when connected', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.connected).toBe(true);
  });

  it('should merge status result with connected: true', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expectStructuredToolResult(result, {
      connected: true,
      serverVersion: '0.5.1',
      ...sampleStatusResult,
    });
  });

  it('should include version_warning when bridge version mismatches', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue('0.6.0');

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.version_warning).toContain('Version mismatch');
  });

  it('should not include version_warning when versions are compatible', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.version_warning).toBeUndefined();
  });

  it('should not include version_warning when bridge version is null', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue(null);

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.version_warning).toBeUndefined();
  });

  it('should include version_warning when bridge version is null but pluginVersion in result mismatches', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue(null);
    mockWsServer.getServerVersion.mockReturnValue('0.6.0');
    mockWsServer.sendRequest.mockResolvedValue({ pluginVersion: '0.5.0' });

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.version_warning).toContain('Version mismatch');
  });
});

describe('Tool Handlers - get_playbook', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: {
    sendRequest: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getServerVersion: ReturnType<typeof vi.fn>;
    getBridgeVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleStatusResult),
      isConnected: vi.fn().mockReturnValue(true),
      getServerVersion: vi.fn().mockReturnValue('0.8.0'),
      getBridgeVersion: vi.fn().mockReturnValue('0.8.0'),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should return playbook with decisionTree and navigation presets', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_get_playbook', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.playbookVersion).toBe('1.7.0');
    expect(Array.isArray(result.structuredContent?.decisionTree)).toBe(true);
    expect((result.structuredContent?.decisionTree as unknown[])?.length).toBeGreaterThan(0);
    expect(result.structuredContent?.decisionTree).toContain(
      'Need to rename a note? Use remnote_update_note with remId and title only; use [[id:<remId>]] inside the title for exact inline Rem references.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need to create a note? Use remnote_create_note; pass tagRemIds for exact-ID tag assignment, [[id:<remId>]] for exact inline Rem references, and asDocument=true when the title/root Rem should be a document.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need to mark an existing Rem as a document? Use remnote_set_document_status dryRun first, include expectedOldRemType for stale-context protection, then rerun with dryRun=false after approval.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need to append to today journal? Use remnote_append_journal; pass tagRemIds when the journal entry should be tagged and [[id:<remId>]] for exact inline Rem references.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need strict tag verification? Use remnote_search_by_tag with resultMode="tagged", or verify the exact Rem in matchedRems from context mode.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need broad search enumeration? Continue remnote_search or remnote_search_by_tag with nextCursor while hasMore is true.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need to search within a specific branch? Use remnote_search with parentRemId; keep the same parentRemId when continuing with nextCursor.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need hierarchy placement context? Add ancestorDepth, typically 5, to search/read/search_by_tag/list_children; ancestors are direct-parent first.'
    );
    expect(result.structuredContent?.decisionTree).toContain(
      'Need a large tag search to finish? Prefer cursor paging first; use remnote_search_by_tag.timeoutMs only as a bounded wait-time escape hatch.'
    );
    expect(result.structuredContent?.navigationPresets).toMatchObject({
      orientation: {
        contentMode: 'structured',
        view: 'compact',
        depth: 1,
        childLimit: 500,
      },
    });
    expect(result.structuredContent?.contentModes).toMatchObject({
      structured: expect.stringContaining('contentStructured'),
    });
    expect(result.structuredContent?.writePolicy).toMatchObject({
      guidance: expect.arrayContaining([
        'All production tag writes use exact tag Rem IDs: create_note.tagRemIds, append_journal.tagRemIds, and update_tags add/remove arrays.',
        'Markdown-capable write fields support [[id:<remId>]] to create real inline references to existing Rems without name lookup.',
        'remnote_set_property writes exact-ID tag/table property values and requires acceptWriteOperations=true.',
        'remnote_set_document_status changes only document status; it preserves concept/card status and defaults to dryRun=true.',
      ]),
    });
  });

  it('should include currentStatus snapshot', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_get_playbook', arguments: {} },
    })) as ToolSuccessResult;

    expect(result.structuredContent?.currentStatus).toMatchObject({
      connected: true,
      serverVersion: '0.8.0',
    });
  });
});

describe('Tool Handler - Error Handling', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn(),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should return error for unknown tool name', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'unknown_tool', arguments: {} },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should handle WebSocket server errors', async () => {
    mockWsServer.sendRequest.mockRejectedValue(new Error('WebSocket error'));

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: { query: 'test' } },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('WebSocket error');
  });

  it('should not require structuredContent for tool errors', async () => {
    mockWsServer.sendRequest.mockRejectedValue(new Error('WebSocket error'));

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: { query: 'test' } },
    })) as {
      isError: boolean;
      content: { text: string }[];
      structuredContent?: Record<string, unknown>;
    };

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it('should format non-Error exceptions', async () => {
    mockWsServer.sendRequest.mockRejectedValue('string error');

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: { query: 'test' } },
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: string error');
  });
});

describe('Tool Logging', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleMutatingResult),
    };
    mockLogger = createMockLogger();
    registerAllTools(mockServer as never, mockWsServer as never, mockLogger);
  });

  it('should create child logger with tools context', () => {
    expect(mockLogger.child).toHaveBeenCalledWith({ context: 'tools' });
  });

  it('should log tool execution', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'remnote_search',
        args: validSearchInput,
      }),
      'Executing tool'
    );
  });

  it('should log tool completion with duration', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'remnote_search',
        duration_ms: expect.any(Number),
      }),
      'Tool completed'
    );
  });

  it('should log tool failures', async () => {
    mockWsServer.sendRequest.mockRejectedValue(new Error('Test error'));

    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'remnote_search',
        error: 'Test error',
      }),
      'Tool failed'
    );
  });

  it('should log list_tools requests', async () => {
    await mockServer.callHandler(ListToolsRequestSchema, {});

    expect(mockLogger.debug).toHaveBeenCalledWith('Listing available tools');
  });
});
