/**
 * Workflow 02: Create & Search
 *
 * Creates two notes (simple and rich), waits for indexing, then searches
 * for them to verify they are findable. Returns note IDs for downstream workflows.
 */

import { assertTruthy, assertHasField, assertIsArray, assertEqual } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

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
  assertTruthy(match, 'should find matching note');
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

export async function createSearchWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  const delay = parseInt(process.env.MCP_TEST_DELAY ?? '2000', 10);

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

  // Step 1: Create simple note
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_create_note', {
        title: `[MCP-TEST] Simple Note ${ctx.runId}`,
        parentId: state.integrationParentRemId,
      });
      assertHasField(result, 'remId', 'create simple note');
      assertTruthy(typeof result.remId === 'string', 'remId should be a string');
      state.noteAId = result.remId as string;
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

  // Step 2: Create rich note with content and tags
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_create_note', {
        title: `[MCP-TEST] Rich Note ${ctx.runId}`,
        parentId: state.integrationParentRemId,
        content: 'Bullet one\nBullet two\nBullet three',
        tags: ['mcp-test-tag'],
      });
      assertHasField(result, 'remId', 'create rich note');
      assertTruthy(typeof result.remId === 'string', 'remId should be a string');
      state.noteBId = result.remId as string;
      steps.push({
        label: 'Create rich note with content and tags',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create rich note with content and tags',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Wait for RemNote indexing
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Step 3: Search finds simple note
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_search', {
        query: `[MCP-TEST] Simple Note ${ctx.runId}`,
        limit: 5,
      });
      assertHasField(result, 'results', 'search simple note');
      assertIsArray(result.results, 'search results');
      const results = result.results as Array<Record<string, unknown>>;
      assertTruthy(results.length > 0, 'search should return at least one result');
      const found = results.some((r) => typeof r.title === 'string' && r.title.includes(ctx.runId));
      assertTruthy(found, 'at least one result title should contain runId');
      assertTruthy(typeof state.noteAId === 'string', 'simple note remId should be recorded');
      const simpleMatch = findMatchingSearchResult(results, state.noteAId as string);
      assertParentContext(simpleMatch, state, 'search simple note parent context');
      steps.push({
        label: 'Search finds simple note',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search finds simple note',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 4-6: Search with includeContent modes
  for (const mode of ['markdown', 'structured', 'none'] as const) {
    const start = Date.now();
    const label = `Search includeContent=${mode} returns expected shape`;
    const query = `[MCP-TEST] ${ctx.runId}`;
    let debugResults: Array<Record<string, unknown>> | null = null;
    try {
      const result = await ctx.client.callTool('remnote_search', {
        query,
        includeContent: mode,
      });
      assertHasField(result, 'results', `search ${mode}`);
      assertIsArray(result.results, `search ${mode} results`);
      const results = result.results as Array<Record<string, unknown>>;
      debugResults = results;
      assertTruthy(results.length > 0, `search ${mode} should return results`);
      assertTruthy(typeof state.noteBId === 'string', 'rich note remId should be recorded');
      const match = findMatchingSearchResult(results, state.noteBId as string);
      assertSearchContentModeShape(match, mode);
      assertParentContext(match, state, `search ${mode} parent context`);
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
            state.noteBId ?? null
          )}` +
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
