/**
 * Integration test runner for RemNote MCP Server.
 *
 * Runs real MCP tool calls against a live server with a connected RemNote plugin.
 * Creates real content in RemNote — all prefixed with [MCP-TEST] for easy cleanup.
 *
 * Usage:
 *   npm run test:integration          # Interactive — prompts for confirmation
 *   npm run test:integration -- --yes # Skip confirmation prompt
 *
 * Environment variables:
 *   REMNOTE_MCP_URL  — MCP server URL (default: http://127.0.0.1:3001)
 *   MCP_TEST_DELAY   — Delay in ms after create before search (default: 2000)
 */

import * as readline from 'node:readline';
import { McpTestClient } from './mcp-test-client.js';
import { statusWorkflow } from './workflows/01-status.js';
import { createSearchWorkflow } from './workflows/02-create-search.js';
import { readUpdateWorkflow } from './workflows/03-read-update.js';
import { journalWorkflow } from './workflows/04-journal.js';
import { errorCasesWorkflow } from './workflows/05-error-cases.js';
import type { WorkflowResult, WorkflowFn, SharedState } from './types.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const INTEGRATION_PARENT_TITLE = 'RemNote Automation Bridge [temporary integration test data]';
const INTEGRATION_PARENT_TAG = 'remnote-integration-root-anchor';
const INTEGRATION_PARENT_SEARCH_QUERIES = [
  INTEGRATION_PARENT_TITLE,
  'RemNote Automation Bridge temporary integration test data',
  'temporary integration test data',
];

interface IntegrationParentResolution {
  status: 'reused' | 'created';
  strategy: 'search' | 'tag' | 'create';
  remId: string;
  title: string;
  exactMatches: number;
  candidateCount: number;
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function printBanner(): void {
  console.log(`
${BOLD}╔═══════════════════════════════════════════════╗
║  RemNote MCP Server — Integration Tests       ║
║  ${YELLOW}WARNING: Creates real content in RemNote!${RESET}${BOLD}    ║
╚═══════════════════════════════════════════════╝${RESET}
`);
}

async function confirmPrompt(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Continue? (y/N) ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function printStepResult(label: string, passed: boolean, durationMs: number, error?: string): void {
  const icon = passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const timing = `${DIM}(${durationMs}ms)${RESET}`;
  console.log(`  ${icon} ${label} ${timing}`);
  if (error) {
    console.log(`    ${RED}${error}${RESET}`);
  }
}

function printWorkflowResult(index: number, result: WorkflowResult): void {
  const prefix = String(index + 1).padStart(2, '0');
  if (result.skipped) {
    console.log(`\n${DIM}[${prefix}] ${result.name} (skipped)${RESET}`);
  } else {
    console.log(`\n[${prefix}] ${result.name}`);
  }
  for (const step of result.steps) {
    printStepResult(step.label, step.passed, step.durationMs, step.error);
  }
}

function printSummary(results: WorkflowResult[], totalDurationMs: number): void {
  const totalWorkflows = results.length;
  const passedWorkflows = results.filter(
    (r) => !r.skipped && r.steps.every((s) => s.passed)
  ).length;
  const totalSteps = results.reduce((sum, r) => sum + r.steps.length, 0);
  const passedSteps = results.reduce((sum, r) => sum + r.steps.filter((s) => s.passed).length, 0);

  const allPassed = passedWorkflows === totalWorkflows;
  const color = allPassed ? GREEN : RED;

  console.log(`\n${BOLD}═══ Summary ═══${RESET}`);
  console.log(
    `${color}${passedWorkflows}/${totalWorkflows} workflows passed (${passedSteps}/${totalSteps} steps)${RESET}`
  );
  console.log(`Duration: ${(totalDurationMs / 1000).toFixed(1)}s`);

  console.log(`\n${BOLD}═══ Cleanup ═══${RESET}`);
  console.log('Test artifacts created with prefix [MCP-TEST].');
  console.log('Search your RemNote KB for "[MCP-TEST]" to find and delete them.');
}

async function ensureIntegrationParentNote(
  client: McpTestClient,
  state: SharedState
): Promise<IntegrationParentResolution> {
  const expectedTitle = normalizeTitle(INTEGRATION_PARENT_TITLE);
  const candidateMap = new Map<string, Record<string, unknown>>();

  for (const query of INTEGRATION_PARENT_SEARCH_QUERIES) {
    const searchResult = await client.callTool('remnote_search', {
      query,
      limit: 150,
      includeContent: 'none',
    });
    const candidates = Array.isArray(searchResult.results)
      ? (searchResult.results as Array<Record<string, unknown>>)
      : [];
    for (const candidate of candidates) {
      if (typeof candidate.remId !== 'string') continue;
      if (!candidateMap.has(candidate.remId)) {
        candidateMap.set(candidate.remId, candidate);
      }
    }
  }

  const searchCandidates = Array.from(candidateMap.values());
  const exactSearchMatches = searchCandidates.filter(
    (item) =>
      typeof item.title === 'string' && normalizeTitle(item.title as string) === expectedTitle
  );

  if (exactSearchMatches.length > 0) {
    const selected = exactSearchMatches[0];
    state.integrationParentRemId = selected.remId as string;
    state.integrationParentTitle = selected.title as string;
    // Ensure deterministic future lookups via dedicated anchor tag.
    await client.callTool('remnote_update_note', {
      remId: selected.remId as string,
      addTags: [INTEGRATION_PARENT_TAG],
    });
    return {
      status: 'reused',
      strategy: 'search',
      remId: selected.remId as string,
      title: selected.title as string,
      exactMatches: exactSearchMatches.length,
      candidateCount: searchCandidates.length,
    };
  }

  const byTagResult = await client.callTool('remnote_search_by_tag', {
    tag: INTEGRATION_PARENT_TAG,
    limit: 150,
    includeContent: 'none',
  });
  const tagCandidates = Array.isArray(byTagResult.results)
    ? (byTagResult.results as Array<Record<string, unknown>>)
    : [];
  const exactTagMatches = tagCandidates.filter(
    (item) =>
      typeof item.remId === 'string' &&
      typeof item.title === 'string' &&
      normalizeTitle(item.title as string) === expectedTitle
  );

  if (exactTagMatches.length > 0) {
    const selected = exactTagMatches[0];
    state.integrationParentRemId = selected.remId as string;
    state.integrationParentTitle = selected.title as string;
    return {
      status: 'reused',
      strategy: 'tag',
      remId: selected.remId as string,
      title: selected.title as string,
      exactMatches: exactTagMatches.length,
      candidateCount: tagCandidates.length,
    };
  }

  const createResult = await client.callTool('remnote_create_note', {
    title: INTEGRATION_PARENT_TITLE,
    tags: [INTEGRATION_PARENT_TAG],
  });

  if (typeof createResult.remId !== 'string') {
    throw new Error(
      `Failed to initialize integration parent note. Response: ${JSON.stringify(createResult)}`
    );
  }

  state.integrationParentRemId = createResult.remId;
  state.integrationParentTitle = INTEGRATION_PARENT_TITLE;
  return {
    status: 'created',
    strategy: 'create',
    remId: createResult.remId,
    title: INTEGRATION_PARENT_TITLE,
    exactMatches: 0,
    candidateCount: searchCandidates.length + tagCandidates.length,
  };
}

async function main(): Promise<void> {
  const skipConfirm = process.argv.includes('--yes');
  const baseUrl = process.env.REMNOTE_MCP_URL ?? 'http://127.0.0.1:3001';
  const mcpUrl = baseUrl.endsWith('/mcp') ? baseUrl : `${baseUrl}/mcp`;
  const runId = new Date().toISOString();

  printBanner();

  if (!skipConfirm) {
    const confirmed = await confirmPrompt();
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log(`Server: ${mcpUrl}`);
  console.log(`Run ID: ${runId}`);

  const client = new McpTestClient();
  const results: WorkflowResult[] = [];
  const state: SharedState = {};
  const overallStart = Date.now();

  // Connect to MCP server
  try {
    await client.connect(baseUrl);
  } catch (e) {
    console.error(`\n${RED}Failed to connect to MCP server at ${mcpUrl}${RESET}`);
    console.error(`${RED}${(e as Error).message}${RESET}`);
    console.error(`\nMake sure the server is running: ${BOLD}npm run dev${RESET}`);
    process.exit(1);
  }

  try {
    const parentResolution = await ensureIntegrationParentNote(client, state);
    if (parentResolution.status === 'reused') {
      console.log(
        `Integration parent: found existing via ${parentResolution.strategy} "${parentResolution.title}" (${parentResolution.remId}) [exact matches: ${parentResolution.exactMatches}, candidates: ${parentResolution.candidateCount}]`
      );
    } else {
      console.log(
        `Integration parent: not found via search/tag lookups, created "${parentResolution.title}" (${parentResolution.remId}) [candidates checked: ${parentResolution.candidateCount}]`
      );
    }
  } catch (e) {
    console.error(
      `${RED}Failed to initialize integration parent note "${INTEGRATION_PARENT_TITLE}"${RESET}`
    );
    console.error(`${RED}${(e as Error).message}${RESET}`);
    process.exit(1);
  }

  // Define workflow sequence
  const workflows: Array<{ name: string; fn: WorkflowFn }> = [
    { name: 'Status Check', fn: statusWorkflow },
    { name: 'Create & Search', fn: createSearchWorkflow },
    { name: 'Read & Update', fn: readUpdateWorkflow },
    { name: 'Journal', fn: journalWorkflow },
    { name: 'Error Cases', fn: errorCasesWorkflow },
  ];

  try {
    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];

      // If status check failed, skip remaining workflows
      if (i === 1 && results[0] && results[0].steps.some((s) => !s.passed)) {
        const skippedResult: WorkflowResult = {
          name: workflow.name,
          steps: [
            {
              label: 'Skipped — status check failed',
              passed: false,
              durationMs: 0,
              error: 'Prerequisite workflow 01 (Status Check) failed',
            },
          ],
          skipped: true,
        };
        results.push(skippedResult);
        printWorkflowResult(i, skippedResult);
        // Skip all remaining workflows too
        for (let j = i + 1; j < workflows.length; j++) {
          const skipped: WorkflowResult = {
            name: workflows[j].name,
            steps: [
              {
                label: 'Skipped — status check failed',
                passed: false,
                durationMs: 0,
                error: 'Prerequisite workflow 01 (Status Check) failed',
              },
            ],
            skipped: true,
          };
          results.push(skipped);
          printWorkflowResult(j, skipped);
        }
        break;
      }

      const result = await workflow.fn({ client, runId }, state);
      results.push(result);
      printWorkflowResult(i, result);
    }
  } finally {
    await client.close();
  }

  const totalDuration = Date.now() - overallStart;
  printSummary(results, totalDuration);

  const allPassed = results.every((r) => !r.skipped && r.steps.every((s) => s.passed));
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n${RED}Unexpected error: ${(e as Error).message}${RESET}`);
  process.exit(1);
});
