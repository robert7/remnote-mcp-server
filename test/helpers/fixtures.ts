/**
 * Test fixtures - sample data for testing
 */

import type { BridgeRequest, BridgeResponse } from '../../src/types/bridge.js';

// Valid RemNote schema inputs
export const validCreateNoteInput = {
  title: 'Test Note',
  content: 'Line 1\nLine 2',
  parentId: 'parent-id-123',
  tags: ['tag1', 'tag2'],
};

export const validSearchInput = {
  query: 'test query',
  limit: 50,
  includeContent: true,
};

export const validReadNoteInput = {
  remId: 'rem-id-123',
  depth: 5,
};

export const validUpdateNoteInput = {
  remId: 'rem-id-456',
  title: 'Updated Title',
  appendContent: 'New content',
  addTags: ['newtag'],
  removeTags: ['oldtag'],
};

export const validAppendJournalInput = {
  content: 'Journal entry',
  timestamp: false,
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

// Sample RemNote API responses
export const sampleNoteResult = {
  id: 'rem-id-123',
  title: 'Sample Note',
  content: ['Child 1', 'Child 2'],
};

export const sampleSearchResults = {
  results: [
    { id: 'rem-1', title: 'Result 1' },
    { id: 'rem-2', title: 'Result 2' },
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
