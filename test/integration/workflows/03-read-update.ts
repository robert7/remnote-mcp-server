/**
 * Workflow 03: Read & Update
 *
 * Reads notes created in workflow 02, updates title/content/tags,
 * and re-reads to verify the changes persisted.
 */

import {
  assertTruthy,
  assertHasField,
  assertContains,
  assertEqual,
  assertIsArray,
  assertStringArrayEqualUnordered,
} from '../assertions.js';
import { assertInlineRefTarget } from '../reference-assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

function summarizeReadResult(result: Record<string, unknown>): Record<string, unknown> {
  return {
    remId: result.remId,
    title: result.title,
    keys: Object.keys(result),
    hasContent: 'content' in result,
    hasContentStructured: 'contentStructured' in result,
    hasContentProperties: 'contentProperties' in result,
    contentLength: typeof result.content === 'string' ? result.content.length : undefined,
    contentProperties: result.contentProperties,
  };
}

function normalizedTags(value: unknown): string {
  if (!Array.isArray(value)) return '[]';
  return JSON.stringify(
    value
      .map((tag) => {
        const record = tag as Record<string, unknown>;
        return { tagRemId: record.tagRemId, name: record.name };
      })
      .sort((left, right) => String(left.tagRemId).localeCompare(String(right.tagRemId)))
  );
}

function assertParentMetadataUnchanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  label: string
): void {
  for (const field of ['remId', 'title', 'remType', 'parentRemId', 'cardDirection'] as const) {
    assertEqual(after[field], before[field], `${label}: ${field}`);
  }
  assertStringArrayEqualUnordered(
    after.aliases ?? [],
    (before.aliases ?? []) as string[],
    `${label}: aliases`
  );
  assertEqual(normalizedTags(after.tags), normalizedTags(before.tags), `${label}: tags`);
}

async function listChildrenUntilFound(
  ctx: WorkflowContext,
  parentRemId: string,
  targetRemId: string
): Promise<Record<string, unknown> | undefined> {
  let cursor: string | undefined;

  do {
    const payload: Record<string, unknown> = {
      parentRemId,
      limit: 150,
      ancestorDepth: 1,
    };
    if (cursor) payload.cursor = cursor;

    const result = (await ctx.client.callTool('remnote_list_children', payload)) as Record<
      string,
      unknown
    >;
    assertIsArray(result.children, 'list children result');

    const children = result.children as Array<Record<string, unknown>>;
    const found = children.find((child) => child.remId === targetRemId);
    if (found) return found;

    cursor = typeof result.nextCursor === 'string' ? result.nextCursor : undefined;
    if (result.hasMore !== true) cursor = undefined;
  } while (cursor);

  return undefined;
}

function findMatchingSearchResult(
  results: Array<Record<string, unknown>>,
  remId: string
): Record<string, unknown> {
  const match = results.find((r) => r.remId === remId);
  assertTruthy(match, 'should find matching search-by-tag target');
  return match as Record<string, unknown>;
}

async function resolveExpectedSearchByTagTarget(
  ctx: WorkflowContext,
  taggedRemId: string
): Promise<string> {
  const tagged = (await ctx.client.callTool('remnote_read_note', {
    remId: taggedRemId,
    contentMode: 'none',
  })) as Record<string, unknown>;

  let currentParentId =
    typeof tagged.parentRemId === 'string' && tagged.parentRemId.length > 0
      ? (tagged.parentRemId as string)
      : undefined;
  let nearestNonDocumentAncestorId: string | undefined;

  while (currentParentId) {
    const parent = (await ctx.client.callTool('remnote_read_note', {
      remId: currentParentId,
      contentMode: 'none',
    })) as Record<string, unknown>;

    const parentRemId = parent.remId as string;
    const parentRemType = parent.remType as string;
    if (!nearestNonDocumentAncestorId) {
      nearestNonDocumentAncestorId = parentRemId;
    }

    if (parentRemType === 'document' || parentRemType === 'dailyDocument') {
      return parentRemId;
    }

    currentParentId =
      typeof parent.parentRemId === 'string' && parent.parentRemId.length > 0
        ? (parent.parentRemId as string)
        : undefined;
  }

  return nearestNonDocumentAncestorId ?? (tagged.remId as string);
}

export async function readUpdateWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  const tagVerificationName = `mcp-integration-verified-${ctx.runId.replace(/[^a-zA-Z0-9]/g, '-')}`;

  function assertTagsInclude(
    note: Record<string, unknown>,
    expectedTag: string,
    label: string
  ): void {
    assertHasField(note, 'tags', `${label}: tags`);
    assertIsArray(note.tags, `${label}: tags`);
    assertTruthy(
      (note.tags as unknown[]).some(
        (tag) =>
          tag &&
          typeof tag === 'object' &&
          (tag as Record<string, unknown>).name === expectedTag &&
          typeof (tag as Record<string, unknown>).tagRemId === 'string'
      ),
      `${label}: tags should include ${expectedTag}`
    );
  }

  function assertTagsExclude(
    note: Record<string, unknown>,
    excludedTag: string,
    label: string
  ): void {
    if (!('tags' in note)) {
      return;
    }

    assertIsArray(note.tags, `${label}: tags`);
    assertTruthy(
      !(note.tags as unknown[]).some(
        (tag) =>
          tag && typeof tag === 'object' && (tag as Record<string, unknown>).name === excludedTag
      ),
      `${label}: tags should not include ${excludedTag}`
    );
  }

  if (
    !state.noteAId ||
    !state.noteBId ||
    !state.integrationParentRemId ||
    !state.integrationParentTitle
  ) {
    return {
      name: 'Read & Update',
      steps: [
        {
          label: 'Skipped — missing note IDs or integration parent from workflow 02/setup',
          passed: false,
          durationMs: 0,
          error: 'No note IDs or integration parent state available',
        },
      ],
      skipped: true,
    };
  }

  const acceptReplaceOperation = state.acceptReplaceOperation ?? false;
  let tagVerificationRemId: string | undefined;

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
      assertHasField(result, 'parentRemId', 'read simple note parentRemId');
      assertHasField(result, 'parentTitle', 'read simple note parentTitle');
      assertEqual(
        result.parentRemId as string,
        state.integrationParentRemId as string,
        'read simple note parentRemId should match integration parent'
      );
      assertEqual(
        result.parentTitle as string,
        state.integrationParentTitle as string,
        'read simple note parentTitle should match integration parent'
      );
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

  // Step 1b: Read ancestors for hierarchy placement context
  {
    const start = Date.now();
    try {
      const result = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
        ancestorDepth: 5,
      })) as Record<string, unknown>;
      assertIsArray(result.ancestors, 'read note ancestors');
      const ancestors = result.ancestors as Array<Record<string, unknown>>;
      assertTruthy(ancestors.length > 0, 'read note should include at least one ancestor');
      assertEqual(
        ancestors[0].remId as string,
        state.integrationParentRemId as string,
        'first ancestor should be direct integration parent'
      );
      steps.push({
        label: 'Read note with ancestors',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Read note with ancestors',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 1c: List direct children without reading a whole subtree
  {
    const start = Date.now();
    try {
      assertTruthy(
        await listChildrenUntilFound(
          ctx,
          state.integrationParentRemId as string,
          state.noteAId as string
        ),
        'list children should include note A as a direct child'
      );
      steps.push({ label: 'List direct children', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'List direct children',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 1d: Dry-run and apply a safe move on a temporary note
  {
    const start = Date.now();
    try {
      const created = (await ctx.client.callTool('remnote_create_note', {
        title: `[MCP-TEST] Move Candidate ${ctx.runId}`,
        parentId: state.integrationParentRemId,
      })) as { remIds: string[] };
      assertIsArray(created.remIds, 'move candidate remIds');
      const moveCandidateRemId = created.remIds[0];
      assertTruthy(
        typeof moveCandidateRemId === 'string',
        'move candidate Rem ID should be string'
      );

      const dryRun = (await ctx.client.callTool('remnote_move_note', {
        remId: moveCandidateRemId,
        newParentRemId: state.noteAId,
        expectedOldParentRemId: state.integrationParentRemId,
        ancestorDepth: 2,
      })) as Record<string, unknown>;
      assertEqual(dryRun.dryRun as boolean, true, 'move dry-run should not mutate');

      const afterDryRun = (await ctx.client.callTool('remnote_read_note', {
        remId: moveCandidateRemId,
        contentMode: 'none',
      })) as Record<string, unknown>;
      assertEqual(
        afterDryRun.parentRemId as string,
        state.integrationParentRemId as string,
        'dry-run should leave parent unchanged'
      );

      const moved = (await ctx.client.callTool('remnote_move_note', {
        remId: moveCandidateRemId,
        newParentRemId: state.noteAId,
        expectedOldParentRemId: state.integrationParentRemId,
        dryRun: false,
        ancestorDepth: 2,
      })) as Record<string, unknown>;
      assertEqual(moved.dryRun as boolean, false, 'move mutation should report dryRun=false');

      const afterMove = (await ctx.client.callTool('remnote_read_note', {
        remId: moveCandidateRemId,
        contentMode: 'none',
      })) as Record<string, unknown>;
      assertEqual(
        afterMove.parentRemId as string,
        state.noteAId as string,
        'move should update direct parent'
      );

      steps.push({
        label: 'Move note dry-run and apply',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Move note dry-run and apply',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2-4: Read rich note contentMode modes
  for (const mode of ['markdown', 'structured', 'none'] as const) {
    const start = Date.now();
    const label = `Read rich note contentMode=${mode} returns expected shape`;
    let debugResult: Record<string, unknown> | null = null;
    try {
      const result = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteBId,
        depth: 3,
        contentMode: mode,
      });
      debugResult = result;
      assertHasField(result, 'remId', 'read rich note remId');
      assertHasField(result, 'title', 'read rich note title');
      assertHasField(result, 'parentRemId', 'read rich note parentRemId');
      assertHasField(result, 'parentTitle', 'read rich note parentTitle');
      assertEqual(
        result.parentRemId as string,
        state.integrationParentRemId as string,
        'read rich note parentRemId should match integration parent'
      );
      assertEqual(
        result.parentTitle as string,
        state.integrationParentTitle as string,
        'read rich note parentTitle should match integration parent'
      );
      assertTruthy(
        typeof state.searchByTagTag === 'string',
        'initial search tag should be recorded'
      );
      assertTagsInclude(result, state.searchByTagTag as string, `read ${mode}`);
      if (mode === 'markdown') {
        assertHasField(result, 'content', 'read rich note markdown');
        assertTruthy(typeof result.content === 'string', 'content should be a string');
        assertTruthy(
          (result.content as string).length > 0,
          'rich note should include rendered content in markdown mode'
        );
        assertHasField(result, 'contentProperties', 'read rich note contentProperties');
        const props = result.contentProperties as Record<string, unknown>;
        assertTruthy(
          typeof props.childrenRendered === 'number',
          'childrenRendered should be number'
        );
        assertTruthy(typeof props.childrenTotal === 'number', 'childrenTotal should be number');
        assertTruthy((props.childrenTotal as number) > 0, 'childrenTotal should be > 0');
      } else if (mode === 'structured') {
        assertHasField(result, 'contentStructured', 'read rich note structured content');
        assertTruthy(
          Array.isArray(result.contentStructured),
          'contentStructured should be an array in structured mode'
        );
        assertTruthy(
          Array.isArray(result.contentStructured) && result.contentStructured.length > 0,
          'contentStructured should contain nested child nodes in structured mode'
        );
        assertTruthy(!('content' in result), 'structured mode should omit markdown content');
        assertTruthy(
          !('contentProperties' in result),
          'structured mode should omit contentProperties'
        );
      } else {
        assertTruthy(!('content' in result), 'none mode should omit content');
        assertTruthy(!('contentStructured' in result), 'none mode should omit structured content');
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
      assertTruthy(typeof state.noteBId === 'string', 'update title reference target remId');
      const result = (await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        title: `[MCP-TEST] Updated Note ${ctx.runId} [[id:${state.noteBId}]]`,
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'update title should succeed');
      assertIsArray(result.remIds, 'update title remIds');

      const reread = await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
        view: 'full',
      });
      assertInlineRefTarget(
        reread,
        state.noteBId as string,
        'update_note.title exact reference token readback'
      );

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

  // Step 4: Insert content
  {
    const start = Date.now();
    try {
      const originalAlias = `Pôvodný názov ${ctx.runId}`;
      const unicodeAlias = `日本語 ${ctx.runId}`;
      const addedAlias = `İstanbul ${ctx.runId}`;
      const result = (await ctx.client.callTool('remnote_update_note', {
        remId: state.noteAId,
        addAliases: [` ${unicodeAlias} `, addedAlias, addedAlias],
        removeAliases: [` Pôvodný   názov ${ctx.runId} `, 'Missing Alias'],
      })) as { remIds: string[] };
      assertIsArray(result.remIds, 'update aliases remIds');

      const reread = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
        view: 'full',
      })) as Record<string, unknown>;
      assertIsArray(reread.aliases, 'updated aliases');
      assertStringArrayEqualUnordered(
        reread.aliases,
        [unicodeAlias, addedAlias],
        'alias add/remove should be exact, normalized, idempotent, and Unicode-safe'
      );
      assertTruthy(
        !(reread.aliases as string[]).includes(originalAlias),
        'removed alias should be absent'
      );

      steps.push({ label: 'Update aliases', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Update aliases',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 4: Insert content
  {
    const start = Date.now();
    try {
      assertTruthy(typeof state.noteBId === 'string', 'insert content reference target remId');
      const result = (await ctx.client.callTool('remnote_insert_children', {
        parentRemId: state.noteAId,
        content: `Inserted via integration test [[id:${state.noteBId}]]`,
        position: 'last',
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'insert content should succeed');
      assertIsArray(result.remIds, 'insert content remIds');

      const insertedRemId = result.remIds[0];
      assertTruthy(typeof insertedRemId === 'string', 'inserted exact reference child remId');
      const reread = await ctx.client.callTool('remnote_read_note', {
        remId: insertedRemId,
        contentMode: 'none',
        view: 'full',
      });
      assertInlineRefTarget(
        reread,
        state.noteBId as string,
        'insert_children exact reference token readback'
      );

      steps.push({ label: 'Insert content', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Insert content',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 5: Replace content (or validate gate rejection)
  {
    const start = Date.now();
    try {
      if (acceptReplaceOperation) {
        assertTruthy(typeof state.noteBId === 'string', 'replace content reference target remId');
        const parentBefore = (await ctx.client.callTool('remnote_read_note', {
          remId: state.noteAId,
          contentMode: 'none',
          view: 'full',
        })) as Record<string, unknown>;
        const replaceBody = `[MCP-TEST] Replaced via integration test ${ctx.runId} [[id:${state.noteBId}]]`;
        const result = (await ctx.client.callTool('remnote_replace_children', {
          parentRemId: state.noteAId,
          content: replaceBody,
        })) as { remIds: string[] };
        assertHasField(result, 'remIds', 'replace content should succeed when enabled');
        assertIsArray(result.remIds, 'replace content remIds');

        const reread = (await ctx.client.callTool('remnote_read_note', {
          remId: state.noteAId,
          depth: 2,
          contentMode: 'markdown',
          view: 'full',
        })) as Record<string, unknown>;
        assertTruthy(typeof reread.content === 'string', 're-read content should be string');
        assertContains(
          reread.content as string,
          `[MCP-TEST] Replaced via integration test ${ctx.runId}`,
          're-read content should include replaced body'
        );
        assertParentMetadataUnchanged(
          parentBefore,
          reread,
          'replace_children should preserve parent metadata'
        );

        const replacedRemId = result.remIds[0];
        assertTruthy(typeof replacedRemId === 'string', 'replaced exact reference child remId');
        const rereadChild = await ctx.client.callTool('remnote_read_note', {
          remId: replacedRemId,
          contentMode: 'none',
          view: 'full',
        });
        assertInlineRefTarget(
          rereadChild,
          state.noteBId as string,
          'replace_children exact reference token readback'
        );
        steps.push({ label: 'Replace content', passed: true, durationMs: Date.now() - start });
      } else {
        const errorText = await ctx.client.callToolExpectError('remnote_replace_children', {
          parentRemId: state.noteAId,
          content: 'Should be blocked',
        });
        assertContains(
          errorText,
          'Replace operation is disabled',
          'replace should be rejected when disabled'
        );
        steps.push({
          label: 'Replace content blocked by gate',
          passed: true,
          durationMs: Date.now() - start,
        });
      }
    } catch (e) {
      steps.push({
        label: acceptReplaceOperation ? 'Replace content' : 'Replace content blocked by gate',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 6: Replace with empty string clears direct children (when enabled)
  if (acceptReplaceOperation) {
    const start = Date.now();
    try {
      const parentBefore = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
        view: 'full',
      })) as Record<string, unknown>;
      const result = (await ctx.client.callTool('remnote_replace_children', {
        parentRemId: state.noteAId,
        content: '',
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'empty replace should succeed');
      assertIsArray(result.remIds, 'empty replace remIds');

      const reread = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        depth: 2,
        contentMode: 'markdown',
        view: 'full',
      })) as Record<string, unknown>;
      assertEqual(
        reread.content as string,
        '',
        'empty replace should clear direct child markdown content'
      );
      assertParentMetadataUnchanged(
        parentBefore,
        reread,
        'empty replace_children should preserve parent metadata'
      );
      steps.push({
        label: 'Empty replace clears direct children',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Empty replace clears direct children',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 7: Add tag
  {
    const start = Date.now();
    try {
      const tagResult = (await ctx.client.callTool('remnote_create_note', {
        title: tagVerificationName,
      })) as { remIds: string[] };
      assertHasField(tagResult, 'remIds', 'create tag rem should succeed');
      assertIsArray(tagResult.remIds, 'create tag remIds');
      tagVerificationRemId = tagResult.remIds[0];

      const expectedTargetRemId = await resolveExpectedSearchByTagTarget(
        ctx,
        state.noteAId as string
      );
      const result = (await ctx.client.callTool('remnote_update_tags', {
        remId: state.noteAId,
        addTagRemIds: [tagVerificationRemId],
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'add tag should succeed');
      assertIsArray(result.remIds, 'add tag remIds');
      const taggedSearch = await ctx.client.callTool('remnote_search_by_tag', {
        tagRemId: tagVerificationRemId,
        contentMode: 'none',
        limit: 10,
      });
      assertHasField(taggedSearch, 'results', 'search_by_tag after add tag');
      assertIsArray(taggedSearch.results, 'search_by_tag after add tag results');
      const taggedResults = taggedSearch.results as Array<Record<string, unknown>>;
      findMatchingSearchResult(taggedResults, expectedTargetRemId);
      const taggedRead = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
      })) as Record<string, unknown>;
      assertTagsInclude(taggedRead, tagVerificationName, 'read after add tag');
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

  // Step 8: Remove tag
  {
    const start = Date.now();
    try {
      assertTruthy(tagVerificationRemId, 'tag Rem ID should be available for remove tag');
      const expectedTargetRemId = await resolveExpectedSearchByTagTarget(
        ctx,
        state.noteAId as string
      );
      const result = (await ctx.client.callTool('remnote_update_tags', {
        remId: state.noteAId,
        removeTagRemIds: [tagVerificationRemId as string],
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'remove tag should succeed');
      assertIsArray(result.remIds, 'remove tag remIds');
      const taggedSearch = await ctx.client.callTool('remnote_search_by_tag', {
        tagRemId: tagVerificationRemId as string,
        contentMode: 'none',
        limit: 10,
      });
      assertHasField(taggedSearch, 'results', 'search_by_tag after remove tag');
      assertIsArray(taggedSearch.results, 'search_by_tag after remove tag results');
      const taggedResults = taggedSearch.results as Array<Record<string, unknown>>;
      const match = taggedResults.find((r) => r.remId === expectedTargetRemId);
      assertTruthy(!match, 'removed tag should no longer resolve to the tagged target');
      const taggedRead = (await ctx.client.callTool('remnote_read_note', {
        remId: state.noteAId,
        contentMode: 'none',
      })) as Record<string, unknown>;
      assertTagsExclude(taggedRead, tagVerificationName, 'read after remove tag');
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

  // Step 9: Re-read verifies changes
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

  // Step 10: Update with markdown tree
  {
    const start = Date.now();
    try {
      const markdownTree = `[MCP-TEST] Markdown Tree ${ctx.runId}\n- Branch 1\n  - Leaf 1\n- Branch 2`;
      const result = (await ctx.client.callTool('remnote_insert_children', {
        parentRemId: state.noteAId,
        content: markdownTree,
        position: 'last',
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'update with markdown tree');
      assertIsArray(result.remIds, 'markdown tree remIds');
      assertTruthy(result.remIds.length >= 4, 'should create multiple rems for tree');

      steps.push({
        label: 'Update with markdown tree',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Update with markdown tree',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Read & Update', steps, skipped: false };
}
