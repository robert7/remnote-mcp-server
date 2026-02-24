/**
 * Workflow 03: Read & Update
 *
 * Reads notes created in workflow 02, updates title/content/tags,
 * and re-reads to verify the changes persisted.
 */

import { assertTruthy, assertHasField, assertContains } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

function summarizeReadResult(result: Record<string, unknown>): Record<string, unknown> {
  return {
    remId: result.remId,
    title: result.title,
    keys: Object.keys(result),
    hasContent: 'content' in result,
    hasContentProperties: 'contentProperties' in result,
    contentLength: typeof result.content === 'string' ? result.content.length : undefined,
    contentProperties: result.contentProperties,
  };
}

export async function readUpdateWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  if (!state.noteAId || !state.noteBId) {
    return {
      name: 'Read & Update',
      steps: [
        {
          label: 'Skipped — missing note IDs from workflow 02',
          passed: false,
          durationMs: 0,
          error: 'No note IDs available',
        },
      ],
      skipped: true,
    };
  }

  // Step 1: Read simple note
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        depth: 1,
      });
      assertHasField(result, 'title', 'read simple note');
      assertHasField(result, 'remId', 'read simple note');
      steps.push({ label: 'Read simple note', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Read simple note',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2-3: Read rich note includeContent modes
  for (const mode of ['markdown', 'none'] as const) {
    const start = Date.now();
    const label = `Read rich note includeContent=${mode} returns expected shape`;
    let debugResult: Record<string, unknown> | null = null;
    try {
      const result = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteBId,
        depth: 3,
        includeContent: mode,
      });
      debugResult = result;
      assertHasField(result, 'remId', 'read rich note remId');
      assertHasField(result, 'title', 'read rich note title');
      if (mode === 'markdown') {
        assertHasField(result, 'content', 'read rich note markdown');
        assertTruthy(typeof result.content === 'string', 'content should be a string');
        assertTruthy(
          (result.content as string).length > 0,
          'rich note should include rendered content in markdown mode'
        );
        assertHasField(result, 'contentProperties', 'read rich note contentProperties');
        const props = result.contentProperties as Record<string, unknown>;
        assertTruthy(typeof props.childrenRendered === 'number', 'childrenRendered should be number');
        assertTruthy(typeof props.childrenTotal === 'number', 'childrenTotal should be number');
        assertTruthy((props.childrenTotal as number) > 0, 'childrenTotal should be > 0');
      } else {
        assertTruthy(!('content' in result), 'none mode should omit content');
        assertTruthy(!('contentProperties' in result), 'none mode should omit contentProperties');
      }
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
          `${(e as Error).message} | remId=${JSON.stringify(state.noteBId)} mode=${mode}` +
          (debugResult ? ` result=${JSON.stringify(summarizeReadResult(debugResult))}` : ''),
      });
    }
  }

  // Step 3: Update title
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        title: `[MCP-TEST] Updated Note ${ctx.runId}`,
      });
      assertTruthy(result.success, 'update title should succeed');
      steps.push({ label: 'Update title', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Update title',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 4: Append content
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        appendContent: 'Appended via integration test',
      });
      assertTruthy(result.success, 'append content should succeed');
      steps.push({ label: 'Append content', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Append content',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 5: Add tag
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        addTags: ['mcp-integration-verified'],
      });
      assertTruthy(result.success, 'add tag should succeed');
      steps.push({ label: 'Add tag', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Add tag',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 6: Remove tag
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        removeTags: ['mcp-integration-verified'],
      });
      assertTruthy(result.success, 'remove tag should succeed');
      steps.push({ label: 'Remove tag', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Remove tag',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 7: Re-read verifies changes
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        depth: 2,
      });
      assertHasField(result, 'title', 're-read note');
      assertContains(result.title as string, 'Updated Note', 'title should reflect update');
      steps.push({
        label: 'Re-read verifies changes',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Re-read verifies changes',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Read & Update', steps, skipped: false };
}
