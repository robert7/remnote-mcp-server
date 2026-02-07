/**
 * Schema validation tests
 * Tests for all Zod schemas used in RemNote MCP server
 */

import { describe, it, expect } from 'vitest';
import {
  CreateNoteSchema,
  SearchSchema,
  ReadNoteSchema,
  UpdateNoteSchema,
  AppendJournalSchema,
} from '../../src/schemas/remnote-schemas.js';

describe('CreateNoteSchema', () => {
  it('should validate with only required title field', () => {
    const result = CreateNoteSchema.parse({ title: 'Test' });
    expect(result.title).toBe('Test');
    expect(result.content).toBeUndefined();
    expect(result.parentId).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it('should validate with all fields', () => {
    const input = {
      title: 'Test Note',
      content: 'Content',
      parentId: 'parent-123',
      tags: ['tag1', 'tag2'],
    };
    const result = CreateNoteSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('should reject missing title', () => {
    expect(() => CreateNoteSchema.parse({})).toThrow();
  });

  it('should reject non-string title', () => {
    expect(() => CreateNoteSchema.parse({ title: 123 })).toThrow();
  });

  it('should reject non-array tags', () => {
    expect(() => CreateNoteSchema.parse({ title: 'Test', tags: 'not-array' })).toThrow();
  });
});

describe('SearchSchema', () => {
  it('should validate with only required query field', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.query).toBe('test');
    expect(result.limit).toBe(20); // default
    expect(result.includeContent).toBe(false); // default
  });

  it('should apply default limit of 20', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.limit).toBe(20);
  });

  it('should apply default includeContent of false', () => {
    const result = SearchSchema.parse({ query: 'test' });
    expect(result.includeContent).toBe(false);
  });

  it('should validate with custom limit', () => {
    const result = SearchSchema.parse({ query: 'test', limit: 50 });
    expect(result.limit).toBe(50);
  });

  it('should validate with includeContent true', () => {
    const result = SearchSchema.parse({ query: 'test', includeContent: true });
    expect(result.includeContent).toBe(true);
  });

  it('should reject limit less than 1', () => {
    expect(() => SearchSchema.parse({ query: 'test', limit: 0 })).toThrow();
  });

  it('should reject limit greater than 100', () => {
    expect(() => SearchSchema.parse({ query: 'test', limit: 101 })).toThrow();
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
    expect(result.depth).toBe(3); // default
  });

  it('should apply default depth of 3', () => {
    const result = ReadNoteSchema.parse({ remId: 'rem-123' });
    expect(result.depth).toBe(3);
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

describe('UpdateNoteSchema', () => {
  it('should validate with only required remId field', () => {
    const result = UpdateNoteSchema.parse({ remId: 'rem-456' });
    expect(result.remId).toBe('rem-456');
    expect(result.title).toBeUndefined();
    expect(result.appendContent).toBeUndefined();
    expect(result.addTags).toBeUndefined();
    expect(result.removeTags).toBeUndefined();
  });

  it('should validate with all fields', () => {
    const input = {
      remId: 'rem-456',
      title: 'New Title',
      appendContent: 'More content',
      addTags: ['tag1'],
      removeTags: ['tag2'],
    };
    const result = UpdateNoteSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('should reject missing remId', () => {
    expect(() => UpdateNoteSchema.parse({ title: 'New Title' })).toThrow();
  });

  it('should reject non-array addTags', () => {
    expect(() => UpdateNoteSchema.parse({ remId: 'rem-456', addTags: 'not-array' })).toThrow();
  });

  it('should reject non-array removeTags', () => {
    expect(() => UpdateNoteSchema.parse({ remId: 'rem-456', removeTags: 'not-array' })).toThrow();
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

  it('should reject missing content', () => {
    expect(() => AppendJournalSchema.parse({})).toThrow();
  });

  it('should reject non-string content', () => {
    expect(() => AppendJournalSchema.parse({ content: 123 })).toThrow();
  });

  it('should reject non-boolean timestamp', () => {
    expect(() => AppendJournalSchema.parse({ content: 'Test', timestamp: 'yes' })).toThrow();
  });
});
