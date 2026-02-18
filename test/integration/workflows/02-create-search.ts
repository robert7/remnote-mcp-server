/**
 * Workflow 02: Create & Search
 *
 * Creates two notes (simple and rich), waits for indexing, then searches
 * for them to verify they are findable. Returns note IDs for downstream workflows.
 */

import { assertTruthy, assertHasField, assertIsArray } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function createSearchWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  const delay = parseInt(process.env.MCP_TEST_DELAY ?? '2000', 10);

  // Step 1: Create simple note
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_create_note', {
        title: `[MCP-TEST] Simple Note ${ctx.runId}`,
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

  // Step 4: Search with includeContent returns content
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_search', {
        query: `[MCP-TEST] Rich Note ${ctx.runId}`,
        includeContent: true,
      });
      assertHasField(result, 'results', 'search with content');
      const results = result.results as Array<Record<string, unknown>>;
      assertTruthy(results.length > 0, 'search should return results');
      const match = results.find((r) => typeof r.title === 'string' && r.title.includes(ctx.runId));
      assertTruthy(match, 'should find matching note');
      assertHasField(match as Record<string, unknown>, 'content', 'matching result');
      steps.push({
        label: 'Search with includeContent returns content',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search with includeContent returns content',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Create & Search', steps, skipped: false };
}
