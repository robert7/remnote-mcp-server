/**
 * Workflow 01: Status Check (gatekeeper)
 *
 * Verifies the MCP server is connected to RemNote via the bridge plugin.
 * If this workflow fails, all subsequent workflows should be skipped.
 */

import { assertTruthy, assertHasField } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function statusWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  // Step 1: remnote_status returns connected: true
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_status');
      assertTruthy(result.connected, 'connected should be true');
      steps.push({
        label: 'remnote_status returns connected: true',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'remnote_status returns connected: true',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2: pluginVersion is present
  {
    const start = Date.now();
    try {
      const result = await ctx.client.callTool('remnote_status');
      assertHasField(result, 'pluginVersion', 'status response');
      assertTruthy(typeof result.pluginVersion === 'string', 'pluginVersion should be a string');
      steps.push({
        label: 'pluginVersion is present',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'pluginVersion is present',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Status Check', steps, skipped: false };
}
