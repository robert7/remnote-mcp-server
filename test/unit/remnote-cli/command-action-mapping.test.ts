import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServerClient } from '../../../src/remnote-cli/client/mcp-server-client.js';
import { createProgram } from '../../../src/remnote-cli/cli.js';

const tempDirs: string[] = [];

async function createTempContentFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'remnote-cli-command-map-'));
  tempDirs.push(dir);
  const path = join(dir, 'content.md');
  await writeFile(path, content, 'utf8');
  return path;
}

async function runCommand(args: string[], result: unknown = { ok: true }): Promise<MockInstance> {
  const executeSpy = vi.spyOn(McpServerClient.prototype, 'execute').mockResolvedValue(result);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const program = createProgram('0.1.0-test');

  await program.parseAsync(['node', 'remnote-cli', ...args], { from: 'node' });

  logSpy.mockRestore();
  return executeSpy;
}

describe('command bridge action mapping', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('maps create command to create_note', async () => {
    const executeSpy = await runCommand([
      'create',
      'Test Title',
      '--content',
      'Body',
      '--tag-ids',
      'tag-rem-id-a',
      'tag-rem-id-b',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Test Title',
      content: 'Body',
      tagRemIds: ['tag-rem-id-a', 'tag-rem-id-b'],
    });
    executeSpy.mockRestore();
  });

  it('maps create --content-file to create_note content payload', async () => {
    const filePath = await createTempContentFile('Body from file');
    const executeSpy = await runCommand(['create', 'Title', '--content-file', filePath]);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Title',
      content: 'Body from file',
    });
    executeSpy.mockRestore();
  });

  it('maps create command with title positional and --content opt', async () => {
    const executeSpy = await runCommand(['create', 'Title', '--content', 'Body']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Title',
      content: 'Body',
    });
    executeSpy.mockRestore();
  });

  it('maps create command with title positional and --content opt', async () => {
    const executeSpy = await runCommand(['create', 'Title', '--content', 'Body']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Title',
      content: 'Body',
    });
    executeSpy.mockRestore();
  });

  it('maps create --as-document to create_note asDocument payload', async () => {
    const executeSpy = await runCommand(['create', 'Title', '--as-document']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Title',
      asDocument: true,
    });
    executeSpy.mockRestore();
  });

  it('maps create --aliases to create_note aliases', async () => {
    const executeSpy = await runCommand([
      'create',
      'Original Title',
      '--aliases',
      'Pôvodný názov',
      '원래 제목',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Original Title',
      aliases: ['Pôvodný názov', '원래 제목'],
    });
    executeSpy.mockRestore();
  });

  it('maps create command with title-only positional args', async () => {
    const executeSpy = await runCommand(['create', 'Title']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Title',
    });
    executeSpy.mockRestore();
  });

  it('maps create command with --title flag', async () => {
    const executeSpy = await runCommand(['create', '--title', 'Flag Title']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      title: 'Flag Title',
    });
    executeSpy.mockRestore();
  });

  it('maps create command with content-only (--content)', async () => {
    const executeSpy = await runCommand(['create', '--content', 'Body']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {
      content: 'Body',
    });
    executeSpy.mockRestore();
  });

  it('maps create command with no args (bridge-side error)', async () => {
    const executeSpy = await runCommand(['create']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {});
    executeSpy.mockRestore();
  });

  it('maps create command with no args (bridge-side error)', async () => {
    const executeSpy = await runCommand(['create']);
    expect(executeSpy).toHaveBeenCalledWith('create_note', {});
    executeSpy.mockRestore();
  });

  it('maps read command to read_note', async () => {
    const executeSpy = await runCommand(['read', 'abc123', '--depth', '2']);
    expect(executeSpy).toHaveBeenCalledWith('read_note', { remId: 'abc123', depth: 2 });
    executeSpy.mockRestore();
  });

  it('passes through structured read content mode', async () => {
    const executeSpy = await runCommand(['read', 'abc123', '--content-mode', 'structured']);
    expect(executeSpy).toHaveBeenCalledWith('read_note', {
      remId: 'abc123',
      depth: 5,
      contentMode: 'structured',
    });
    executeSpy.mockRestore();
  });

  it('requests media metadata from read', async () => {
    const executeSpy = await runCommand(['read', 'abc123', '--include-media-metadata']);
    expect(executeSpy).toHaveBeenCalledWith('read_note', {
      remId: 'abc123',
      depth: 5,
      includeMediaMetadata: true,
    });
    executeSpy.mockRestore();
  });

  it('maps get-media and writes image bytes to the requested path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'remnote-cli-media-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'image.png');
    const data = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    const executeSpy = await runCommand(
      [
        'get-media',
        'abc123',
        '--field',
        'text',
        '--media-id',
        'media_1234',
        '--output',
        outputPath,
        '--max-inline-bytes',
        '1024',
        '--force',
      ],
      { data, mimeType: 'image/png', sizeBytes: 8, mediaId: 'media_1234' }
    );

    expect(executeSpy).toHaveBeenCalledWith('get_media', {
      remId: 'abc123',
      field: 'text',
      mediaId: 'media_1234',
      maxInlineBytes: 1024,
    });
    expect(await readFile(outputPath)).toEqual(Buffer.from(data, 'base64'));
    executeSpy.mockRestore();
  });

  it('maps search command to search with content rendering options', async () => {
    const executeSpy = await runCommand([
      'search',
      'ml',
      '--content-mode',
      'markdown',
      '--depth',
      '1',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('search', {
      query: 'ml',
      limit: 50,
      contentMode: 'markdown',
      depth: 1,
    });
    executeSpy.mockRestore();
  });

  it('passes through search parent-id option', async () => {
    const executeSpy = await runCommand(['search', 'ml', '--parent-id', 'parentRemId123']);
    expect(executeSpy).toHaveBeenCalledWith('search', {
      query: 'ml',
      limit: 50,
      parentRemId: 'parentRemId123',
    });
    executeSpy.mockRestore();
  });

  it('passes through structured search content mode', async () => {
    const executeSpy = await runCommand(['search', 'folders', '--content-mode', 'structured']);
    expect(executeSpy).toHaveBeenCalledWith('search', {
      query: 'folders',
      limit: 50,
      contentMode: 'structured',
    });
    executeSpy.mockRestore();
  });

  it('passes through search cursor', async () => {
    const executeSpy = await runCommand(['search', 'folders', '--cursor', 'search:v1:id:2:hash']);
    expect(executeSpy).toHaveBeenCalledWith('search', {
      query: 'folders',
      limit: 50,
      cursor: 'search:v1:id:2:hash',
    });
    executeSpy.mockRestore();
  });

  it('maps search-by-tag command to search_by_tag with content rendering options', async () => {
    const executeSpy = await runCommand([
      'search-by-tag',
      '--tag-id',
      'daily-tag-rem-id',
      '--content-mode',
      'markdown',
      '--depth',
      '2',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('search_by_tag', {
      tagRemId: 'daily-tag-rem-id',
      limit: 50,
      contentMode: 'markdown',
      depth: 2,
    });
    executeSpy.mockRestore();
  });

  it('passes through structured search-by-tag content mode', async () => {
    const executeSpy = await runCommand([
      'search-by-tag',
      '--tag-id',
      'project-tag-rem-id',
      '--content-mode',
      'structured',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('search_by_tag', {
      tagRemId: 'project-tag-rem-id',
      limit: 50,
      contentMode: 'structured',
    });
    executeSpy.mockRestore();
  });

  it('passes through tagged search-by-tag result mode', async () => {
    const executeSpy = await runCommand([
      'search-by-tag',
      '--tag-id',
      'project-tag-rem-id',
      '--result-mode',
      'tagged',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('search_by_tag', {
      tagRemId: 'project-tag-rem-id',
      limit: 50,
      resultMode: 'tagged',
    });
    executeSpy.mockRestore();
  });

  it('passes through search-by-tag cursor and timeout', async () => {
    const executeSpy = await runCommand([
      'search-by-tag',
      '--tag-id',
      'project-tag-rem-id',
      '--cursor',
      'search_by_tag:v1:id:2:hash',
      '--timeout-ms',
      '30000',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('search_by_tag', {
      tagRemId: 'project-tag-rem-id',
      limit: 50,
      cursor: 'search_by_tag:v1:id:2:hash',
      timeoutMs: 30000,
    });
    executeSpy.mockRestore();
  });

  it('maps list-children command to list_children with traversal options', async () => {
    const executeSpy = await runCommand([
      'list-children',
      'parent123',
      '--limit',
      '25',
      '--view',
      'compact',
      '--ancestor-depth',
      '3',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('list_children', {
      parentRemId: 'parent123',
      limit: 25,
      view: 'compact',
      ancestorDepth: 3,
    });
    executeSpy.mockRestore();
  });

  it('maps list-children cursor pagination', async () => {
    const executeSpy = await runCommand([
      'list-children',
      'parent123',
      '--cursor',
      'list_children:v1:parent123:50:hash',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('list_children', {
      parentRemId: 'parent123',
      limit: 50,
      cursor: 'list_children:v1:parent123:50:hash',
    });
    executeSpy.mockRestore();
  });

  it('maps update command with --title flag', async () => {
    const executeSpy = await runCommand(['update', 'abc123', '--title', 'New Title']);
    expect(executeSpy).toHaveBeenCalledWith('update_note', {
      remId: 'abc123',
      title: 'New Title',
    });
    executeSpy.mockRestore();
  });

  it('maps update alias flags without requiring a title', async () => {
    const executeSpy = await runCommand([
      'update',
      'abc123',
      '--add-aliases',
      'New Alias',
      '日本語',
      '--remove-aliases',
      'Old Alias',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('update_note', {
      remId: 'abc123',
      addAliases: ['New Alias', '日本語'],
      removeAliases: ['Old Alias'],
    });
    executeSpy.mockRestore();
  });

  it('maps insert-children to insert_children payload', async () => {
    const executeSpy = await runCommand([
      'insert-children',
      'parent123',
      '--content',
      'Inserted content',
      '--position',
      'first',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('insert_children', {
      parentRemId: 'parent123',
      content: 'Inserted content',
      position: 'first',
    });
    executeSpy.mockRestore();
  });

  it('maps insert-children --content-file before sibling to insert_children payload', async () => {
    const filePath = await createTempContentFile('Insert from file');
    const executeSpy = await runCommand([
      'insert-children',
      'parent123',
      '--content-file',
      filePath,
      '--position',
      'before',
      '--sibling-rem-id',
      'sibling123',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('insert_children', {
      parentRemId: 'parent123',
      content: 'Insert from file',
      position: 'before',
      siblingRemId: 'sibling123',
    });
    executeSpy.mockRestore();
  });

  it('maps replace-children --content-file to replace_children payload', async () => {
    const filePath = await createTempContentFile('Replace from file');
    const executeSpy = await runCommand([
      'replace-children',
      'parent123',
      '--content-file',
      filePath,
    ]);
    expect(executeSpy).toHaveBeenCalledWith('replace_children', {
      parentRemId: 'parent123',
      content: 'Replace from file',
    });
    executeSpy.mockRestore();
  });

  it('maps update-tags to update_tags payload', async () => {
    const executeSpy = await runCommand([
      'update-tags',
      'abc123',
      '--add-tag-ids',
      'tag1',
      'tag2',
      '--remove-tag-ids',
      'tag3',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('update_tags', {
      remId: 'abc123',
      addTagRemIds: ['tag1', 'tag2'],
      removeTagRemIds: ['tag3'],
    });
    executeSpy.mockRestore();
  });

  it('maps set-property --value to set_property payload', async () => {
    const executeSpy = await runCommand([
      'set-property',
      'abc123',
      '--tag-id',
      'tag1',
      '--property-id',
      'prop1',
      '--value',
      'People',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('set_property', {
      remId: 'abc123',
      tagRemId: 'tag1',
      propertyRemId: 'prop1',
      value: { kind: 'text', text: 'People' },
    });
    executeSpy.mockRestore();
  });

  it('maps set-property --rem-reference-id to set_property payload', async () => {
    const executeSpy = await runCommand([
      'set-property',
      'abc123',
      '--tag-id',
      'tag1',
      '--property-id',
      'prop1',
      '--rem-reference-id',
      'option1',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('set_property', {
      remId: 'abc123',
      tagRemId: 'tag1',
      propertyRemId: 'prop1',
      value: { kind: 'rem_reference', remId: 'option1' },
    });
    executeSpy.mockRestore();
  });

  it('maps set-property --clear to set_property payload', async () => {
    const executeSpy = await runCommand([
      'set-property',
      'abc123',
      '--tag-id',
      'tag1',
      '--property-id',
      'prop1',
      '--clear',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('set_property', {
      remId: 'abc123',
      tagRemId: 'tag1',
      propertyRemId: 'prop1',
      value: { kind: 'clear' },
    });
    executeSpy.mockRestore();
  });

  it('formats set-property text output', async () => {
    const executeSpy = vi.spyOn(McpServerClient.prototype, 'execute').mockResolvedValue({
      remId: 'abc123',
      propertyRemId: 'prop1',
      valueKind: 'rem_reference',
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createProgram('0.1.0-test');

    try {
      await program.parseAsync(
        [
          'node',
          'remnote-cli',
          '--text',
          'set-property',
          'abc123',
          '--tag-id',
          'tag1',
          '--property-id',
          'prop1',
          '--rem-reference-id',
          'option1',
        ],
        { from: 'node' }
      );

      expect(logSpy).toHaveBeenCalledWith('Set property: prop1 on abc123 (rem_reference)');
    } finally {
      logSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it('rejects set-property without a value option', async () => {
    const executeSpy = vi
      .spyOn(McpServerClient.prototype, 'execute')
      .mockResolvedValue({ ok: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalExit = process.exit;
    process.exit = vi.fn() as never;
    const program = createProgram('0.1.0-test');

    try {
      await program.parseAsync(
        [
          'node',
          'remnote-cli',
          'set-property',
          'abc123',
          '--tag-id',
          'tag1',
          '--property-id',
          'prop1',
        ],
        { from: 'node' }
      );

      expect(executeSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provide exactly one of --value, --rem-reference-id, or --clear')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      process.exit = originalExit;
      logSpy.mockRestore();
      errSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it('rejects set-property with multiple value options', async () => {
    const executeSpy = vi
      .spyOn(McpServerClient.prototype, 'execute')
      .mockResolvedValue({ ok: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalExit = process.exit;
    process.exit = vi.fn() as never;
    const program = createProgram('0.1.0-test');

    try {
      await program.parseAsync(
        [
          'node',
          'remnote-cli',
          'set-property',
          'abc123',
          '--tag-id',
          'tag1',
          '--property-id',
          'prop1',
          '--value',
          'People',
          '--clear',
        ],
        { from: 'node' }
      );

      expect(executeSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provide exactly one of --value, --rem-reference-id, or --clear')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      process.exit = originalExit;
      logSpy.mockRestore();
      errSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it('maps move-note to dry-run move_note by default', async () => {
    const executeSpy = await runCommand([
      'move-note',
      'rem123',
      '--new-parent-rem-id',
      'parent456',
      '--expected-old-parent-rem-id',
      'old-parent',
      '--ancestor-depth',
      '4',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('move_note', {
      remId: 'rem123',
      newParentRemId: 'parent456',
      dryRun: true,
      expectedOldParentRemId: 'old-parent',
      ancestorDepth: 4,
    });
    executeSpy.mockRestore();
  });

  it('maps move-note --apply with sibling position', async () => {
    const executeSpy = await runCommand([
      'move-note',
      'rem123',
      '--new-parent-rem-id',
      'parent456',
      '--position',
      'before',
      '--sibling-rem-id',
      'sibling789',
      '--apply',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('move_note', {
      remId: 'rem123',
      newParentRemId: 'parent456',
      dryRun: false,
      position: 'before',
      siblingRemId: 'sibling789',
    });
    executeSpy.mockRestore();
  });

  it('maps set-document-status to dry-run set_document_status by default', async () => {
    const executeSpy = await runCommand([
      'set-document-status',
      'rem123',
      '--document',
      '--expected-old-rem-type',
      'concept',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('set_document_status', {
      remId: 'rem123',
      isDocument: true,
      dryRun: true,
      expectedOldRemType: 'concept',
    });
    executeSpy.mockRestore();
  });

  it('maps set-document-status --apply with --no-document', async () => {
    const executeSpy = await runCommand([
      'set-document-status',
      'rem123',
      '--no-document',
      '--apply',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('set_document_status', {
      remId: 'rem123',
      isDocument: false,
      dryRun: false,
    });
    executeSpy.mockRestore();
  });

  it('rejects set-document-status without an explicit target status', async () => {
    const executeSpy = vi
      .spyOn(McpServerClient.prototype, 'execute')
      .mockResolvedValue({ ok: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalExit = process.exit;
    process.exit = vi.fn() as never;
    const program = createProgram('0.1.0-test');

    try {
      await program.parseAsync(['node', 'remnote-cli', 'set-document-status', 'rem123'], {
        from: 'node',
      });

      expect(executeSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provide --document or --no-document')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      process.exit = originalExit;
      logSpy.mockRestore();
      errSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it('maps journal command with positional content', async () => {
    const executeSpy = await runCommand([
      'journal',
      'Positional Entry',
      '--no-timestamp',
      '--tag-ids',
      'journal-tag-rem-id',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('append_journal', {
      content: 'Positional Entry',
      timestamp: false,
      tagRemIds: ['journal-tag-rem-id'],
    });
    executeSpy.mockRestore();
  });

  it('maps journal --content to append_journal', async () => {
    const executeSpy = await runCommand(['journal', '--content', 'Entry from flag']);
    expect(executeSpy).toHaveBeenCalledWith('append_journal', {
      content: 'Entry from flag',
      timestamp: true,
    });
    executeSpy.mockRestore();
  });

  it('maps journal --content-file to append_journal', async () => {
    const filePath = await createTempContentFile('Journal from file');
    const executeSpy = await runCommand(['journal', '--content-file', filePath]);
    expect(executeSpy).toHaveBeenCalledWith('append_journal', {
      content: 'Journal from file',
      timestamp: true,
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command to read_table', async () => {
    const executeSpy = await runCommand(['read-table', '--title', 'My Table']);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 50,
      offset: 0,
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command with --limit option', async () => {
    const executeSpy = await runCommand(['read-table', '--title', 'My Table', '--limit', '20']);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 20,
      offset: 0,
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command with --offset option', async () => {
    const executeSpy = await runCommand(['read-table', '--title', 'My Table', '--offset', '10']);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 50,
      offset: 10,
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command with --properties filter', async () => {
    const executeSpy = await runCommand([
      'read-table',
      '--title',
      'My Table',
      '--properties',
      'Status,Priority',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableTitle: 'My Table',
      limit: 50,
      offset: 0,
      propertyFilter: ['Status', 'Priority'],
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command with Rem ID as table identifier', async () => {
    const executeSpy = await runCommand(['read-table', '--rem-id', 'abc123-rem-id']);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableRemId: 'abc123-rem-id',
      limit: 50,
      offset: 0,
    });
    executeSpy.mockRestore();
  });

  it('maps read-table command with all options combined', async () => {
    const executeSpy = await runCommand([
      'read-table',
      '--title',
      'Table',
      '--limit',
      '10',
      '--offset',
      '5',
      '--properties',
      'Name',
    ]);
    expect(executeSpy).toHaveBeenCalledWith('read_table', {
      tableTitle: 'Table',
      limit: 10,
      offset: 5,
      propertyFilter: ['Name'],
    });
    executeSpy.mockRestore();
  });
});
