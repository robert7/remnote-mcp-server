/**
 * Workflow 03: Create & Search
 *
 * Creates notes via CLI, waits for indexing, then searches for them.
 * Stores note IDs in shared state for downstream workflows.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertHasField, assertTruthy, assertIsArray, assertEqual } from '../assertions.js';
import { assertInlineRefTargetCountAtLeast } from '../../reference-assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

const INDEXING_DELAY_MS = parseInt(process.env.CLI_TEST_DELAY ?? '2000', 10);

async function withTempContentFile<T>(
  content: string,
  fn: (path: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'remnote-cli-it-create-'));
  const path = join(dir, 'content.md');
  try {
    await writeFile(path, content, 'utf8');
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function summarizeSearchResults(
  results: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return results.slice(0, 8).map((r) => ({
    remId: r.remId,
    title: r.title,
    headline: r.headline,
    hasContent: 'content' in r,
    hasContentStructured: 'contentStructured' in r,
  }));
}

function findMatchingSearchResult(
  results: Array<Record<string, unknown>>,
  remId: string
): Record<string, unknown> {
  const match = results.find((r) => r.remId === remId);
  assertTruthy(match, 'should find matching rich note result');
  return match as Record<string, unknown>;
}

function findSearchResultByTitleSubstring(
  results: Array<Record<string, unknown>>,
  titleSubstring: string
): Record<string, unknown> {
  const match = results.find(
    (r) => typeof r.title === 'string' && r.title.includes(titleSubstring)
  );
  assertTruthy(match, `should find result title containing ${titleSubstring}`);
  return match as Record<string, unknown>;
}

function assertParentContext(
  note: Record<string, unknown>,
  state: SharedState,
  label: string
): void {
  assertTruthy(typeof state.integrationParentRemId === 'string', `${label}: parent remId in state`);
  assertTruthy(typeof state.integrationParentTitle === 'string', `${label}: parent title in state`);
  assertEqual(
    note.parentRemId as string,
    state.integrationParentRemId as string,
    `${label}: parentRemId`
  );
  assertEqual(
    note.parentTitle as string,
    state.integrationParentTitle as string,
    `${label}: parentTitle`
  );
}

function assertTagsInclude(
  note: Record<string, unknown>,
  expectedTag: string,
  label: string
): void {
  assertHasField(note, 'tags', `${label}: tags`);
  assertIsArray(note.tags, `${label}: tags`);
  assertTruthy(
    (note.tags as unknown[]).some(
      (tag) =>
        tag &&
        typeof tag === 'object' &&
        (tag as Record<string, unknown>).name === expectedTag &&
        typeof (tag as Record<string, unknown>).tagRemId === 'string'
    ),
    `${label}: tags should include ${expectedTag}`
  );
}

function assertSearchContentModeShape(
  note: Record<string, unknown>,
  mode: 'markdown' | 'structured' | 'none'
): void {
  if (mode === 'markdown') {
    assertTruthy(typeof note.content === 'string', 'markdown mode should include string content');
    assertTruthy((note.content as string).length > 0, 'markdown content should be non-empty');
    assertTruthy(!('contentStructured' in note), 'markdown mode should omit contentStructured');
    return;
  }

  if (mode === 'structured') {
    assertIsArray(note.contentStructured, 'structured mode contentStructured');
    assertTruthy(
      Array.isArray(note.contentStructured) && note.contentStructured.length > 0,
      'structured mode should include non-empty contentStructured'
    );
    assertTruthy(!('content' in note), 'structured mode should omit markdown content');
    return;
  }

  assertTruthy(!('content' in note), 'none mode should omit markdown content');
  assertTruthy(!('contentStructured' in note), 'none mode should omit structured content');
}

function addSearchPageRemIds(
  seenRemIds: Set<string>,
  results: Array<Record<string, unknown>>,
  label: string
): void {
  for (const result of results) {
    const remId = result.remId;
    assertTruthy(typeof remId === 'string', `${label}: result remId should be string`);
    assertTruthy(!seenRemIds.has(remId as string), `${label}: duplicate remId ${String(remId)}`);
    seenRemIds.add(remId as string);
  }
}

interface ExpectedTagTarget {
  remId: string;
  remType: string;
  source: 'documentAncestor' | 'nearestNonDocumentAncestor' | 'self';
}

async function resolveExpectedSearchByTagTarget(
  ctx: WorkflowContext,
  taggedRemId: string
): Promise<ExpectedTagTarget> {
  const tagged = (await ctx.cli.runExpectSuccess([
    'read',
    taggedRemId,
    '--content-mode',
    'none',
  ])) as Record<string, unknown>;

  let currentParentId =
    typeof tagged.parentRemId === 'string' && tagged.parentRemId.length > 0
      ? (tagged.parentRemId as string)
      : undefined;

  let nearestNonDocumentAncestor: { remId: string; remType: string } | undefined;

  while (currentParentId) {
    const parent = (await ctx.cli.runExpectSuccess([
      'read',
      currentParentId,
      '--content-mode',
      'none',
    ])) as Record<string, unknown>;

    const parentRemId = parent.remId as string;
    const parentRemType = parent.remType as string;
    if (!nearestNonDocumentAncestor) {
      nearestNonDocumentAncestor = { remId: parentRemId, remType: parentRemType };
    }

    if (parentRemType === 'document' || parentRemType === 'dailyDocument') {
      return {
        remId: parentRemId,
        remType: parentRemType,
        source: 'documentAncestor',
      };
    }

    currentParentId =
      typeof parent.parentRemId === 'string' && parent.parentRemId.length > 0
        ? (parent.parentRemId as string)
        : undefined;
  }

  if (nearestNonDocumentAncestor) {
    return {
      remId: nearestNonDocumentAncestor.remId,
      remType: nearestNonDocumentAncestor.remType,
      source: 'nearestNonDocumentAncestor',
    };
  }

  return {
    remId: tagged.remId as string,
    remType: tagged.remType as string,
    source: 'self',
  };
}

export async function createSearchWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  const sanitizedRunId = ctx.runId.replace(/[^a-zA-Z0-9]/g, '-');
  const compactRunId = ctx.runId.replace(/[^a-zA-Z0-9]/g, '');
  const mdTreeRootOnlyTag = `cli-tree-root-${sanitizedRunId}`;
  const simpleSearchToken = `clisimple${compactRunId}`;
  const mdTreeSearchToken = `clitree${compactRunId}`;
  const pagingSearchToken = `clipaging${compactRunId}`;
  const tagPagingToken = `clitagpaging${compactRunId}`;
  const pagingNoteIds: string[] = [];
  const tagPagingNoteIds: string[] = [];

  if (!state.integrationParentRemId) {
    return {
      name: 'Create & Search',
      steps: [
        {
          label: 'Skipped — integration parent note not initialized',
          passed: false,
          durationMs: 0,
          error: 'No integrationParentRemId in shared state',
        },
      ],
      skipped: true,
    };
  }

  if (!state.searchByTagTag) {
    state.searchByTagTag = `cli-test-tag-${sanitizedRunId}`;
  }

  let mdTreeRootOnlyTagRemId: string | undefined;
  let tagPagingRemId: string | undefined;

  // Step 0: Create tag Rems used by exact-ID create tagging
  {
    const start = Date.now();
    try {
      if (!state.searchByTagTagRemId) {
        const result = (await ctx.cli.runExpectSuccess(['create', state.searchByTagTag])) as Record<
          string,
          unknown
        >;
        assertHasField(result, 'remIds', 'create search tag rem');
        assertIsArray(result.remIds, 'search tag remIds');
        state.searchByTagTagRemId = (result.remIds as string[])[0];
      }

      const mdTagResult = (await ctx.cli.runExpectSuccess(['create', mdTreeRootOnlyTag])) as Record<
        string,
        unknown
      >;
      assertHasField(mdTagResult, 'remIds', 'create markdown tree tag rem');
      assertIsArray(mdTagResult.remIds, 'markdown tree tag remIds');
      mdTreeRootOnlyTagRemId = (mdTagResult.remIds as string[])[0];

      const tagPagingResult = (await ctx.cli.runExpectSuccess([
        'create',
        tagPagingToken,
      ])) as Record<string, unknown>;
      assertHasField(tagPagingResult, 'remIds', 'create search-by-tag paging tag rem');
      assertIsArray(tagPagingResult.remIds, 'search-by-tag paging tag remIds');
      tagPagingRemId = (tagPagingResult.remIds as string[])[0];

      steps.push({ label: 'Create tag Rems', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Create tag Rems',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 1: Create simple note (title-only)
  {
    const start = Date.now();
    try {
      const title = `[CLI-TEST] Simple Note ${simpleSearchToken}`;
      const originalAlias = `Pôvodný názov ${ctx.runId}`;
      const unicodeAlias = `한국어 ${ctx.runId}`;
      const result = (await ctx.cli.runExpectSuccess([
        'create',
        title,
        '--parent-id',
        state.integrationParentRemId,
        '--aliases',
        ` Pôvodný   názov ${ctx.runId} `,
        originalAlias,
        unicodeAlias,
        ` ${title.replaceAll(' ', '   ')} `,
      ])) as Record<string, unknown>;
      assertHasField(result, 'remIds', 'create simple note');
      assertIsArray(result.remIds, 'remIds should be an array');
      state.noteAId = (result.remIds as string[])[0];
      const reread = (await ctx.cli.runExpectSuccess([
        'read',
        state.noteAId,
        '--content-mode',
        'none',
        '--view',
        'full',
      ])) as Record<string, unknown>;
      assertTruthy(Array.isArray(reread.aliases), 'created aliases should be an array');
      assertEqual(
        JSON.stringify(reread.aliases),
        JSON.stringify([originalAlias, unicodeAlias]),
        'CLI create aliases should normalize, deduplicate, suppress the title, and preserve Unicode'
      );
      steps.push({ label: 'Create simple note', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Create simple note',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2: Create rich note (with content-only and tags)
  {
    const start = Date.now();
    try {
      const result = (await withTempContentFile('This is test content', async (contentPath) => {
        return (await ctx.cli.runExpectSuccess([
          'create',
          `[CLI-TEST] Rich Note ${ctx.runId}`,
          '--parent-id',
          state.integrationParentRemId as string,
          '--content-file',
          contentPath,
          '--tag-ids',
          state.searchByTagTagRemId as string,
        ])) as Record<string, unknown>;
      })) as Record<string, unknown>;
      assertHasField(result, 'remIds', 'create rich note');
      assertIsArray(result.remIds, 'remIds should be an array');
      state.noteBId = (result.remIds as string[])[0];
      steps.push({ label: 'Create rich note', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Create rich note',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 3: Create flashcard note with positional arguments
  {
    const start = Date.now();
    try {
      const result = (await ctx.cli.runExpectSuccess([
        'create',
        `[CLI-TEST] Flashcard Note ${ctx.runId}`,
        '--content',
        'Front :: Back',
        '--parent-id',
        state.integrationParentRemId as string,
        '--tag-ids',
        state.searchByTagTagRemId as string,
      ])) as Record<string, unknown>;
      assertHasField(result, 'remIds', 'create flashcard note');
      assertIsArray(result.remIds, 'remIds should be an array');
      state.noteCId = (result.remIds as string[])[0];

      steps.push({
        label: 'Create flashcard with positional arguments checks',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create flashcard with positional arguments checks',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 3b: Create note with exact reference tokens in title and content
  {
    const start = Date.now();
    try {
      assertTruthy(typeof state.noteAId === 'string', 'reference target note remId');
      const result = (await withTempContentFile(
        `Created content exact ref [[id:${state.noteAId}]]`,
        async (contentPath) =>
          (await ctx.cli.runExpectSuccess([
            'create',
            '--title',
            `[CLI-TEST] Exact Ref Create ${ctx.runId} [[id:${state.noteAId}]]`,
            '--parent-id',
            state.integrationParentRemId as string,
            '--content-file',
            contentPath,
          ])) as Record<string, unknown>
      )) as Record<string, unknown>;
      assertHasField(result, 'remIds', 'create exact reference note');
      assertIsArray(result.remIds, 'exact reference note remIds');
      const createdRemId = (result.remIds as string[])[0];
      assertTruthy(typeof createdRemId === 'string', 'exact reference note remId');

      const reread = await ctx.cli.runExpectSuccess([
        'read',
        createdRemId,
        '--content-mode',
        'structured',
        '--depth',
        '2',
        '--view',
        'full',
      ]);
      assertInlineRefTargetCountAtLeast(
        reread,
        state.noteAId as string,
        2,
        'CLI create exact reference token readback'
      );

      steps.push({
        label: 'Create note with exact reference tokens',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create note with exact reference tokens',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 4: Create markdown tree with various flashcard types
  {
    const start = Date.now();
    try {
      const markdownContent = [
        `- Flashcard Tree`,
        `  - Basic Forward >> Answer`,
        `  - Basic Backward << Answer`,
        `  - Two-way :: Answer`,
        `  - Disabled >- Answer`,
        `  - Cloze with {{hidden}}{({hint text})} text`,
        `  - Concept :: Definition`,
        `  - Concept Forward :> Definition`,
        `  - Concept Backward :< Definition`,
        `  - Descriptor ;; Detail`,
        `  - Multi-line >>>`,
        `    - Card Item 1`,
        `    - Card Item 2`,
        `  - List-answer >>1.`,
        `    - First list item`,
        `    - Second list item`,
        `  - Multiple-choice >>A)`,
        `    - Correct option`,
        `    - Wrong option`,
        `  - Search token ${mdTreeSearchToken}`,
      ].join('\n');

      const result = (await withTempContentFile(markdownContent, async (contentPath) => {
        return (await ctx.cli.runExpectSuccess([
          'create',
          '--parent-id',
          state.integrationParentRemId as string,
          '--content-file',
          contentPath,
          '--title',
          `[CLI-TEST] Flashcard Tree ${mdTreeSearchToken}`,
          '--tag-ids',
          state.searchByTagTagRemId as string,
          mdTreeRootOnlyTagRemId as string,
        ])) as Record<string, unknown>;
      })) as Record<string, unknown>;

      assertHasField(result, 'remIds', 'create markdown tree');
      assertIsArray(result.remIds, 'markdown tree remIds');
      state.mdTreeIds = result.remIds as string[];
      steps.push({
        label: 'Create md tree with flashcards',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create md tree with flashcards',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 5: Create paging fixture notes
  {
    const start = Date.now();
    try {
      for (let i = 1; i <= 5; i += 1) {
        const result = (await ctx.cli.runExpectSuccess([
          'create',
          `[CLI-TEST] ${pagingSearchToken} item ${i}`,
          '--parent-id',
          state.integrationParentRemId as string,
          '--tag-ids',
          tagPagingRemId as string,
        ])) as { remIds: string[] };
        assertHasField(result, 'remIds', `create paging note ${i}`);
        assertIsArray(result.remIds, `create paging note ${i} remIds`);
        pagingNoteIds.push(result.remIds[0]);
        tagPagingNoteIds.push(result.remIds[0]);
      }
      steps.push({
        label: 'Create paging fixture notes',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create paging fixture notes',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Wait for indexing
  await new Promise((r) => setTimeout(r, INDEXING_DELAY_MS));

  // Step 6: Search for created notes
  {
    const start = Date.now();
    try {
      const result = (await ctx.cli.runExpectSuccess([
        'search',
        simpleSearchToken,
        '--limit',
        '20',
      ])) as Record<string, unknown>;
      assertHasField(result, 'results', 'search results');
      assertIsArray(result.results, 'search results');
      const results = result.results as Array<Record<string, unknown>>;
      assertTruthy(results.length >= 1, 'should find at least one note');
      assertTruthy(typeof state.noteAId === 'string', 'simple note remId should be recorded');
      const simpleMatch = findMatchingSearchResult(results, state.noteAId as string);
      assertParentContext(simpleMatch, state, 'search simple note parent context');
      steps.push({
        label: 'Search finds created notes',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search finds created notes',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 7: Search with parent-id scopes search successfully
  {
    const start = Date.now();
    try {
      const scopedResult = (await ctx.cli.runExpectSuccess([
        'search',
        simpleSearchToken,
        '--parent-id',
        state.integrationParentRemId,
        '--limit',
        '20',
      ])) as Record<string, unknown>;
      assertHasField(scopedResult, 'results', 'scoped search results');
      assertIsArray(scopedResult.results, 'scoped search results array');
      const scopedResults = scopedResult.results as Array<Record<string, unknown>>;
      const foundInParent = scopedResults.some(
        (r) => typeof r.title === 'string' && r.title.includes(simpleSearchToken)
      );
      assertTruthy(foundInParent, 'scoped search under correct parent should find simple note');

      assertTruthy(typeof state.noteBId === 'string', 'rich note remId should be recorded');
      const nonScopedResult = (await ctx.cli.runExpectSuccess([
        'search',
        simpleSearchToken,
        '--parent-id',
        state.noteBId as string,
        '--limit',
        '20',
      ])) as Record<string, unknown>;
      assertHasField(nonScopedResult, 'results', 'non-scoped search results');
      assertIsArray(nonScopedResult.results, 'non-scoped search results array');
      const nonScopedResults = nonScopedResult.results as Array<Record<string, unknown>>;
      const foundInDummy = nonScopedResults.some(
        (r) => typeof r.title === 'string' && r.title.includes(simpleSearchToken)
      );
      assertTruthy(
        !foundInDummy,
        'scoped search under unrelated parent should NOT find simple note'
      );

      steps.push({
        label: 'Search with parent-id scopes search successfully via CLI',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search with parent-id scopes search successfully via CLI',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 8: Search pages through cursor results
  {
    const start = Date.now();
    try {
      assertEqual(pagingNoteIds.length, 5, 'paging fixture note count');
      const firstPage = (await ctx.cli.runExpectSuccess([
        'search',
        pagingSearchToken,
        '--parent-id',
        state.integrationParentRemId,
        '--limit',
        '2',
        '--content-mode',
        'none',
      ])) as Record<string, unknown>;
      assertHasField(firstPage, 'results', 'search paging first page');
      assertIsArray(firstPage.results, 'search paging first page results');
      assertEqual((firstPage.results as unknown[]).length, 2, 'first page result count');
      assertEqual(firstPage.hasMore as boolean, true, 'first page hasMore');
      assertTruthy(typeof firstPage.nextCursor === 'string', 'first page nextCursor');
      assertEqual(firstPage.truncated as boolean, false, 'first page truncated');
      assertTruthy(typeof state.noteBId === 'string', 'rich note remId should be recorded');
      const mismatchedCursorResult = await ctx.cli.runExpectError([
        'search',
        pagingSearchToken,
        '--parent-id',
        state.noteBId as string,
        '--limit',
        '2',
        '--cursor',
        firstPage.nextCursor as string,
        '--content-mode',
        'none',
      ]);
      const mismatchedCursorOutput = `${mismatchedCursorResult.stderr}\n${mismatchedCursorResult.stdout}`;
      assertTruthy(
        mismatchedCursorOutput.includes('cursor') && mismatchedCursorOutput.includes('parent'),
        `scoped search cursor should reject changed parent-id, got ${mismatchedCursorOutput}`
      );

      const seenRemIds = new Set<string>();
      addSearchPageRemIds(
        seenRemIds,
        firstPage.results as Array<Record<string, unknown>>,
        'first paging page'
      );

      let cursor = firstPage.nextCursor as string;
      let lastPage = firstPage;
      for (let page = 2; page <= 4 && cursor; page += 1) {
        const nextPage = (await ctx.cli.runExpectSuccess([
          'search',
          pagingSearchToken,
          '--parent-id',
          state.integrationParentRemId,
          '--limit',
          '2',
          '--cursor',
          cursor,
          '--content-mode',
          'none',
        ])) as Record<string, unknown>;
        assertHasField(nextPage, 'results', `search paging page ${page}`);
        assertIsArray(nextPage.results, `search paging page ${page} results`);
        assertTruthy(
          (nextPage.results as unknown[]).length <= 2,
          `search paging page ${page} respects limit`
        );
        addSearchPageRemIds(
          seenRemIds,
          nextPage.results as Array<Record<string, unknown>>,
          `paging page ${page}`
        );
        lastPage = nextPage;
        cursor = typeof nextPage.nextCursor === 'string' ? (nextPage.nextCursor as string) : '';
      }

      for (const remId of pagingNoteIds) {
        assertTruthy(seenRemIds.has(remId), `paging results should include ${remId}`);
      }
      assertEqual(lastPage.hasMore as boolean, false, 'last paging page hasMore');
      assertTruthy(!('nextCursor' in lastPage), 'last paging page should omit nextCursor');

      steps.push({
        label: 'Search cursor paging returns all fixture notes',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search cursor paging returns all fixture notes',
        passed: false,
        durationMs: Date.now() - start,
        error: `${(e as Error).message} | token=${JSON.stringify(pagingSearchToken)} fixtureIds=${JSON.stringify(
          pagingNoteIds
        )}`,
      });
    }
  }

  // Step 9: Search-by-tag pages through cursor results
  {
    const start = Date.now();
    try {
      assertTruthy(tagPagingRemId, 'search-by-tag paging tag Rem ID should be recorded');
      assertEqual(tagPagingNoteIds.length, 5, 'search-by-tag paging fixture note count');
      const firstPage = (await ctx.cli.runExpectSuccess([
        'search-by-tag',
        '--tag-id',
        tagPagingRemId as string,
        '--result-mode',
        'tagged',
        '--limit',
        '2',
        '--content-mode',
        'none',
        '--timeout-ms',
        '30000',
      ])) as Record<string, unknown>;
      assertHasField(firstPage, 'results', 'search-by-tag paging first page');
      assertIsArray(firstPage.results, 'search-by-tag paging first page results');
      assertEqual((firstPage.results as unknown[]).length, 2, 'search-by-tag first page count');
      assertEqual(firstPage.hasMore as boolean, true, 'search-by-tag first page hasMore');
      assertTruthy(typeof firstPage.nextCursor === 'string', 'search-by-tag first page nextCursor');
      assertEqual(firstPage.truncated as boolean, false, 'search-by-tag first page truncated');

      const seenRemIds = new Set<string>();
      addSearchPageRemIds(
        seenRemIds,
        firstPage.results as Array<Record<string, unknown>>,
        'first search-by-tag paging page'
      );

      let cursor = firstPage.nextCursor as string;
      let lastPage = firstPage;
      for (let page = 2; page <= 4 && cursor; page += 1) {
        const nextPage = (await ctx.cli.runExpectSuccess([
          'search-by-tag',
          '--tag-id',
          tagPagingRemId as string,
          '--result-mode',
          'tagged',
          '--limit',
          '2',
          '--cursor',
          cursor,
          '--content-mode',
          'none',
        ])) as Record<string, unknown>;
        assertHasField(nextPage, 'results', `search-by-tag paging page ${page}`);
        assertIsArray(nextPage.results, `search-by-tag paging page ${page} results`);
        assertTruthy(
          (nextPage.results as unknown[]).length <= 2,
          `search-by-tag paging page ${page} respects limit`
        );
        addSearchPageRemIds(
          seenRemIds,
          nextPage.results as Array<Record<string, unknown>>,
          `search-by-tag paging page ${page}`
        );
        lastPage = nextPage;
        cursor = typeof nextPage.nextCursor === 'string' ? (nextPage.nextCursor as string) : '';
      }

      for (const remId of tagPagingNoteIds) {
        assertTruthy(seenRemIds.has(remId), `search-by-tag paging results should include ${remId}`);
      }
      assertEqual(lastPage.hasMore as boolean, false, 'last search-by-tag paging page hasMore');
      assertTruthy(!('nextCursor' in lastPage), 'last search-by-tag page should omit nextCursor');

      steps.push({
        label: 'Search-by-tag cursor paging returns all fixture notes',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search-by-tag cursor paging returns all fixture notes',
        passed: false,
        durationMs: Date.now() - start,
        error: `${(e as Error).message} | tag=${JSON.stringify(tagPagingRemId ?? null)} fixtureIds=${JSON.stringify(
          tagPagingNoteIds
        )}`,
      });
    }
  }

  // Step 10-12: Search with contentMode modes
  for (const mode of ['markdown', 'structured', 'none'] as const) {
    const start = Date.now();
    const label = `Search contentMode=${mode} returns expected shape`;
    const query = mdTreeSearchToken;
    let debugResults: Array<Record<string, unknown>> | null = null;
    try {
      const result = (await ctx.cli.runExpectSuccess([
        'search',
        query,
        '--content-mode',
        mode,
      ])) as Record<string, unknown>;
      assertHasField(result, 'results', `search ${mode}`);
      assertIsArray(result.results, `search ${mode} results`);
      const results = result.results as Array<Record<string, unknown>>;
      debugResults = results;
      assertTruthy(results.length >= 1, `search ${mode} should return results`);
      const match = findSearchResultByTitleSubstring(results, mdTreeSearchToken);
      assertSearchContentModeShape(match, mode);
      assertParentContext(match, state, `search ${mode} parent context`);
      assertTruthy(typeof state.searchByTagTag === 'string', 'search tag should be recorded');
      assertTagsInclude(match, state.searchByTagTag as string, `search ${mode}`);
      steps.push({
        label,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label,
        passed: false,
        durationMs: Date.now() - start,
        error:
          `${(e as Error).message} | query=${JSON.stringify(query)} expectedRemId=${JSON.stringify(
            mdTreeSearchToken
          )}` +
          (debugResults
            ? ` resultCount=${debugResults.length} topResults=${JSON.stringify(
                summarizeSearchResults(debugResults)
              )}`
            : ''),
      });
    }
  }

  // Step 13: Root-only markdown tree tag does not bleed to descendants
  {
    const start = Date.now();
    let debugResults: Array<Record<string, unknown>> | null = null;
    try {
      assertTruthy(
        typeof state.mdTreeIds?.[0] === 'string',
        'md tree root remId should be recorded'
      );
      const expectedTarget = await resolveExpectedSearchByTagTarget(
        ctx,
        state.mdTreeIds?.[0] as string
      );
      assertTruthy(mdTreeRootOnlyTagRemId, 'markdown tree root-only tag Rem ID should be recorded');
      const result = (await ctx.cli.runExpectSuccess([
        'search-by-tag',
        '--tag-id',
        mdTreeRootOnlyTagRemId as string,
        '--content-mode',
        'none',
        '--limit',
        '10',
      ])) as Record<string, unknown>;
      assertHasField(result, 'results', 'search-by-tag markdown tree root-only tag');
      assertIsArray(result.results, 'search-by-tag markdown tree root-only tag results');
      const results = result.results as Array<Record<string, unknown>>;
      debugResults = results;
      assertEqual(
        results.length,
        1,
        'root-only markdown tree tag should resolve to exactly one target'
      );
      findMatchingSearchResult(results, expectedTarget.remId);
      steps.push({
        label: 'Root-only markdown tree tag excludes descendants',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Root-only markdown tree tag excludes descendants',
        passed: false,
        durationMs: Date.now() - start,
        error:
          `${(e as Error).message} | tag=${JSON.stringify(mdTreeRootOnlyTag)}` +
          (debugResults
            ? ` resultCount=${debugResults.length} topResults=${JSON.stringify(
                summarizeSearchResults(debugResults)
              )}`
            : ''),
      });
    }
  }

  // Step 14: Resolve expected search-by-tag ancestor target
  let expectedTagTarget: ExpectedTagTarget | undefined;
  {
    const start = Date.now();
    try {
      assertTruthy(typeof state.noteBId === 'string', 'rich note remId should be recorded');
      expectedTagTarget = await resolveExpectedSearchByTagTarget(ctx, state.noteBId as string);
      steps.push({
        label: 'Resolve expected search-by-tag ancestor target',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Resolve expected search-by-tag ancestor target',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 15-17: Search by exact tag Rem ID with contentMode modes

  for (const mode of ['markdown', 'structured', 'none'] as const) {
    const start = Date.now();
    const label = `Search-by-tag contentMode=${mode} returns expected shape`;
    let debugResults: Array<Record<string, unknown>> | null = null;
    try {
      assertTruthy(typeof state.searchByTagTag === 'string', 'searchByTagTag should be recorded');
      assertTruthy(
        typeof state.searchByTagTagRemId === 'string',
        'searchByTagTagRemId should be recorded'
      );
      const result = (await ctx.cli.runExpectSuccess([
        'search-by-tag',
        '--tag-id',
        state.searchByTagTagRemId as string,
        '--content-mode',
        mode,
      ])) as Record<string, unknown>;
      assertHasField(result, 'results', `search-by-tag ${mode}`);
      assertIsArray(result.results, `search-by-tag ${mode} results`);
      const results = result.results as Array<Record<string, unknown>>;
      debugResults = results;
      assertTruthy(results.length >= 1, `search-by-tag ${mode} should return results`);
      assertTruthy(expectedTagTarget, 'expected tag target should be resolved');
      const match = findMatchingSearchResult(
        results,
        (expectedTagTarget as ExpectedTagTarget).remId
      );
      assertSearchContentModeShape(match, mode);
      steps.push({
        label,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label,
        passed: false,
        durationMs: Date.now() - start,
        error:
          `${(e as Error).message} | tag=${JSON.stringify(state.searchByTagTag ?? null)} expectedTarget=${JSON.stringify(expectedTagTarget ?? null)}` +
          (debugResults
            ? ` resultCount=${debugResults.length} topResults=${JSON.stringify(
                summarizeSearchResults(debugResults)
              )}`
            : ''),
      });
    }
  }

  return { name: 'Create & Search', steps, skipped: false };
}
