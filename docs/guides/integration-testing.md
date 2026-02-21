# Integration Testing

The integration test suite validates the full MCP server chain end-to-end against a live RemNote instance. Unlike the
unit tests (which mock the WebSocket bridge), these tests send real MCP tool calls through the running server to
RemNote and verify the responses.

## Prerequisites

1. RemNote running with the RemNote Automation Bridge plugin installed and connected
2. MCP server running (`npm run dev` or `npm start`)
3. Plugin connected to the WebSocket server (check server logs for connection message)

## Running

```bash
# Interactive — prompts before creating content
npm run test:integration

# Non-interactive — skips confirmation
npm run test:integration -- --yes

# Fast connection check only (no test data creation)
./run-status-check.sh
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `REMNOTE_MCP_URL` | `http://127.0.0.1:3001` | MCP server base URL |
| `MCP_TEST_DELAY` | `2000` | Delay (ms) after creating notes before searching |

## What It Tests

The suite runs five sequential workflows:

1. **Status Check** — Verifies the server reports a connected plugin. If this fails, all subsequent workflows are
   skipped since there's no point testing tools without a live connection.
2. **Create & Search** — Creates two notes (simple and rich with content/tags), waits for RemNote indexing, then
   searches to verify they're findable.
3. **Read & Update** — Reads the created notes, updates title/content/tags, and re-reads to verify persistence.
4. **Journal** — Appends entries to today's daily document with and without timestamps.
5. **Error Cases** — Sends invalid inputs (nonexistent IDs, missing required fields) and verifies the server handles
   them gracefully.

## Test Artifacts

All test content is prefixed with `[MCP-TEST]` followed by a unique run ID (ISO timestamp). RemNote's bridge plugin
does not support deleting notes, so test artifacts persist and must be cleaned up manually.

To clean up: search your RemNote knowledge base for `[MCP-TEST]` and delete the matching notes.

## Design Rationale

The integration tests are deliberately separate from the unit test suite. They require external infrastructure (running
server + connected plugin), create real content, and take seconds rather than milliseconds. They run via `tsx` with
custom lightweight assertions — no vitest dependency — to keep them independent of the mocked test environment.
