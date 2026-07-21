/**
 * Schema validation tests
 * Tests for all Zod schemas used in RemNote MCP server
 */

import { describe, it, expect } from 'vitest';
import {
  CreateNoteSchema,
  SearchSchema,
  SearchByTagSchema,
  ReadNoteSchema,
  UpdateNoteSchema,
  SetDocumentStatusSchema,
  InsertChildrenSchema,
  ReplaceChildrenSchema,
  UpdateTagsSchema,
  SetPropertySchema,
  AppendJournalSchema,
  ReadTableSchema,
} from '../../src/schemas/remnote-schemas.js';

describe('CreateNoteSchema', () => {
  it('should validate with only title field', () => {
    const result = CreateNoteSchema.parse({ title: 'Test' });
    expect(result.title).toBe('Test');
    expect(result.content).toBeUndefined();
    expect(result.parentId).toBeUndefined();
    expect(result.tagRemIds).toBeUndefined();
  });

  it('should validate with only content field', () => {
    const result = CreateNoteSchema.parse({ content: '- item' });
    expect(result.content).toBe('- item');
    expect(result.title).toBeUndefined();
  });

  it('should accept exact reference tokens in title and content strings', () => {
    const result = CreateNoteSchema.parse({
      title: 'Compound [[id:component-rem-id]]',
      content: 'Child [[id:child-rem-id]]',
    });

    expect(result.title).toBe('Compound [[id:component-rem-id]]');
    expect(result.content).toBe('Child [[id:child-rem-id]]');
  });

  it('should validate with all fields', () => {
    const input = {
      title: 'Test Note',
      content: 'Content',
      parentId: 'parent-123',
      tagRemIds: ['tag-rem-id-1', 'tag-rem-id-2'],
      asDocument: true,
      aliases: ['Pôvodný názov', '원래 제목'],
    };
    const result = CreateNoteSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('should reject empty object', () => {
    expect(() => CreateNoteSchema.parse({})).toThrow(
      'create_note requires either title or content'
    );
  });

  it('should reject non-string title', () => {
    expect(() => CreateNoteSchema.parse({ title: 123 })).toThrow();
  });

  it('should reject non-array tagRemIds', () => {
    expect(() => CreateNoteSchema.parse({ title: 'Test', tagRemIds: 'not-array' })).toThrow();
  });

  it('should reject old name-based tags field', () => {
    expect(() => CreateNoteSchema.parse({ title: 'Test', tags: ['tag-name'] })).toThrow();
  });

  it('should reject aliases without an explicit title', () => {
    expect(() =>
      CreateNoteSchema.parse({ content: '- item', aliases: ['Ambiguous Alias'] })
    ).toThrow('create_note aliases requires title so the alias target is unambiguous');
  });

  it('should reject invalid or whitespace-only aliases', () => {
    expect(() => CreateNoteSchema.parse({ title: 'Test', aliases: 'Alias' })).toThrow();
    expect(() => CreateNoteSchema.parse({ title: 'Test', aliases: ['   '] })).toThrow(
      'Aliases must not be empty after whitespace normalization'
    );
  });
});

describe('SearchSchema', () => {
  it('should validate with only required query field', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.query).toBe('test');
    expect(result.limit).toBe(50); // default
    expect(result.contentMode).toBe('none'); // default
    expect(result.depth).toBe(1); // default
  });

  it('should apply default limit of 50', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.limit).toBe(50);
  });

  it('should apply default contentMode of "none"', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.contentMode).toBe('none');
  });

  it('should validate with custom limit', () => {
    const result = SearchSchema.parse({ query: 'test', limit: 50 });
    expect(result.limit).toBe(50);
  });

  it('should validate with cursor', () => {
    const result = SearchSchema.parse({ query: 'test', cursor: 'search:v1:id:50:hash' });
    expect(result.cursor).toBe('search:v1:id:50:hash');
  });

  it('should validate with parentRemId', () => {
    const result = SearchSchema.parse({ query: 'test', parentRemId: 'some-parent-rem-id' });
    expect(result.parentRemId).toBe('some-parent-rem-id');
  });

  it('should reject empty parentRemId', () => {
    expect(() => SearchSchema.parse({ query: 'test', parentRemId: '' })).toThrow();
  });

  it('should validate with contentMode markdown', () => {
    const result = SearchSchema.parse({ query: 'test', contentMode: 'markdown' });
    expect(result.contentMode).toBe('markdown');
  });

  it('should validate with contentMode structured', () => {
    const result = SearchSchema.parse({ query: 'test', contentMode: 'structured' });
    expect(result.contentMode).toBe('structured');
  });

  it('should validate ancestorDepth and compact view', () => {
    const result = SearchSchema.parse({ query: 'test', ancestorDepth: 5, view: 'compact' });
    expect(result.ancestorDepth).toBe(5);
    expect(result.view).toBe('compact');
  });

  it('should apply default search depth of 1', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.depth).toBe(1);
  });

  it('should reject limit less than 1', () => {
    expect(() => SearchSchema.parse({ query: 'test', limit: 0 })).toThrow();
  });

  it('should reject limit greater than 150', () => {
    expect(() => SearchSchema.parse({ query: 'test', limit: 151 })).toThrow();
  });

  it('should reject non-integer limit', () => {
    expect(() => SearchSchema.parse({ query: 'test', limit: 20.5 })).toThrow();
  });

  it('should reject missing query', () => {
    expect(() => SearchSchema.parse({})).toThrow();
  });
});

describe('ReadNoteSchema', () => {
  it('should validate with only required remId field', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123' });
    expect(result.remId).toBe('rem-123');
    expect(result.depth).toBe(5); // default
    expect(result.contentMode).toBe('markdown'); // default
  });

  it('should apply default depth of 5', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123' });
    expect(result.depth).toBe(5);
  });

  it('should validate with custom depth', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123', depth: 7 });
    expect(result.depth).toBe(7);
  });

  it('should validate depth of 0', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123', depth: 0 });
    expect(result.depth).toBe(0);
  });

  it('should validate depth of 10', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123', depth: 10 });
    expect(result.depth).toBe(10);
  });

  it('should validate contentMode structured mode', () => {
    const result = ReadNoteSchema.parse({
      remId: 'rem-123',
      contentMode: 'structured',
      depth: 2,
    });
    expect(result.contentMode).toBe('structured');
    expect(result.depth).toBe(2);
  });

  it('should reject depth less than 0', () => {
    expect(() => ReadNoteSchema.parse({ remId: 'rem-123', depth: -1 })).toThrow();
  });

  it('should reject depth greater than 10', () => {
    expect(() => ReadNoteSchema.parse({ remId: 'rem-123', depth: 11 })).toThrow();
  });

  it('should reject non-integer depth', () => {
    expect(() => ReadNoteSchema.parse({ remId: 'rem-123', depth: 3.5 })).toThrow();
  });

  it('should reject missing remId', () => {
    expect(() => ReadNoteSchema.parse({})).toThrow();
  });
});

describe('SearchByTagSchema', () => {
  it('should validate with required tagRemId field', () => {
    const result = SearchByTagSchema.parse({ tagRemId: 'daily-tag-rem-id' });
    expect(result.tagRemId).toBe('daily-tag-rem-id');
    expect(result.resultMode).toBe('context');
    expect(result.limit).toBe(50);
    expect(result.contentMode).toBe('none');
    expect(result.depth).toBe(1);
    expect(result.childLimit).toBe(20);
    expect(result.maxContentLength).toBe(3000);
  });

  it('should validate contentMode structured mode', () => {
    const result = SearchByTagSchema.parse({
      tagRemId: 'project-tag-rem-id',
      resultMode: 'tagged',
      contentMode: 'structured',
      depth: 2,
    });
    expect(result.resultMode).toBe('tagged');
    expect(result.contentMode).toBe('structured');
    expect(result.depth).toBe(2);
  });

  it('should validate cursor and timeoutMs', () => {
    const result = SearchByTagSchema.parse({
      tagRemId: 'project-tag-rem-id',
      cursor: 'search_by_tag:v1:id:2:hash',
      timeoutMs: 30000,
    });
    expect(result.cursor).toBe('search_by_tag:v1:id:2:hash');
    expect(result.timeoutMs).toBe(30000);
  });

  it('should reject timeoutMs above the maximum', () => {
    expect(() =>
      SearchByTagSchema.parse({ tagRemId: 'daily-tag-rem-id', timeoutMs: 60001 })
    ).toThrow();
  });

  it('should reject invalid resultMode', () => {
    expect(() =>
      SearchByTagSchema.parse({ tagRemId: 'daily-tag-rem-id', resultMode: 'direct' })
    ).toThrow();
  });

  it('should reject missing tagRemId', () => {
    expect(() => SearchByTagSchema.parse({})).toThrow();
  });

  it('should reject empty tagRemId', () => {
    expect(() => SearchByTagSchema.parse({ tagRemId: '' })).toThrow();
  });

  it('should reject obsolete tag field', () => {
    expect(() => SearchByTagSchema.parse({ tag: 'daily' })).toThrow();
  });
});

describe('UpdateNoteSchema', () => {
  it('should validate title update fields', () => {
    const result = UpdateNoteSchema.parse({ remId: 'rem-456', title: 'New Title' });
    expect(result.remId).toBe('rem-456');
    expect(result.title).toBe('New Title');
  });

  it('should accept exact reference tokens in title strings', () => {
    const result = UpdateNoteSchema.parse({
      remId: 'rem-456',
      title: 'New [[id:target-rem-id]]',
    });

    expect(result.title).toBe('New [[id:target-rem-id]]');
  });

  it('should accept alias-only updates with Unicode values', () => {
    const result = UpdateNoteSchema.parse({
      remId: 'rem-456',
      addAliases: ['İstanbul', '日本語'],
      removeAliases: ['Old Alias'],
    });

    expect(result.addAliases).toEqual(['İstanbul', '日本語']);
    expect(result.removeAliases).toEqual(['Old Alias']);
  });

  it('should reject missing update operations', () => {
    expect(() => UpdateNoteSchema.parse({ remId: 'rem-456' })).toThrow(
      'remnote_update_note requires title, addAliases, or removeAliases'
    );
  });

  it('should reject overlapping normalized alias operations', () => {
    expect(() =>
      UpdateNoteSchema.parse({
        remId: 'rem-456',
        addAliases: ['Same   Alias'],
        removeAliases: [' Same Alias '],
      })
    ).toThrow('Alias cannot be both added and removed: Same Alias');
  });

  it('should reject invalid alias update payloads', () => {
    expect(() => UpdateNoteSchema.parse({ remId: 'rem-456', addAliases: [''] })).toThrow(
      'Aliases must not be empty after whitespace normalization'
    );
    expect(() => UpdateNoteSchema.parse({ remId: 'rem-456', removeAliases: [1] })).toThrow();
  });

  it('should reject old mixed update fields', () => {
    expect(() =>
      UpdateNoteSchema.parse({
        remId: 'rem-456',
        title: 'New Title',
        appendContent: 'Append',
      })
    ).toThrow();
  });

  it('should reject missing remId', () => {
    expect(() => UpdateNoteSchema.parse({ title: 'New Title' })).toThrow();
  });
});

describe('SetDocumentStatusSchema', () => {
  it('should validate required fields and default dryRun to true', () => {
    const result = SetDocumentStatusSchema.parse({
      remId: 'rem-456',
      isDocument: true,
    });

    expect(result).toEqual({
      remId: 'rem-456',
      isDocument: true,
      dryRun: true,
    });
  });

  it('should validate expectedOldRemType', () => {
    const result = SetDocumentStatusSchema.parse({
      remId: 'rem-456',
      isDocument: true,
      dryRun: false,
      expectedOldRemType: 'concept',
    });

    expect(result.expectedOldRemType).toBe('concept');
    expect(result.dryRun).toBe(false);
  });

  it('should reject unknown expectedOldRemType', () => {
    expect(() =>
      SetDocumentStatusSchema.parse({
        remId: 'rem-456',
        isDocument: true,
        expectedOldRemType: 'folder',
      })
    ).toThrow();
  });

  it('should reject unknown fields', () => {
    expect(() =>
      SetDocumentStatusSchema.parse({
        remId: 'rem-456',
        isDocument: true,
        remType: 'document',
      })
    ).toThrow();
  });
});

describe('InsertChildrenSchema', () => {
  it('should validate first and last insertion', () => {
    expect(
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'first',
      })
    ).toEqual({ parentRemId: 'parent', content: 'description: text', position: 'first' });
  });

  it('should validate before and after insertion with siblingRemId', () => {
    expect(
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'before',
        siblingRemId: 'sibling',
      })
    ).toEqual({
      parentRemId: 'parent',
      content: 'description: text',
      position: 'before',
      siblingRemId: 'sibling',
    });
  });

  it('should accept exact reference tokens in inserted content', () => {
    const result = InsertChildrenSchema.parse({
      parentRemId: 'parent',
      content: 'Related [[id:target-rem-id]]',
      position: 'last',
    });

    expect(result.content).toBe('Related [[id:target-rem-id]]');
  });

  it('should reject before and after without siblingRemId', () => {
    expect(() =>
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'before',
      })
    ).toThrow('siblingRemId is required when position is before');

    expect(() =>
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'after',
      })
    ).toThrow('siblingRemId is required when position is after');
  });

  it('should reject siblingRemId for first and last', () => {
    expect(() =>
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'first',
        siblingRemId: 'sibling',
      })
    ).toThrow('siblingRemId must not be provided when position is first');

    expect(() =>
      InsertChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'description: text',
        position: 'last',
        siblingRemId: 'sibling',
      })
    ).toThrow('siblingRemId must not be provided when position is last');
  });
});

describe('ReplaceChildrenSchema', () => {
  it('should validate replacement content', () => {
    expect(
      ReplaceChildrenSchema.parse({
        parentRemId: 'parent',
        content: 'Replacement body',
      })
    ).toEqual({ parentRemId: 'parent', content: 'Replacement body' });
  });

  it('should accept exact reference tokens in replacement content', () => {
    const result = ReplaceChildrenSchema.parse({
      parentRemId: 'parent',
      content: 'Replacement [[id:target-rem-id]]',
    });

    expect(result.content).toBe('Replacement [[id:target-rem-id]]');
  });
});

describe('UpdateTagsSchema', () => {
  it('should validate exact ID tag updates', () => {
    expect(
      UpdateTagsSchema.parse({
        remId: 'note',
        addTagRemIds: ['tag-1'],
        removeTagRemIds: ['tag-2'],
      })
    ).toEqual({ remId: 'note', addTagRemIds: ['tag-1'], removeTagRemIds: ['tag-2'] });
  });

  it('should reject empty tag updates', () => {
    expect(() => UpdateTagsSchema.parse({ remId: 'note' })).toThrow(
      'remnote_update_tags requires addTagRemIds or removeTagRemIds'
    );
  });
});

describe('SetPropertySchema', () => {
  it('should validate text property writes', () => {
    expect(
      SetPropertySchema.parse({
        remId: 'note',
        tagRemId: 'tag',
        propertyRemId: 'property',
        value: { kind: 'text', text: 'People' },
      })
    ).toEqual({
      remId: 'note',
      tagRemId: 'tag',
      propertyRemId: 'property',
      value: { kind: 'text', text: 'People' },
    });
  });

  it('should accept exact reference tokens in text property values', () => {
    const result = SetPropertySchema.parse({
      remId: 'note',
      tagRemId: 'tag',
      propertyRemId: 'property',
      value: { kind: 'text', text: 'See [[id:target-rem-id]]' },
    });

    expect(result.value).toEqual({ kind: 'text', text: 'See [[id:target-rem-id]]' });
  });

  it('should validate Rem reference property writes', () => {
    expect(
      SetPropertySchema.parse({
        remId: 'note',
        tagRemId: 'tag',
        propertyRemId: 'property',
        value: { kind: 'rem_reference', remId: 'option-rem-id' },
      }).value
    ).toEqual({ kind: 'rem_reference', remId: 'option-rem-id' });
  });

  it('should validate property clearing', () => {
    expect(
      SetPropertySchema.parse({
        remId: 'note',
        tagRemId: 'tag',
        propertyRemId: 'property',
        value: { kind: 'clear' },
      }).value
    ).toEqual({ kind: 'clear' });
  });

  it('should reject unknown property value kinds', () => {
    expect(() =>
      SetPropertySchema.parse({
        remId: 'note',
        tagRemId: 'tag',
        propertyRemId: 'property',
        value: { kind: 'select_option', optionRemId: 'option' },
      })
    ).toThrow();
  });

  it('should reject empty exact IDs', () => {
    expect(() =>
      SetPropertySchema.parse({
        remId: '',
        tagRemId: 'tag',
        propertyRemId: 'property',
        value: { kind: 'text', text: 'People' },
      })
    ).toThrow();
  });
});

describe('AppendJournalSchema', () => {
  it('should validate with only required content field', () => {
    const result = AppendJournalSchema.parse({ content: 'Journal entry' });
    expect(result.content).toBe('Journal entry');
    expect(result.timestamp).toBe(true); // default
  });

  it('should apply default timestamp of true', () => {
    const result = AppendJournalSchema.parse({ content: 'Test' });
    expect(result.timestamp).toBe(true);
  });

  it('should validate with timestamp false', () => {
    const result = AppendJournalSchema.parse({ content: 'Test', timestamp: false });
    expect(result.timestamp).toBe(false);
  });

  it('should validate exact tag Rem IDs', () => {
    const result = AppendJournalSchema.parse({
      content: 'Test',
      tagRemIds: ['tag-rem-id-1'],
    });
    expect(result.tagRemIds).toEqual(['tag-rem-id-1']);
  });

  it('should accept exact reference tokens in journal content', () => {
    const result = AppendJournalSchema.parse({ content: 'Journal [[id:target-rem-id]]' });

    expect(result.content).toBe('Journal [[id:target-rem-id]]');
  });

  it('should reject missing content', () => {
    expect(() => AppendJournalSchema.parse({})).toThrow();
  });

  it('should reject non-string content', () => {
    expect(() => AppendJournalSchema.parse({ content: 123 })).toThrow();
  });

  it('should reject non-boolean timestamp', () => {
    expect(() => AppendJournalSchema.parse({ content: 'Test', timestamp: 'yes' })).toThrow();
  });

  it('should reject unknown fields', () => {
    expect(() => AppendJournalSchema.parse({ content: 'Test', tags: ['tag-name'] })).toThrow();
  });
});

describe('ReadTableSchema', () => {
  it('should validate with tableRemId', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'abc123' });
    expect(result.tableRemId).toBe('abc123');
  });

  it('should apply default limit of 50', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'abc123' });
    expect(result.limit).toBe(50);
  });

  it('should apply default offset of 0', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'abc123' });
    expect(result.offset).toBe(0);
  });

  it('should validate with explicit limit', () => {
    const result = ReadTableSchema.parse({ tableTitle: 'Projects', limit: 100 });
    expect(result.limit).toBe(100);
  });

  it('should reject limit less than 1', () => {
    expect(() => ReadTableSchema.parse({ tableRemId: 'x', limit: 0 })).toThrow();
  });

  it('should reject limit greater than 150', () => {
    expect(() => ReadTableSchema.parse({ tableRemId: 'x', limit: 151 })).toThrow();
  });

  it('should accept limit of 150', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'x', limit: 150 });
    expect(result.limit).toBe(150);
  });

  it('should reject negative offset', () => {
    expect(() => ReadTableSchema.parse({ tableRemId: 'x', offset: -1 })).toThrow();
  });

  it('should accept offset of 0', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'x', offset: 0 });
    expect(result.offset).toBe(0);
  });

  it('should accept propertyFilter array', () => {
    const result = ReadTableSchema.parse({
      tableTitle: 'Projects',
      propertyFilter: ['Status', 'Priority'],
    });
    expect(result.propertyFilter).toEqual(['Status', 'Priority']);
  });

  it('should accept empty propertyFilter array', () => {
    const result = ReadTableSchema.parse({ tableRemId: 'x', propertyFilter: [] });
    expect(result.propertyFilter).toEqual([]);
  });

  it('should reject missing tableRemId/tableTitle', () => {
    expect(() => ReadTableSchema.parse({ limit: 50 })).toThrow();
  });

  it('should reject both tableRemId and tableTitle together', () => {
    expect(() => ReadTableSchema.parse({ tableRemId: 'abc123', tableTitle: 'Projects' })).toThrow();
  });

  it('should reject empty tableRemId', () => {
    expect(() => ReadTableSchema.parse({ tableRemId: '' })).toThrow();
  });
});
