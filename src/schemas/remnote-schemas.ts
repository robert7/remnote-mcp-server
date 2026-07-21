import { z } from 'zod';

const ContentModeSchema = z.enum(['none', 'markdown', 'structured']);
const ViewSchema = z.enum(['compact', 'standard', 'full']);
const RemClassificationSchema = z.enum([
  'document',
  'dailyDocument',
  'concept',
  'descriptor',
  'portal',
  'text',
]);
const AncestorDepthSchema = z
  .number()
  .int()
  .min(0)
  .max(20)
  .default(0)
  .describe('Number of parent Rems to include, direct parent first');

const SearchContentShape = {
  contentMode: ContentModeSchema.default('none').describe(
    'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
  ),
  view: ViewSchema.default('standard').describe('Output detail level: compact, standard, or full'),
  ancestorDepth: AncestorDepthSchema,
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(1)
    .describe('Depth of child hierarchy to render when contentMode is markdown or structured'),
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
};

const normalizeAliasText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const AliasArraySchema = z
  .array(
    z.string().refine((value) => normalizeAliasText(value).length > 0, {
      message: 'Aliases must not be empty after whitespace normalization',
    })
  )
  .optional();

export const CreateNoteSchema = z
  .object({
    title: z.string().optional().describe('The title of the note'),
    content: z
      .string()
      .optional()
      .describe(
        'Content as child bullets (markdown supported, including exact references as [[id:<remId>]])'
      ),
    parentId: z.string().optional().describe('Parent Rem ID'),
    tagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to apply'),
    asDocument: z
      .boolean()
      .optional()
      .describe('Mark the created title/root Rem as a document without changing card status'),
    aliases: AliasArraySchema.describe('Alternate names to create on the explicit title/root Rem'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.title === undefined && value.content === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'create_note requires either title or content',
      });
    }
    if (value.title === undefined && (value.aliases?.length ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'create_note aliases requires title so the alias target is unambiguous',
        path: ['aliases'],
      });
    }
  });

export const SearchSchema = z
  .object({
    query: z.string().describe('Search query text'),
    parentRemId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional non-empty Rem ID. Scope the search to within this Rem's subtree. The Rem itself is excluded from results."
      ),
    limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
    cursor: z
      .string()
      .optional()
      .describe('Opaque cursor returned by a previous remnote_search page'),
    ...SearchContentShape,
  })
  .strict();

export const SearchByTagSchema = z
  .object({
    tagRemId: z.string().min(1).describe('Exact tag Rem ID to search'),
    resultMode: z
      .enum(['context', 'tagged'])
      .default('context')
      .describe(
        '"context" returns resolved ancestor context targets with matchedRems; "tagged" returns directly tagged Rems with context metadata'
      ),
    limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
    cursor: z
      .string()
      .optional()
      .describe('Opaque cursor returned by a previous remnote_search_by_tag page'),
    timeoutMs: z
      .number()
      .int()
      .min(1)
      .max(60000)
      .optional()
      .describe('Per-call bridge wait timeout in milliseconds (default: 15000, max: 60000)'),
    ...SearchContentShape,
  })
  .strict();

export const ReadNoteSchema = z
  .object({
    remId: z.string().describe('The Rem ID to read'),
    depth: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(5)
      .describe('Depth of child hierarchy to render'),
    contentMode: ContentModeSchema.default('markdown').describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
    view: ViewSchema.default('standard').describe(
      'Output detail level: compact, standard, or full'
    ),
    ancestorDepth: AncestorDepthSchema,
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
    includeMediaMetadata: z
      .boolean()
      .default(false)
      .describe('Include ordered image metadata from the root Rem text and backText fields'),
  })
  .strict();

export const GetMediaSchema = z
  .object({
    remId: z.string().min(1).describe('Root Rem ID containing the image'),
    field: z.enum(['text', 'backText']).describe('Rich-text field containing the image'),
    mediaId: z.string().min(1).describe('Stable media ID returned by remnote_read_note'),
    maxInlineBytes: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024)
      .default(5 * 1024 * 1024)
      .describe('Maximum image bytes to inline (default 5 MiB, hard maximum 10 MiB)'),
  })
  .strict();

export const ListChildrenSchema = z
  .object({
    parentRemId: z.string().min(1).describe('Parent Rem ID whose direct children should be listed'),
    limit: z.number().int().min(1).max(150).default(50).describe('Maximum direct children'),
    cursor: z
      .string()
      .optional()
      .describe('Opaque cursor returned by a previous remnote_list_children page'),
    view: ViewSchema.default('compact').describe(
      'Output detail level for child metadata: compact, standard, or full'
    ),
    ancestorDepth: AncestorDepthSchema,
  })
  .strict();

export const InsertChildrenPositionSchema = z.enum(['first', 'last', 'before', 'after']);

export const MoveNoteSchema = z
  .object({
    remId: z.string().min(1).describe('Rem ID to move'),
    newParentRemId: z.string().min(1).describe('New parent Rem ID'),
    position: InsertChildrenPositionSchema.default('last').describe(
      'Where to place the moved Rem under the new parent'
    ),
    siblingRemId: z.string().optional().describe('Sibling Rem ID required for before/after'),
    dryRun: z.boolean().default(true).describe('Preview the move without mutating RemNote'),
    expectedOldParentRemId: z
      .string()
      .optional()
      .describe('Reject if the Rem current direct parent is different from this Rem ID'),
    ancestorDepth: AncestorDepthSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.position === 'before' || value.position === 'after') && !value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId is required when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
    if ((value.position === 'first' || value.position === 'last') && value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId must not be provided when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
  });

export const UpdateNoteSchema = z
  .object({
    remId: z.string().describe('The Rem ID to update'),
    title: z
      .string()
      .optional()
      .describe('New title (markdown supported, including exact references as [[id:<remId>]])'),
    addAliases: AliasArraySchema.describe('Aliases to add if not already present'),
    removeAliases: AliasArraySchema.describe('Aliases to remove by exact normalized match'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.title === undefined &&
      (value.addAliases?.length ?? 0) === 0 &&
      (value.removeAliases?.length ?? 0) === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'remnote_update_note requires title, addAliases, or removeAliases',
      });
    }

    const additions = new Set((value.addAliases ?? []).map(normalizeAliasText));
    const overlap = (value.removeAliases ?? [])
      .map(normalizeAliasText)
      .find((alias) => additions.has(alias));
    if (overlap !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Alias cannot be both added and removed: ${overlap}`,
        path: ['removeAliases'],
      });
    }
  });

export const SetDocumentStatusSchema = z
  .object({
    remId: z.string().min(1).describe('The Rem ID whose document status should change'),
    isDocument: z.boolean().describe('Whether the Rem should be marked as a document'),
    dryRun: z.boolean().default(true).describe('Preview the change without mutating RemNote'),
    expectedOldRemType: RemClassificationSchema.optional().describe(
      'Reject if the current bridge remType differs from this stale-context guard'
    ),
  })
  .strict();

export const InsertChildrenSchema = z
  .object({
    parentRemId: z.string().describe('Parent Rem ID that will receive the new children'),
    content: z
      .string()
      .describe(
        'Markdown content to insert as child Rems; use [[id:<remId>]] for exact Rem references'
      ),
    position: InsertChildrenPositionSchema.describe('Where to insert the new child Rems'),
    siblingRemId: z.string().optional().describe('Sibling Rem ID required for before/after'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.position === 'before' || value.position === 'after') && !value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId is required when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
    if ((value.position === 'first' || value.position === 'last') && value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId must not be provided when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
  });

export const ReplaceChildrenSchema = z
  .object({
    parentRemId: z.string().describe('Parent Rem ID whose direct children will be replaced'),
    content: z
      .string()
      .describe(
        'Markdown content to use as replacement children; use [[id:<remId>]] for exact Rem references'
      ),
  })
  .strict();

export const UpdateTagsSchema = z
  .object({
    remId: z.string().describe('The Rem ID whose tags should change'),
    addTagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to add'),
    removeTagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to remove'),
  })
  .strict()
  .refine((value) => Boolean(value.addTagRemIds?.length || value.removeTagRemIds?.length), {
    message: 'remnote_update_tags requires addTagRemIds or removeTagRemIds',
    path: ['addTagRemIds'],
  });

export const SetPropertyValueSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('text'),
      text: z
        .string()
        .describe(
          'Plain text or markdown value to store in the property; use [[id:<remId>]] for exact Rem references'
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('rem_reference'),
      remId: z
        .string()
        .min(1)
        .describe('Referenced Rem ID; use this for select-option Rem IDs too'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('clear'),
    })
    .strict(),
]);

export const SetPropertySchema = z
  .object({
    remId: z.string().min(1).describe('The Rem ID whose tag property should be set'),
    tagRemId: z.string().min(1).describe('Exact tag/table Rem ID that owns the property'),
    propertyRemId: z.string().min(1).describe('Exact property Rem ID under the tag/table Rem'),
    value: SetPropertyValueSchema.describe('Property value payload'),
  })
  .strict();

export const AppendJournalSchema = z
  .object({
    content: z
      .string()
      .describe(
        "Content to append to today's daily document; use [[id:<remId>]] for exact Rem references"
      ),
    timestamp: z.boolean().default(true).describe('Include timestamp'),
    tagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to apply'),
  })
  .strict();

export const ReadTableSchema = z
  .object({
    tableRemId: z.string().min(1).optional().describe('Table Rem ID'),
    tableTitle: z.string().min(1).optional().describe('Exact Advanced Table title'),
    limit: z.number().int().min(1).max(150).default(50).describe('Maximum rows to return'),
    offset: z.number().int().min(0).default(0).describe('0-based row offset for pagination'),
    propertyFilter: z.array(z.string()).optional().describe('Only return these property names'),
  })
  .superRefine((value, ctx) => {
    const provided = [value.tableRemId, value.tableTitle].filter(
      (entry) => typeof entry === 'string' && entry.length > 0
    );
    if (provided.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of tableRemId or tableTitle',
      });
    }
  });
