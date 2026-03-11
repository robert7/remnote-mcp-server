import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().describe('The title of the note'),
  content: z.string().optional().describe('Content as child bullets (newline-separated)'),
  parentId: z.string().optional().describe('Parent Rem ID'),
  tags: z.array(z.string()).optional().describe('Tags to apply'),
  backText: z.string().optional().describe('Back text for flashcards'),
  isConcept: z.boolean().optional().describe('Whether to create a Concept card (::)'),
  isDescriptor: z.boolean().optional().describe('Whether to create a Descriptor card (;;)'),
});

export const CreateNoteMdSchema = z.object({
  content: z.string().describe('Markdown text to convert into a hierarchical tree'),
  title: z.string().optional().describe('Optional parent Rem title to enclose the tree'),
  parentId: z.string().optional().describe('Parent Rem ID where the tree will be created'),
  tags: z.array(z.string()).optional().describe('Tags to apply to the root/title Rem'),
});

export const SearchSchema = z.object({
  query: z.string().describe('Search query text'),
  limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('none')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(1)
    .describe('Depth of child hierarchy to render (when includeContent is markdown or structured)'),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(20)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(3000)
    .describe('Maximum character length for rendered content'),
});

export const SearchByTagSchema = z.object({
  tag: z.string().min(1).describe('Tag name to search (with or without # prefix)'),
  limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('none')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(1)
    .describe('Depth of child hierarchy to render (when includeContent is markdown or structured)'),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(20)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(3000)
    .describe('Maximum character length for rendered content'),
});

export const ReadNoteSchema = z.object({
  remId: z.string().describe('The Rem ID to read'),
  depth: z.number().int().min(0).max(10).default(5).describe('Depth of child hierarchy to render'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('markdown')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(100000)
    .describe('Maximum character length for rendered content'),
});

export const UpdateNoteSchema = z
  .object({
    remId: z.string().describe('The Rem ID to update'),
    title: z.string().optional().describe('New title'),
    appendContent: z.string().optional().describe('Content to append as children'),
    replaceContent: z
      .string()
      .optional()
      .describe('Content to replace direct children (empty string clears children)'),
    addTags: z.array(z.string()).optional().describe('Tags to add'),
    removeTags: z.array(z.string()).optional().describe('Tags to remove'),
  })
  .refine((value) => !(value.appendContent !== undefined && value.replaceContent !== undefined), {
    message: 'appendContent and replaceContent cannot be used together',
    path: ['replaceContent'],
  });

export const AppendJournalSchema = z.object({
  content: z.string().describe("Content to append to today's daily document"),
  timestamp: z.boolean().default(true).describe('Include timestamp'),
});
