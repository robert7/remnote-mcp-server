/**
 * Workflow 03: Read & Update
 *
 * Reads notes created in workflow 02, updates title/content/tags,
 * and re-reads to verify the changes persisted.
 */

import { assertTruthy, assertHasField, assertIsArray, assertContains } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

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

  // Step 2: Read rich note has children
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteBId,
        depth: 3,
      });
      assertHasField(result, 'children', 'read rich note');
      assertIsArray(result.children, 'children');
      const children = result.children as unknown[];
      assertTruthy(children.length > 0, 'rich note should have children from bullet content');
      steps.push({
        label: 'Read rich note has children',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Read rich note has children',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
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
