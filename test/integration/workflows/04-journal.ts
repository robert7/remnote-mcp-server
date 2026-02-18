/**
 * Workflow 04: Journal
 *
 * Appends entries to today's daily document with and without timestamps.
 */

import { assertTruthy, assertHasField } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function journalWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  // Step 1: Append with timestamp (default)
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_append_journal', {
        content: `[MCP-TEST] Journal entry ${ctx.runId}`,
      });
      assertHasField(result, 'remId', 'journal append with timestamp');
      assertTruthy(typeof result.remId === 'string', 'remId should be a string');
      steps.push({ label: 'Append with timestamp', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Append with timestamp',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2: Append without timestamp
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_append_journal', {
        content: `[MCP-TEST] No-timestamp entry ${ctx.runId}`,
        timestamp: false,
      });
      assertHasField(result, 'remId', 'journal append without timestamp');
      steps.push({
        label: 'Append without timestamp',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Append without timestamp',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Journal', steps, skipped: false };
}
