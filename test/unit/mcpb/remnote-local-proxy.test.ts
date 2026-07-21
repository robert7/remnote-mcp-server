import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_MCP_URL,
  FALLBACK_TOOLS,
  RemNoteLocalProxy,
  SERVER_INFO,
  formatUsage,
  handleUtilityCommand,
  isInteractiveTerminalInvocation,
  isMainModule,
  normalizeMcpUrl,
} from '../../../mcpb/remnote-local/server/index.js';
import { ALL_TOOLS } from '../../../src/tools/index.js';

describe('RemNoteLocalProxy', () => {
  const REMOTE_SERVER_VERSION = '1.2.3';

  it('normalizes MCP URLs to the /mcp endpoint', () => {
    expect(normalizeMcpUrl('http://127.0.0.1:3001')).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl('http://127.0.0.1:3001/')).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl(DEFAULT_MCP_URL)).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl(`${DEFAULT_MCP_URL}/`)).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl('')).toBe(DEFAULT_MCP_URL);
  });

  it('forwards tools/list to the configured local HTTP MCP server', async () => {
    const remoteTools = { tools: [{ name: 'remote_tool', inputSchema: { type: 'object' } }] };
    const { createClient, client, transport } = createMockClient({ listToolsResult: remoteTools });
    const proxy = new RemNoteLocalProxy({
      mcpUrl: 'http://localhost:4000',
      createClient,
    });

    await expect(proxy.listTools()).resolves.toEqual(remoteTools);

    expect(createClient).toHaveBeenCalledWith('http://localhost:4000/mcp', {
      name: 'remnote-mcp-stdio',
      version: SERVER_INFO.version,
    });
    expect(client.connect).toHaveBeenCalledWith(transport);
    expect(client.listTools).toHaveBeenCalled();
    expect(transport.terminateSession).toHaveBeenCalled();
    expect(client.close).toHaveBeenCalled();
  });

  it('returns fallback tools when the local HTTP MCP server is unavailable during tools/list', async () => {
    const { createClient } = createMockClient({ connectError: new Error('fetch failed') });
    const proxy = new RemNoteLocalProxy({ createClient });

    await expect(proxy.listTools()).resolves.toEqual({ tools: FALLBACK_TOOLS });
  });

  it('keeps MCPB fallback tools aligned with the split write contract', () => {
    const fallbackNames = FALLBACK_TOOLS.map((tool) => tool.name);
    const canonicalNames = ALL_TOOLS.map((tool) => tool.name);
    expect(fallbackNames).toEqual(canonicalNames);
    expect(fallbackNames).toContain('remnote_insert_children');
    expect(fallbackNames).toContain('remnote_replace_children');
    expect(fallbackNames).toContain('remnote_update_tags');

    const createNote = FALLBACK_TOOLS.find((tool) => tool.name === 'remnote_create_note');
    const updateNote = FALLBACK_TOOLS.find((tool) => tool.name === 'remnote_update_note');
    const appendJournal = FALLBACK_TOOLS.find((tool) => tool.name === 'remnote_append_journal');
    const createProps = createNote?.inputSchema.properties ?? {};
    const updateProps = updateNote?.inputSchema.properties ?? {};
    const journalProps = appendJournal?.inputSchema.properties ?? {};

    expect(createProps.tagRemIds).toBeDefined();
    expect(createProps.aliases).toBeDefined();
    expect(createProps.tags).toBeUndefined();
    expect(updateProps.appendContent).toBeUndefined();
    expect(updateProps.replaceContent).toBeUndefined();
    expect(updateProps.addTags).toBeUndefined();
    expect(updateProps.removeTags).toBeUndefined();
    expect(updateProps.addAliases).toBeDefined();
    expect(updateProps.removeAliases).toBeDefined();
    expect(journalProps.tagRemIds).toBeDefined();
  });

  it('keeps MCPB manifest tool names aligned with split write tools', () => {
    const manifest = JSON.parse(readFileSync('mcpb/remnote-local/manifest.json', 'utf8')) as {
      tools: Array<{ name: string; description: string }>;
    };
    const names = manifest.tools.map((tool) => tool.name);
    const canonicalNames = ALL_TOOLS.map((tool) => tool.name);

    expect(names).toEqual(canonicalNames);
    expect(names).toContain('remnote_insert_children');
    expect(names).toContain('remnote_replace_children');
    expect(names).toContain('remnote_update_tags');
    expect(
      manifest.tools.find((tool) => tool.name === 'remnote_update_note')?.description
    ).toContain('metadata');
  });

  it('keeps MCPB runtime decoupled from server source and build output', () => {
    const source = readFileSync('mcpb/remnote-local/server/index.js', 'utf8');

    expect(source).toContain('./fallback-tools.generated.js');
    expect(source).not.toContain('src/tools');
    expect(source).not.toContain('dist/tools');
  });

  it('forwards tool calls and preserves the remote MCP result', async () => {
    const callToolResult = {
      structuredContent: { connected: true, serverVersion: REMOTE_SERVER_VERSION },
      content: [
        { type: 'text', text: `{"connected":true,"serverVersion":"${REMOTE_SERVER_VERSION}"}` },
      ],
    };
    const { createClient, client } = createMockClient({ callToolResult });
    const proxy = new RemNoteLocalProxy({ createClient });

    await expect(proxy.callTool({ name: 'remnote_status', arguments: {} })).resolves.toEqual(
      callToolResult
    );
    expect(client.callTool).toHaveBeenCalledWith({ name: 'remnote_status', arguments: {} });
  });

  it('preserves MCP-native image blocks without base64 duplication', async () => {
    const callToolResult = {
      structuredContent: { mediaId: 'media_1234', mimeType: 'image/png', sizeBytes: 8 },
      content: [
        { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
        { type: 'text', text: '{"mediaId":"media_1234","sizeBytes":8}' },
      ],
    };
    const { createClient } = createMockClient({ callToolResult });
    const proxy = new RemNoteLocalProxy({ createClient });

    await expect(
      proxy.callTool({ name: 'remnote_get_media', arguments: { mediaId: 'media_1234' } })
    ).resolves.toEqual(callToolResult);
  });

  it('returns a clear MCP tool error when a tool call cannot reach the local server', async () => {
    const { createClient } = createMockClient({ connectError: new Error('ECONNREFUSED') });
    const proxy = new RemNoteLocalProxy({ mcpUrl: 'http://localhost:3001/mcp', createClient });

    await expect(proxy.callTool({ name: 'remnote_status', arguments: {} })).resolves.toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: expect.stringContaining(
            'Cannot connect to local RemNote MCP Server at http://localhost:3001/mcp.'
          ),
        },
      ],
    });
  });

  it('prints its version for npm bin verification without starting stdio transport', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(handleUtilityCommand(['node', 'remnote-mcp-stdio', '--version'])).toBe(true);
    expect(stdout).toHaveBeenCalledWith(`${SERVER_INFO.version}\n`);
    expect(handleUtilityCommand(['node', 'remnote-mcp-stdio', '-V'])).toBe(true);

    stdout.mockRestore();
  });

  it('prints help for manual stdio proxy discovery', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(handleUtilityCommand(['node', 'remnote-mcp-stdio', '--help'])).toBe(true);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Usage:\n'));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('remnote-mcp-server separately'));

    stdout.mockRestore();
  });

  it('detects direct terminal invocation without treating MCP client stdio as interactive', () => {
    const tty = { isTTY: true };
    const pipe = { isTTY: false };

    expect(isInteractiveTerminalInvocation(['node', 'remnote-mcp-stdio'], tty, tty)).toBe(true);
    expect(isInteractiveTerminalInvocation(['node', 'remnote-mcp-stdio'], pipe, tty)).toBe(false);
    expect(isInteractiveTerminalInvocation(['node', 'remnote-mcp-stdio', '--help'], tty, tty)).toBe(
      false
    );
    expect(formatUsage()).toContain('Default target: http://127.0.0.1:3001/mcp');
  });

  it('detects npm bin symlink invocation as the main module', () => {
    const dir = mkdtempSync(join(tmpdir(), 'remnote-mcp-stdio-bin-'));
    const symlinkPath = join(dir, 'remnote-mcp-stdio');
    symlinkSync(join(process.cwd(), 'mcpb/remnote-local/server/index.js'), symlinkPath);

    expect(isMainModule(['node', symlinkPath])).toBe(true);
  });
});

function createMockClient({
  connectError,
  listToolsResult = { tools: [] },
  callToolResult = { content: [{ type: 'text', text: '{}' }] },
}: {
  connectError?: Error;
  listToolsResult?: unknown;
  callToolResult?: unknown;
}) {
  const client = {
    connect: vi.fn().mockImplementation(async () => {
      if (connectError) {
        throw connectError;
      }
    }),
    listTools: vi.fn().mockResolvedValue(listToolsResult),
    callTool: vi.fn().mockResolvedValue(callToolResult),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const transport = {
    terminateSession: vi.fn().mockResolvedValue(undefined),
  };
  const createClient = vi.fn().mockReturnValue({ client, transport });

  return { createClient, client, transport };
}
