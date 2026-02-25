/**
 * Shared types for integration test workflows.
 */

import type { McpTestClient } from './mcp-test-client.js';

/** Result of a single test step within a workflow. */
export interface StepResult {
  label: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

/** Result of an entire workflow (collection of steps). */
export interface WorkflowResult {
  name: string;
  steps: StepResult[];
  skipped: boolean;
}

/** Context passed to each workflow function. */
export interface WorkflowContext {
  client: McpTestClient;
  runId: string;
}

/** Shared state passed between workflows for cross-workflow dependencies. */
export interface SharedState {
  integrationParentRemId?: string;
  integrationParentTitle?: string;
  searchByTagTag?: string;
  noteAId?: string;
  noteBId?: string;
}

/** A workflow function signature. */
export type WorkflowFn = (ctx: WorkflowContext, state: SharedState) => Promise<WorkflowResult>;
