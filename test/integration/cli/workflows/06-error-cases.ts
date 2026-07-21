/**
 * Workflow 06: Error Cases
 *
 * Validates that the CLI handles invalid inputs gracefully:
 * nonexistent IDs, missing args, empty queries.
 */

import { assertTruthy, assertContains } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function errorCasesWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  // Step 1: Create rejects with neither title nor content (bridge-side validation)
  {
    const start = Date.now();
    try {
      // Current contract requires either title or content
      const result = await ctx.cli.runExpectError(['create']);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      steps.push({
        label: 'Create rejects with neither title nor content',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create rejects with neither title nor content',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2: Read nonexistent note returns error
  {
    const start = Date.now();
    try {
      const result = await ctx.cli.runExpectError(['read', 'nonexistent-id-00000']);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      steps.push({
        label: 'Read nonexistent note returns error',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Read nonexistent note returns error',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 3: Update nonexistent note returns error
  {
    const start = Date.now();
    try {
      const result = await ctx.cli.runExpectError([
        'update',
        'nonexistent-id-00000',
        '--title',
        'Nope',
      ]);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      steps.push({
        label: 'Update nonexistent note returns error',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Update nonexistent note returns error',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 4: Search with empty query handled gracefully
  {
    const start = Date.now();
    try {
      // Empty query might return empty results or an error — both are acceptable
      const result = await ctx.cli.run(['search', '']);
      // Either success with empty results or an error — both OK
      assertTruthy(result.exitCode === 0 || result.exitCode === 1, 'should exit with 0 or 1');
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

  // Step 5: Update rejects removed content flags
  {
    const start = Date.now();
    try {
      const result = await ctx.cli.runExpectError([
        'update',
        'conflict-id-00000',
        '--append',
        'Append body',
      ]);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      assertContains(result.stderr, '--append', 'stderr should mention removed append flag');
      steps.push({
        label: 'Update rejects removed content flags',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Update rejects removed content flags',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 6: Create detects argument shifting in options
  {
    const start = Date.now();
    try {
      // Missing value for --title causes it to swallow --content
      const result = await ctx.cli.runExpectError(['create', '--title', '--content', 'Body']);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      assertContains(
        result.stderr,
        'looks like a flag but was passed as an option value',
        'stderr should explain option shifting'
      );
      steps.push({
        label: 'Create detects option shifting',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Create detects option shifting',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 7: Update rejects missing title value
  {
    const start = Date.now();
    try {
      const result = await ctx.cli.runExpectError(['update', 'abc123', '--title']);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      assertContains(result.stderr, '--title', 'stderr should mention missing title value');
      steps.push({
        label: 'Update rejects missing title value',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Update rejects missing title value',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 8: Update rejects contradictory normalized alias operations
  {
    const start = Date.now();
    try {
      const result = await ctx.cli.runExpectError([
        'update',
        'validation-only-rem-id',
        '--add-aliases',
        'Same   Alias',
        '--remove-aliases',
        ' Same Alias ',
      ]);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      assertContains(
        result.stderr,
        'Alias cannot be both added and removed',
        'stderr should explain contradictory alias operations'
      );
      steps.push({
        label: 'Update rejects contradictory alias operations',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Update rejects contradictory alias operations',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 9: Journal detects argument shifting in options
  {
    const start = Date.now();
    try {
      // Missing value for --content causes it to swallow --no-timestamp
      const result = await ctx.cli.runExpectError(['journal', '--content', '--no-timestamp']);
      assertTruthy(result.exitCode !== 0, 'should have non-zero exit code');
      assertContains(
        result.stderr,
        'looks like a flag but was passed as an option value',
        'stderr should mention option shifting'
      );
      steps.push({
        label: 'Journal detects option shifting',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Journal detects option shifting',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Error Cases', steps, skipped: false };
}
