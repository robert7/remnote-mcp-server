import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().describe('The title of the note'),
  content: z.string().optional().describe('Content as child bullets (newline-separated)'),
  parentId: z.string().optional().describe('Parent Rem ID'),
  tags: z.array(z.string()).optional().describe('Tags to apply'),
});

export const SearchSchema = z.object({
  query: z.string().describe('Search query text'),
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum results'),
  includeContent: z.boolean().default(false).describe('Include child content'),
});

export const ReadNoteSchema = z.object({
  remId: z.string().describe('The Rem ID to read'),
  depth: z.number().int().min(0).max(10).default(3).describe('Depth of children'),
});

export const UpdateNoteSchema = z.object({
  remId: z.string().describe('The Rem ID to update'),
  title: z.string().optional().describe('New title'),
  appendContent: z.string().optional().describe('Content to append as children'),
  addTags: z.array(z.string()).optional().describe('Tags to add'),
  removeTags: z.array(z.string()).optional().describe('Tags to remove'),
});

export const AppendJournalSchema = z.object({
  content: z.string().describe("Content to append to today's daily document"),
  timestamp: z.boolean().default(true).describe('Include timestamp'),
});
