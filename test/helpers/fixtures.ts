/**
 * Test fixtures - sample data for testing
 */

import type { BridgeRequest, BridgeResponse } from '../../src/types/bridge.js';

// Valid RemNote schema inputs
export const validCreateNoteInput = {
  title: 'Test Note',
  content: 'Line 1\nLine 2',
  parentId: 'parent-id-123',
  tagRemIds: ['tag-rem-id-1', 'tag-rem-id-2'],
  aliases: ['Test Alias'],
};

export const validSearchInput = {
  query: 'test query',
  limit: 50,
  contentMode: 'markdown',
};

export const validSearchByTagInput = {
  tagRemId: 'mcp-test-tag-rem-id',
  resultMode: 'context',
  limit: 50,
  contentMode: 'markdown',
};

export const validReadNoteInput = {
  remId: 'rem-id-123',
  depth: 5,
};

export const validUpdateNoteInput = {
  remId: 'rem-id-456',
  title: 'Updated Title',
  addAliases: ['New Alias'],
  removeAliases: ['Old Alias'],
};

export const validSetDocumentStatusInput = {
  remId: 'rem-id-456',
  isDocument: true,
  dryRun: false,
  expectedOldRemType: 'concept',
};

export const validInsertChildrenInput = {
  parentRemId: 'rem-id-456',
  content: 'Inserted content',
  position: 'last',
};

export const validReplaceChildrenInput = {
  parentRemId: 'rem-id-456',
  content: 'Replacement content',
};

export const validUpdateTagsInput = {
  remId: 'rem-id-456',
  addTagRemIds: ['tag-rem-id-1'],
  removeTagRemIds: ['tag-rem-id-2'],
};

export const validSetPropertyInput = {
  remId: 'rem-id-456',
  tagRemId: 'tag-rem-id-1',
  propertyRemId: 'property-rem-id-1',
  value: { kind: 'rem_reference', remId: 'option-rem-id-1' },
};

export const validAppendJournalInput = {
  content: 'Journal entry',
  timestamp: false,
  tagRemIds: ['journal-tag-rem-id'],
};

export const validReadTableInput = {
  tableRemId: 'table-rem-id-123',
  limit: 50,
  offset: 0,
};

export const sampleTableResult = {
  tableId: 'table-rem-id-123',
  tableName: 'Test Table',
  columns: [
    { propertyId: 'prop-1', name: 'Name', type: 'text' },
    { propertyId: 'prop-2', name: 'Status', type: 'single_select' },
    { propertyId: 'prop-3', name: 'Done', type: 'checkbox' },
  ],
  rows: [
    {
      remId: 'row-1',
      name: 'Task 1',
      values: { 'prop-1': 'Task 1', 'prop-2': 'In Progress', 'prop-3': 'false' },
    },
    {
      remId: 'row-2',
      name: 'Task 2',
      values: { 'prop-1': 'Task 2', 'prop-2': 'Done', 'prop-3': 'true' },
    },
  ],
  totalRows: 2,
  rowsReturned: 2,
};

// Bridge message fixtures
export const createBridgeRequest = (
  action: string,
  payload: Record<string, unknown>
): BridgeRequest => ({
  id: 'test-uuid-123',
  action,
  payload,
});

export const createBridgeResponse = (
  id: string,
  result?: unknown,
  error?: string
): BridgeResponse => ({
  id,
  result,
  error,
});

// Sample RemNote API responses for mutating actions (create, update, journal)
export const sampleMutatingResult = {
  remIds: ['rem-id-123', 'child-1-id', 'child-2-id'],
  titles: ['Sample Note', 'Child 1', 'Child 2'],
};

export const sampleNoteResult = sampleMutatingResult;

export const sampleSearchResults = {
  results: [
    { remId: 'rem-1', title: 'Result 1', tags: [{ tagRemId: 'tag-work', name: 'work' }] },
    { remId: 'rem-2', title: 'Result 2' },
  ],
  count: 2,
};

export const sampleStatusResult = {
  connected: true,
  version: '1.0.0',
  statistics: {
    requestsProcessed: 42,
  },
};
