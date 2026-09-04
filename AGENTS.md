# AGENTS.md

This file is a map for AI agents working in `remnote-mcp-server`.

## Repo Role

This repo exposes RemNote operations as MCP tools over Streamable HTTP, bridges those tool calls to the RemNote plugin
over WebSocket, and ships bundled local client entrypoints.

```text
AI agents (HTTP MCP) <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
AI agents (stdio MCP) <-> remnote-mcp-stdio <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
CLI commands <-> remnote-cli <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
```

## Companion Repos (Sibling Dirs)

Resolve from this repo root (`$(pwd)`):

- `$(pwd)/../remnote-mcp-bridge` - source of bridge action contracts + plugin behavior

When changing action names, payloads, or response semantics, validate this repo and bridge docs. The old standalone
`remnote-cli` repo is discontinued; maintained CLI code lives in this repo under `src/remnote-cli/`.

## Contract Map (Current)

### External MCP Tool Surface (17)

- `remnote_create_note`
- `remnote_search`
- `remnote_search_by_tag`
- `remnote_read_note`
- `remnote_get_media`
- `remnote_list_children`
- `remnote_move_note`
- `remnote_update_note`
- `remnote_set_document_status`
- `remnote_insert_children`
- `remnote_replace_children`
- `remnote_update_tags`
- `remnote_set_property`
- `remnote_append_journal`
- `remnote_read_table`
- `remnote_get_playbook`
- `remnote_status`

### Bundled CLI Command Surface

- `remnote-cli create`
- `remnote-cli search`
- `remnote-cli search-by-tag`
- `remnote-cli read`
- `remnote-cli get-media`
- `remnote-cli list-children`
- `remnote-cli move-note`
- `remnote-cli update`
- `remnote-cli set-document-status`
- `remnote-cli insert-children`
- `remnote-cli replace-children`
- `remnote-cli update-tags`
- `remnote-cli journal`
- `remnote-cli status`
- `remnote-cli read-table`

### Bridge Action Mapping and Compatibility

- Most tools map to same conceptual bridge actions (`create_note`, `search`, `search_by_tag`, `read_note`, `get_media_locator`,
  `list_children`, `move_note`, `update_note`, `set_document_status`, `insert_children`, `replace_children`, `update_tags`,
  `set_property`, `append_journal`, `read_table`, `get_status`).
- Bridge plugin sends WebSocket `hello` with plugin version.
- `remnote_status` enriches output with server version + optional `version_warning` for compatibility drift.

Projects are still `0.x`; prefer the same minor line across bridge and server package:

- `../remnote-mcp-bridge/docs/guides/bridge-consumer-version-compatibility.md`

## Code Map

- `src/index.ts` - process startup/shutdown wiring
- `src/http-server.ts` - MCP HTTP transport/session lifecycle
- `src/websocket-server.ts` - plugin connection, request correlation, timeouts, `hello` handling
- `src/tools/index.ts` - MCP tool registration and dispatch
- `src/schemas/remnote-schemas.ts` - Zod input/output schema contracts
- `src/remnote-cli/` - bundled CLI command parser, MCP client, command payload mapping, and output formatting
- `mcpb/remnote-local/server/index.js` - stdio MCP proxy used by `remnote-mcp-stdio` and the Claude Desktop MCPB
- `mcpb/remnote-local/server/fallback-tools.generated.js` - generated fallback tool metadata for MCPB startup when the
  local HTTP server is unavailable
- `scripts/generate-mcpb-tools.mjs` - generates MCPB manifest tools and fallback metadata from canonical server tool
  definitions
- `src/version-compat.ts` - 0.x compatibility checks

Primary docs for deeper context:

- `docs/architecture.md`
- `docs/guides/tools-reference.md`
- `docs/guides/configuration.md`
- `docs/guides/remote-access.md`

## Development and Verification

For maintainer review of one or more server/bridge pull requests, follow the canonical workflow at
`../remnote-mcp-bridge/docs/workflows/pr-validation-and-adoption.md` before modifying or merging the contribution.

If Node/npm is unavailable in shell:

```bash
source ./node-check.sh
```

Core commands:

```bash
npm run dev
npm run build
npm run check:mcpb-tools
npm run typecheck
npm test
npm run test:coverage
./code-quality.sh
```

Manual live integration commands:

```bash
npm run test:integration
npm run test:integration:mcp
npm run test:integration:mcpb
npm run test:integration:cli
```

## Integration and Live Validation Policy

AI agents may run live integration tests in this repo only on explicit human request and only through the guarded
wrapper.

- Default: do not run `npm run test:integration` or `./run-integration-test.sh` directly. Even if Robert asks for
  "all integration tests", the AI-agent entrypoint is still `./run-agent-integration-test.sh --yes --suite all`.
- Allowed path for AI agents: `./run-agent-integration-test.sh [--yes]`, which validates the direct MCP tools path,
  MCPB stdio proxy path, and bundled CLI path by default. Use `--suite mcp`, `--suite mcpb`, or `--suite cli` only for
  targeted reruns.
- Before invoking the wrapper, the agent must ask the human collaborator to start the bridge in RemNote.
- If bridge code changed after the currently running RemNote bridge session started, the agent must ask the human
  collaborator to restart the bridge before rerunning the suite.
- Before invoking any live integration command, the agent must run
  `./run-agent-integration-test.sh --preflight-only` outside the Codex sandbox to check whether the configured HTTP MCP
  port is occupied (`127.0.0.1:3001` by default). If anything is listening there, including a macOS launchd-managed
  server, the agent must refuse to run the tests and report that Robert needs to stop the existing server first. The
  agent must not stop or restart any existing `remnote-mcp-server` process or macOS launchd service.
- The wrapper repeats the configured HTTP MCP port check before build/start. If the port is already occupied, it must
  refuse to run and must not stop or restart any existing `remnote-mcp-server` process or macOS launchd service.
- If the port is free, the wrapper builds and starts its own local MCP server, then waits for
  `remnote_status.connected === true` before launching the suite.
- Agent-assisted live integration commands must be run outside the Codex sandbox with escalated execution. The `tsx`
  runners create local IPC pipes under macOS temp directories such as `/var/folders/...`; inside the sandbox this can
  fail before tests start with `listen EPERM`.
- After each agent-assisted integration run, whether it passes, fails, or is interrupted, the agent must stop the MCP
  server if and only if the wrapper started it for that run.
- If the bridge never connects, the wrapper must stop and tell the human collaborator to verify the RemNote bridge
  session.
- Use unit/static checks for routine agent-side verification when explicit live validation is not requested.

## Documentation and Changelog Rules

- Update documentation when behavior, contracts, configuration, or non-obvious rationale changes.
- Record notable functional and documentation changes in `CHANGELOG.md`.
- Keep AGENTS/docs map-level: contracts, rationale, and navigation.
- When changing bridge action contracts, MCP tool input/output schemas, tool behavior, or response semantics:
  - Keep `remnote-cli` functionally aligned for every behavior reachable through the CLI: update the command parser,
    payload mapping, text/JSON output expectations, CLI docs, and CLI integration coverage.
  - Explicitly check whether `remnote_get_playbook` needs an update. Update the playbook and its tests when API changes
    affect recommended agent workflow, traversal defaults, paging, timeouts, write safety, or tool selection.
  - Explicitly check whether `skills/remnote/SKILL.md` needs an update. This skill is a critical agent-facing contract
    for `remnote-cli` workflows and must stay aligned with command names, flags, write safety, traversal defaults, and
    recovery guidance.
  - Update server unit tests and live integration tests that exercise the changed contract.
  - Update `docs/agent-validation-prompts/mcp-tool-smoke-test.md` when the change affects agent-visible setup
    validation.
  - Update `remnote_get_playbook` guidance when the change affects recommended agent workflow.
  - Update bridge/server contract docs and changelogs.
  - Regenerate MCPB tool metadata when canonical MCP tool definitions change.
- When changing MCP tool names, descriptions, or input schemas, update `src/tools/index.ts` first, then run
  `npm run generate:mcpb-tools`. Do not hand-edit `mcpb/remnote-local/server/fallback-tools.generated.js`.
  `./code-quality.sh` runs `npm run check:mcpb-tools` and must fail if generated MCPB metadata is stale.

## Release and Publishing Map

- Publish workflow: `./publish-to-npm.sh`
- The npm package provides `remnote-mcp-server`, `remnote-cli`, and `remnote-mcp-stdio` bins.
- Keep release notes aligned with `CHANGELOG.md`
- For release prep, verify package version and changelog section alignment.

## Git Policy

Do not create commits unless explicitly requested.
