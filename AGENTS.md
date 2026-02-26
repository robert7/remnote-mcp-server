# AGENTS.md

This file is a map for AI agents working in `remnote-mcp-server`.

## Start Here First (Mandatory)

Read these before changing code/docs:

1. `.agents/dev-requirements.md`
2. `.agents/dev-workflow.md`
3. `.agents/dev-documentation.md` (required before docs edits)
4. `.agents/dev-python-conventions.md` (if touching Python helper scripts)
5. `.agents/PLANS.md` (required for complex work / major refactors)

## Repo Role

This repo exposes RemNote operations as MCP tools over Streamable HTTP and bridges those tool calls to the RemNote
plugin over WebSocket.

```text
AI agents (HTTP MCP) <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
```

## Companion Repos (Sibling Dirs)

Resolve from this repo root (`$(pwd)`):

- `$(pwd)/../remnote-mcp-bridge` - source of bridge action contracts + plugin behavior
- `$(pwd)/../remnote-cli` - parallel consumer of same bridge contract

When changing action names, payloads, or response semantics, validate all three repos.

## Contract Map (Current)

### External MCP Tool Surface (7)

- `remnote_create_note`
- `remnote_search`
- `remnote_search_by_tag`
- `remnote_read_note`
- `remnote_update_note`
- `remnote_append_journal`
- `remnote_status`

### Bridge Action Mapping and Compatibility

- Most tools map to same conceptual bridge actions (`create_note`, `search`, `search_by_tag`, `read_note`,
  `update_note`, `append_journal`, `get_status`).
- Bridge plugin sends WebSocket `hello` with plugin version.
- `remnote_status` enriches output with server version + optional `version_warning` for compatibility drift.

Projects are still `0.x`; prefer same minor line across bridge/server/CLI:

- `../remnote-mcp-bridge/docs/guides/bridge-consumer-version-compatibility.md`

## Code Map

- `src/index.ts` - process startup/shutdown wiring
- `src/http-server.ts` - MCP HTTP transport/session lifecycle
- `src/websocket-server.ts` - plugin connection, request correlation, timeouts, `hello` handling
- `src/tools/index.ts` - MCP tool registration and dispatch
- `src/schemas/remnote-schemas.ts` - Zod input/output schema contracts
- `src/version-compat.ts` - 0.x compatibility checks

Primary docs for deeper context:

- `docs/architecture.md`
- `docs/guides/tools-reference.md`
- `docs/guides/configuration.md`
- `docs/guides/remote-access.md`

## Development and Verification

If Node/npm is unavailable in shell:

```bash
source ./node-check.sh
```

Core commands:

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:coverage
./code-quality.sh
```

## Integration and Live Validation Policy

AI agents must not run integration tests in this repo.

- Do not run `npm run test:integration`.
- Do not run `./run-integration-test.sh`.
- Ask the human collaborator to run integration tests and share logs.
- Use unit/static checks for agent-side verification.

## Documentation and Changelog Rules

- Before docs edits, read `.agents/dev-documentation.md`.
- Any functional or documentation change must be recorded in `CHANGELOG.md`.
- Keep AGENTS/docs map-level: contracts, rationale, and navigation.

## Release and Publishing Map

- Publish workflow: `./publish-to-npm.sh`
- Keep release notes aligned with `CHANGELOG.md`
- For release prep, verify package version and changelog section alignment.

## Git Policy

Do not create commits unless explicitly requested. Use `.agents/dev-workflow.md` as canonical policy.
