/**
 * Workflow 05: Error Cases
 *
 * Validates that the server handles invalid inputs gracefully:
 * nonexistent IDs, missing required fields, empty queries.
 */

import { assertTruthy } from '../assertions.js';
import { ToolError } from '../mcp-test-client.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function errorCasesWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  // Step 1: Read nonexistent note returns error
  {
    const start = Date.now();
    try {
      const errorText = await ctx.client.callToolExpectError('remnote_read_note', {
        remId: 'nonexistent-id-00000',
      });
      assertTruthy(errorText, 'should return error text for nonexistent read');
      steps.push({
        label: 'Read nonexistent note returns error',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      // If callToolExpectError itself throws a ToolError, that's also valid
      if (e instanceof ToolError) {
        steps.push({
          label: 'Read nonexistent note returns error',
          passed: true,
          durationMs: Date.now() - start,
        });
      } else {
        steps.push({
          label: 'Read nonexistent note returns error',
          passed: false,
          durationMs: Date.now() - start,
          error: (e as Error).message,
        });
      }
    }
  }

  // Step 2: Update nonexistent note returns error
  {
    const start = Date.now();
    try {
      const errorText = await ctx.client.callToolExpectError('remnote_update_note', {
        remId: 'nonexistent-id-00000',
        title: 'Nope',
      });
      assertTruthy(errorText, 'should return error text for nonexistent update');
      steps.push({
        label: 'Update nonexistent note returns error',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      if (e instanceof ToolError) {
        steps.push({
          label: 'Update nonexistent note returns error',
          passed: true,
          durationMs: Date.now() - start,
        });
      } else {
        steps.push({
          label: 'Update nonexistent note returns error',
          passed: false,
          durationMs: Date.now() - start,
          error: (e as Error).message,
        });
      }
    }
  }

  // Step 3: Create without title returns validation error
  {
    const start = Date.now();
    try {
      const errorText = await ctx.client.callToolExpectError('remnote_create_note', {});
      assertTruthy(errorText, 'should return validation error for missing title');
      steps.push({
        label: 'Create without title returns validation error',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      if (e instanceof ToolError) {
        steps.push({
          label: 'Create without title returns validation error',
          passed: true,
          durationMs: Date.now() - start,
        });
      } else {
        steps.push({
          label: 'Create without title returns validation error',
          passed: false,
          durationMs: Date.now() - start,
          error: (e as Error).message,
        });
      }
    }
  }

  // Step 4: Search with empty query handled gracefully
  {
    const start = Date.now();
    try {
      // Empty query might return empty results or an error — both are acceptable
      try {
        const result = await ctx.client.callTool('remnote_search', { query: '' });
        // If it succeeds, it should at least have a results field
        assertTruthy(result !== undefined, 'should return some response');
      } catch (e) {
        // ToolError is acceptable — server rejected empty query
        if (!(e instanceof ToolError)) {
          throw e;
        }
      }
      steps.push({
        label: 'Search with empty query handled gracefully',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Search with empty query handled gracefully',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Error Cases', steps, skipped: false };
}
