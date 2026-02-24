/**
 * Tools unit tests
 * Tests for MCP tool registration and handler logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAllTools,
  CREATE_NOTE_TOOL,
  SEARCH_TOOL,
  READ_NOTE_TOOL,
  UPDATE_NOTE_TOOL,
  APPEND_JOURNAL_TOOL,
  STATUS_TOOL,
} from '../../src/tools/index.js';
import { WebSocketServer } from '../../src/websocket-server.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  validCreateNoteInput,
  validSearchInput,
  validReadNoteInput,
  validUpdateNoteInput,
  validAppendJournalInput,
  sampleNoteResult,
  sampleSearchResults,
  sampleStatusResult,
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

describe('Tool Definitions', () => {
  it('should have correct name for CREATE_NOTE_TOOL', () => {
    expect(CREATE_NOTE_TOOL.name).toBe('remnote_create_note');
  });

  it('should have required title field for CREATE_NOTE_TOOL', () => {
    expect(CREATE_NOTE_TOOL.inputSchema.required).toContain('title');
  });

  it('should have correct name for SEARCH_TOOL', () => {
    expect(SEARCH_TOOL.name).toBe('remnote_search');
  });

  it('should have required query field for SEARCH_TOOL', () => {
    expect(SEARCH_TOOL.inputSchema.required).toContain('query');
  });

  it('should advertise structured search content mode and contentStructured output', () => {
    const includeContent = (
      SEARCH_TOOL.inputSchema.properties.includeContent as {
        enum?: string[];
      }
    ).enum;
    const searchResultProps = ((
      SEARCH_TOOL.outputSchema.properties.results as {
        items?: { properties?: Record<string, unknown> };
      }
    ).items?.properties ?? {}) as Record<string, unknown>;

    expect(includeContent).toContain('structured');
    expect(searchResultProps.contentStructured).toBeDefined();
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

  it('should have correct name for READ_NOTE_TOOL', () => {
    expect(READ_NOTE_TOOL.name).toBe('remnote_read_note');
  });

  it('should have required remId field for READ_NOTE_TOOL', () => {
    expect(READ_NOTE_TOOL.inputSchema.required).toContain('remId');
  });

  it('should have correct name for UPDATE_NOTE_TOOL', () => {
    expect(UPDATE_NOTE_TOOL.name).toBe('remnote_update_note');
  });

  it('should have required remId field for UPDATE_NOTE_TOOL', () => {
    expect(UPDATE_NOTE_TOOL.inputSchema.required).toContain('remId');
  });

  it('should have correct name for APPEND_JOURNAL_TOOL', () => {
    expect(APPEND_JOURNAL_TOOL.name).toBe('remnote_append_journal');
  });

  it('should have required content field for APPEND_JOURNAL_TOOL', () => {
    expect(APPEND_JOURNAL_TOOL.inputSchema.required).toContain('content');
  });

  it('should have correct name for STATUS_TOOL', () => {
    expect(STATUS_TOOL.name).toBe('remnote_status');
  });

  it('should have no required fields for STATUS_TOOL', () => {
    expect(STATUS_TOOL.inputSchema.required || []).toHaveLength(0);
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

  it('should return all 6 tools in list', async () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());

    const result = (await mockServer.callHandler(ListToolsRequestSchema, {})) as {
      tools: unknown[];
    };

    expect(result.tools).toHaveLength(6);
  });

  it('should include all tool names in list', async () => {
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger());

    const result = (await mockServer.callHandler(ListToolsRequestSchema, {})) as {
      tools: { name: string }[];
    };

    const names = result.tools.map((t) => t.name);
    expect(names).toContain('remnote_create_note');
    expect(names).toContain('remnote_search');
    expect(names).toContain('remnote_read_note');
    expect(names).toContain('remnote_update_note');
    expect(names).toContain('remnote_append_journal');
    expect(names).toContain('remnote_status');
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
    })) as { content: { type: string; text: string }[] };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(sampleNoteResult);
  });

  it('should reject invalid input', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_create_note', arguments: {} }, // Missing title
    })) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
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
    });
  });

  it('should return formatted JSON result', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: validSearchInput },
    })) as { content: { type: string; text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(sampleSearchResults);
  });

  it('should apply default values from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_search', arguments: { query: 'test' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      limit: 50, // default
      includeContent: 'none', // default
      depth: 1, // default
      childLimit: 20, // default
      maxContentLength: 3000, // default
    });
  });

  it('should pass through includeContent structured', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: {
        name: 'remnote_search',
        arguments: { query: 'test', includeContent: 'structured', depth: 2 },
      },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('search', {
      query: 'test',
      limit: 50,
      includeContent: 'structured',
      depth: 2,
      childLimit: 20,
      maxContentLength: 3000,
    });
  });
});

describe('Tool Handlers - read_note', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue(sampleNoteResult),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with read_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_note', arguments: validReadNoteInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_note', {
      ...validReadNoteInput,
      includeContent: 'markdown',
      childLimit: 100,
      maxContentLength: 100000,
    });
  });

  it('should apply default depth from schema', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_read_note', arguments: { remId: 'rem-123' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('read_note', {
      remId: 'rem-123',
      depth: 5, // default
      includeContent: 'markdown', // default
      childLimit: 100, // default
      maxContentLength: 100000, // default
    });
  });
});

describe('Tool Handlers - update_note', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue({ success: true }),
    };
    registerAllTools(mockServer as never, mockWsServer as never, createMockLogger() as never);
  });

  it('should call wsServer.sendRequest with update_note action', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_update_note', arguments: validUpdateNoteInput },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('update_note', validUpdateNoteInput);
  });

  it('should allow update with only remId', async () => {
    await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_update_note', arguments: { remId: 'rem-456' } },
    });

    expect(mockWsServer.sendRequest).toHaveBeenCalledWith('update_note', { remId: 'rem-456' });
  });
});

describe('Tool Handlers - append_journal', () => {
  let mockServer: MockMCPServer;
  let mockWsServer: { sendRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = new MockMCPServer();
    mockWsServer = {
      sendRequest: vi.fn().mockResolvedValue({ success: true }),
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
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(false);
    expect(parsed.serverVersion).toBe('0.5.1');
    expect(parsed.message).toContain('not connected');
  });

  it('should include connected: true in response when connected', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(true);
  });

  it('should merge status result with connected: true', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(true);
    expect(parsed.serverVersion).toBe('0.5.1');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.statistics).toBeDefined();
  });

  it('should include version_warning when bridge version mismatches', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue('0.6.0');

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version_warning).toContain('Version mismatch');
  });

  it('should not include version_warning when versions are compatible', async () => {
    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version_warning).toBeUndefined();
  });

  it('should not include version_warning when bridge version is null', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue(null);

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version_warning).toBeUndefined();
  });

  it('should include version_warning when bridge version is null but pluginVersion in result mismatches', async () => {
    mockWsServer.getBridgeVersion.mockReturnValue(null);
    mockWsServer.getServerVersion.mockReturnValue('0.6.0');
    mockWsServer.sendRequest.mockResolvedValue({ pluginVersion: '0.5.0' });

    const result = (await mockServer.callHandler(CallToolRequestSchema, {
      params: { name: 'remnote_status', arguments: {} },
    })) as { content: { text: string }[] };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version_warning).toContain('Version mismatch');
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
      sendRequest: vi.fn().mockResolvedValue({ success: true }),
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
