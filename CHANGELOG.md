# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `parentRemId` to `remnote_search` input schema and `--parent-id` option to `remnote-cli search` to support scoping search within a Rem's subtree. Contributed by Twb06.
- Add exact-ID tag/table property writes through `remnote_set_property` and `remnote-cli set-property`, supporting
  text, Rem-reference/select-option, and clear value payloads.
- Add live MCP and CLI integration coverage for `remnote_set_property` using the `Automation Bridge Test Tag`
  property fixture.
- Add exact inline Rem reference guidance for `[[id:<remId>]]` in markdown-capable write fields across MCP tools,
  `remnote-cli`, and `remnote_get_playbook`.
- Add live MCP, MCPB, CLI, and smoke-prompt coverage for exact inline Rem reference tokens in create, update, insert,
  replace, journal, and text property write paths.

### Changed

- Ignore Python bytecode caches and remove previously tracked cache artifacts.
- Link the canonical cross-repo pull request validation and adoption workflow for maintainers and coding agents.
- Update `remnote_search` tools reference, CLI command `search` reference, and agent skill documentation to include advanced scoped search with parent ID and document cursor limitations.
- Update `remnote_get_playbook` guidance and MCP smoke-test instructions for scoped branch search with `parentRemId`.
- Update the MCP smoke-test prompt to validate `remnote_set_property` through the `automation-level` property fixture
  and report the kept validation value.

### Fixed

- Reject empty `parentRemId` values for `remnote_search` instead of treating them as unscoped search.
- Mark structured content node `children` arrays optional in `remnote_search` and `remnote_read_note` output schemas,
  matching bridge responses that omit `children` for leaf nodes.

## [0.16.0] - 2026-06-05

### Added

- Add document-status support through `remnote_set_document_status`, `remnote-cli set-document-status`,
  `remnote_create_note.asDocument`, and `remnote-cli create --as-document`.
- Add discovery-oriented API support for parent-first `ancestors`, compact/full output `view`, `remnote_list_children`,
  and dry-run-first `remnote_move_note`.
- Add advanced RemNote MCP use-case documentation for knowledge-base discovery, tag design, reviewed exact-ID tag
  writes, and strict audit loops.
- Add cursor paging support to `remnote_search`, `remnote_search_by_tag`, `remnote-cli search`, and
  `remnote-cli search-by-tag`, with `hasMore`, `nextCursor`, and explicit snapshot-cap truncation metadata.
- Add bounded per-call bridge wait timeout support for `remnote_search_by_tag.timeoutMs` and
  `remnote-cli search-by-tag --timeout-ms`.
- Add `inlineRefs` metadata to `remnote_search`, `remnote_search_by_tag`, and `remnote_read_note` output schemas so
  clients can follow inline Rem references by exact target Rem ID.
- Add `remnote_search_by_tag.resultMode` and CLI `search-by-tag --result-mode` for direct tagged Rem results while
  preserving context navigation with `matchedRems`.

### Changed

- Update `remnote_get_playbook`, tool docs, and bundled `remnote-cli` skill guidance for document status, hierarchy
  traversal, cursor paging, direct-tag verification, exact-ID writes, and tag/table retrieval workflows.

### Fixed

- Fix bundled CLI runtime mapping for `list-children` and `move-note`.

## [0.15.0] - 2026-05-15

### Added

- Add split RemNote write tools: `remnote_insert_children`, `remnote_replace_children`, and `remnote_update_tags`, plus
  matching `remnote-cli` commands for ordered child insertion, destructive child replacement, and exact-ID tag mutation.
- Add exact-ID tag assignment to `remnote_append_journal` and `remnote-cli journal --tag-ids`.
- Add `remnote-mcp-server daemon` lifecycle commands for detached background startup, status, logs, graceful shutdown,
  duplicate-start protection, stable log routing, and macOS `launchd` login persistence.
- Add `~/.remnote-mcp-server/config.toml` for persistent server and daemon defaults, including ports, host, log levels,
  file logs, and WebSocket request/response JSON Lines logs.
- Add end-user validation guidance for MCP setup checks, including a zero-config agent validation prompt.

### Changed

- Change `tags` output metadata to preserve exact tag Rem IDs plus names as `{ tagRemId, name }` objects.
- Change `remnote_search_by_tag` and `remnote-cli search-by-tag --tag-id` to search by exact tag Rem ID instead of tag
  name or alias lookup.
- Update `remnote_get_playbook` guidance for the split write tools and exact-ID tag fields without expanding the
  playbook shape.
- Limit `remnote_update_note` and `remnote-cli update` to metadata title updates so child and tag writes use focused
  non-duplicative interfaces.
- Change `remnote_create_note` and `remnote-cli create` to use exact tag Rem IDs via `tagRemIds` / `--tag-ids` instead
  of name-based `tags` / `--tags`.
- Generate MCPB manifest tools and fallback tool metadata from the canonical server tool definitions instead of
  maintaining those copies by hand.
- Add daemon startup, status, log, and macOS persistence pointers to installation, configuration, and troubleshooting
  docs.
- Make daemon lifecycle commands launchd-aware on macOS when the LaunchAgent is installed, and document the shared
  control surface.
- Update agent-assisted live integration safeguards so agents preflight port `3001`, refuse to run when an existing
  server is listening, and use `run-agent-integration-test.sh --preflight-only` for the same guard as real live runs.
- Clarify setup documentation for the official bridge plugin, compatible `remnote-mcp-server` versions, and explicit
  `remnote-mcp-server` versus `remnote-cli` documentation targets.

### Fixed

- Keep advertised MCPB Markdown files covered by Prettier format and format-check scripts.
- Keep generated `dist` and `coverage` output out of Vitest test discovery when integration tests are excluded.
- Prevent TypeScript builds from emitting `dist` artifacts when compilation reports errors.
- Normalize `remnote-cli` endpoints ending in `/mcp/` without appending a duplicate `/mcp` path.
- Normalize `remnote-mcp-stdio` endpoints ending in `/mcp/` without appending a duplicate `/mcp` path.
- Bound `remnote-mcp-server` signal shutdown so failed or stuck cleanup exits instead of hanging silently.
- Fix OpenAI/Codex tool registration compatibility by removing top-level JSON Schema composition keywords from
  advertised MCP tool input schemas while keeping server-side validation strict.
- Align MCPB manifest and fallback tool metadata with the split write tools so local Claude Desktop/MCPB clients no
  longer see stale `remnote_update_note` content/tag fields or name-based create tags.
- Tighten runtime validation for split child insertion and tag updates while keeping advertised MCP JSON schemas
  client-compatible.

## [0.14.2] - 2026-05-08

### Changed

- Reject RemNote bridge WebSocket connections that do not send a compatible bridge `hello.version`, with a clearer
  disconnect reason and server log message pointing users to `MCP/OpenClaw Automation Bridge`.
- Added prominent README troubleshooting guidance for wrong or incompatible RemNote Marketplace plugin installs,
  including the related `quentintou/remnote-mcp-bridge#8` report.
- Updated Claude Desktop / Cowork setup docs to clarify that local MCPB works for Cowork in the Claude Desktop app
  when desktop extensions are enabled, while remote connectors remain required for web/mobile, cloud-hosted clients,
  and managed deployments without local MCPB.

## [0.14.1] - 2026-05-08

### Added

- Added a `remnote-local` MCPB package for Claude Desktop that proxies stdio MCP calls to a locally running
  `remnote-mcp-server` Streamable HTTP endpoint without public HTTPS, including setup docs, screenshots, and official
  MCPB references.
- Added `remnote-mcp-server mcpb-path` to print the bundled Claude Desktop extension path after npm installation.
- Added the `remnote-mcp-stdio` executable for local MCP clients that consume stdio servers, including help/version
  output and smoke-test commands in the configuration guide.
- Added Codex TUI and Codex.app configuration documentation covering Streamable HTTP MCP, `remnote-mcp-stdio`, and
  `remnote-cli` skill setup.
- Added MCP protocol compatibility guidance clarifying that `2025-11-25` initialize requests are supported and separate
  from bridge/server package versions.
- Added clearer stdio proxy prerequisites and cross-links between the generic stdio MCP client section and the Codex
  stdio setup example.

### Changed

- Reordered the README AI client setup list to include Codex and prioritize the local Claude Desktop MCPB path before
  remote connector setup.
- Updated documentation and agent repo maps to reflect that the old standalone `remnote-cli` repository is
  discontinued and the maintained CLI lives in this package.

## [0.14.0] - 2026-05-07

### Added

- Bundled the `remnote-cli` executable into the `remnote-mcp-server` package. The package now provides both
  `remnote-mcp-server` and `remnote-cli`.
- Added local `link-cli.sh` and `unlink-cli.sh` helpers for linking both executables during development.

### Changed

- Consolidated CLI installation guidance around `npm install -g remnote-mcp-server`; the old standalone
  `remnote-cli` package is now treated as a legacy migration path.
- Updated agent-assisted and manual integration workflows so the direct MCP and bundled CLI paths run through the
  unified MCP server, with `--suite mcp|cli|all` for targeted reruns.
- Added server-owned CLI command, troubleshooting, demo, and skill documentation.

## [0.13.1] - 2026-05-06

### Changed

- Increased the RemNote bridge request timeout from 5 seconds to 15 seconds.

## [0.13.0] - 2026-04-24

### Added

- Added optional `tags` metadata to `remnote_search`, `remnote_search_by_tag`, and `remnote_read_note` output
  schemas, including structured child nodes.

## [0.12.0] - 2026-04-09

### Added
- Added OAuth 2.1 support (`LocalhostOAuthProvider`) so MCP clients that proactively initiate OAuth, including
  Claude Code with MCP SDK 1.26 and newer, can connect successfully.
- OAuth client registrations and authorization requests are auto-approved locally, tokens stay in memory only, and
  clients re-authenticate automatically after server restart.

### Changed
- Expanded the Claude Desktop / Cowork configuration guide with remote connector setup steps and aligned the docs
  with the current OAuth flow.

### Fixed
- Returned `structuredContent` for tools with `outputSchema`, so strict MCP clients accept successful tool results.
  Thanks to @gasteigerjo for PR #7, which added this support.

## [0.11.0] - 2026-03-27

### Added
- Added the `remnote_read_table` tool for reading Advanced Table data with pagination and column filtering.
- Added a `companion_info` WebSocket handshake so the bridge sidebar can identify a connected MCP server instance and
  show its version.

### Changed
- Changed `remnote_read_table` input validation to require exactly one explicit identifier: `tableRemId` or
  `tableTitle`.

### Fixed
- Hardened `run-agent-integration-test.sh` to build the MCP server before startup, stop the CLI daemon before MCP
  startup, reuse server-log context on timeouts, and stop the MCP server it started after runs.

## [0.10.0] - 2026-03-18

### Documentation

- Updated `README.md` capability and MCP tool summaries to reflect hierarchical markdown and flashcard creation.
- Pointed server setup/troubleshooting docs to the bridge repo's connection lifecycle guide as the canonical connection reference.

## [0.9.0] - 2026-03-17

### Added
- Enhanced `remnote_create_note` with direct hierarchical tree creation and flashcards via RemNote native markdown syntax.

### Changed
- Updated `remnote_create_note` input schema:
  - Made `title` optional (at least one of `title` or `content` must be provided).
- Updated `remnote_create_note` output schema to return plural `remIds` and `titles` arrays.
- Clarified unified create-note docs and added integration coverage for markdown-tree retrieval.

### Documentation

- Clarified across setup guides that MCP clients must use HTTP transport (`http://localhost:3001/mcp`), not `stdio`.
- Updated the startup flow to reflect automatic bridge startup on plugin activation; opening the Automation Bridge
  sidebar panel is now optional for status and manual reconnect.
- Replaced misleading plugin auto-reconnect wording with the current background retry plus manual-`Reconnect` behavior.

### Attribution

- Most of the cross-repo `create_note` / markdown-tree work in this release was implemented by @Twb06.

## [0.8.0] - 2026-03-04

### Added

- Added `replaceContent` support for `remnote_update_note` in MCP input validation and tool schemas.
- Added schema-level validation that rejects `appendContent` + `replaceContent` in one update request.
- Added `remnote_get_playbook`, a read-only MCP tool that returns navigation defaults, content-mode guidance, and a
  short decision tree for MCP agents.
- Added `outputSchema` metadata for `remnote_create_note`, `remnote_update_note`, `remnote_append_journal`,
  `remnote_status`, and `remnote_get_playbook`.

### Changed

- Updated tool reference docs for `remnote_update_note` to document direct-child replace semantics, empty-string clear
  behavior, and bridge write/replace policy gates.
- Updated `remnote_search`/`remnote_read_note`/`remnote_status` tool descriptions to make status-first preflight and
  ID-first traversal recommendations explicit for non-skill MCP clients.
- Refreshed ChatGPT docs screenshots and flow in `docs/demo.md` and
  `docs/guides/configuration-chatgpt.md` with a status-check + synthesis + diff sequence.

## [0.7.0] - 2026-03-01

### Changed

- `remnote_read_note` now accepts `includeContent: "structured"` in MCP input validation and tool schemas, aligning
  server contracts with bridge/CLI structured read traversal.
- `remnote_read_note` output schema now documents optional `contentStructured` for structured mode.

### Fixed

- Stabilized logger coverage runs in CI by enabling automatic directory creation for file logger destinations and
  hardening logger tests against async transport timing races.
- Added/updated unit and integration coverage for `remnote_read_note` structured mode schema validation and request
  pass-through.

## [0.6.0] - 2026-02-25

### Added

- `remnote_status` now includes `serverVersion` and `version_warning`, powered by bridge `hello` handshake tracking to
  surface bridge/server 0.x minor-version mismatches.
- Added `remnote_search_by_tag` with the same content controls as `remnote_search`
  (`includeContent`, `depth`, `childLimit`, `maxContentLength`).
- `remnote_search` and `remnote_read_note` output schemas now include richer bridge metadata:
  `headline`, `aliases`, `parentRemId`, `parentTitle`, and `contentProperties`.
- `remnote_search` now supports `includeContent: "structured"` and returns `contentStructured` payloads for
  downstream navigation.

### Changed

- **BREAKING**: Search/read `includeContent` changed from boolean to string mode
  (`'none' | 'markdown'`; search also supports `'structured'`).
- **BREAKING**: `remnote_read_note` no longer returns `children`; `content` now returns rendered markdown subtree
  output, and `detail` was removed from search/read schemas.
- Default content/query limits changed: read depth now defaults to 5, plus schema defaults for `childLimit` and
  `maxContentLength`.

### Fixed

- `remnote_status` now reports compatibility warnings for legacy 0.5.x bridge plugins that do not send `hello`, by
  falling back to `pluginVersion` from `get_status`.
- Stabilized websocket startup and logger file handling in automated tests to reduce intermittent
  environment-sensitive failures.

## [0.5.1] - 2026-02-24

### Changed

- Improved invalid MCP session error responses to explicitly indicate session reinitialization is required after
  restart/expiry, with structured error metadata for clients and diagnostics.

### Documentation

- Added troubleshooting guidance for Claude Code `Invalid session ID` errors after restarting `remnote-mcp-server`,
  including restart/refresh steps and log checks.

## [0.5.0] - 2026-02-21

### Added

- Added `outputSchema` metadata for `remnote_search` and `remnote_read_note`, including `detail`, `remType`, and
  `cardDirection` response fields for AI clients.
- Search responses now include `detail`, `remType`, and `cardDirection`.
- Added end-to-end integration test tooling with `npm run test:integration` and a standalone `./run-status-check.sh`
  helper.
- Added ChatGPT setup documentation with screenshots and linked it from quick-start/docs navigation.

### Changed

- Increased search default limit from 20 to 50 and maximum limit from 100 to 150.
- Reorganized setup docs to reduce overlap and centralize remote-access guidance.

### Removed

- Removed `preview` from search responses to align with bridge plugin output.

## [0.4.0] - 2026-02-14

### Added

- Host binding configuration for HTTP and WebSocket servers
- `--http-host` CLI option to control HTTP server binding address
- `REMNOTE_HTTP_HOST` environment variable for HTTP server binding
- Support for binding HTTP server to `0.0.0.0` for remote access (Docker, VPS deployments)
- Host validation in CLI with support for localhost, 127.0.0.1, 0.0.0.0, and valid IPv4 addresses

### Changed

- HTTP server can now bind to configurable host address (default: 127.0.0.1)
- Improved logging to show bound host addresses on startup
- Updated all tests to pass host parameters to server constructors

### Security

- WebSocket server host binding enforced to localhost (127.0.0.1) only - cannot be overridden
- Ensures RemNote plugin connection is never exposed remotely

### Documentation

- Streamlined README.md, created `docs/guides/` with focused guides
- Created dedicated configuration guides for each AI client (Claude Code, Accomplish, Claude Cowork)
- Fixed curl examples to include required `Accept: application/json, text/event-stream` header
- Corrected ngrok documentation: clarified 0.0.0.0 is for Docker/VPS, not needed for ngrok
- Enhanced demo documentation with multi-client examples (Claude Code, Accomplish, Claude Cowork)

### Internal

- Fixed intermittent test failures on GitHub Actions caused by race condition between HTTP server start and connection
  readiness
- Fixed intermittent logger test failures on GitHub Actions caused by missing directory creation before file logger
  instantiation

## [0.3.1] - 2026-02-12

### Fixed

- Fixed crash on global installation when `pino-pretty` (devDependency) is unavailable
  - Added graceful fallback to JSON logging when pretty transport initialization fails
  - Logs warning to console when pretty logging unavailable but requested
  - Maintains development experience while ensuring production robustness

## [0.3.0] - 2026-02-12

### Added

- Comprehensive logging infrastructure with Pino logger
- CLI argument parsing with Commander for server configuration
- Configurable log levels (debug, info, warn, error) for console and file output
- Optional file logging with separate log level control
- Optional request/response logging to JSON Lines files for debugging
- Verbose mode (`--verbose`) for quick debug logging enablement
- CLI flags for port configuration (`--ws-port`, `--http-port`)
- Structured logging throughout the application with contextual information
- Debug-level logging for detailed troubleshooting
- Request timing and duration tracking in logs
- Graceful error handling with comprehensive error logging

### Changed

- Startup message now includes version number and port information
- All console.error calls replaced with structured Pino logging
- Server startup sequence now validates configuration before starting services
- Environment variable configuration now validated with better error messages
- Port validation moved earlier in startup process for faster failure feedback

### Dependencies

- Added `pino@^9.6.0` for structured logging
- Added `commander@^13.0.0` for CLI argument parsing
- Added `pino-pretty@^11.0.0` (dev) for human-readable development logs

## [0.2.1] - 2026-02-11

### Added

- `publish-to-npm.sh` script to automate npm publishing workflow with proper error checking
  - Pre-flight checks: git clean, npm authentication, package.json validation
  - Automatic code quality verification via `./code-quality.sh`
  - Package contents verification with `npm pack --dry-run`
  - User confirmation required before actual publish
  - Post-publication git tag creation and push
  - Success summary with next-step reminders (GitHub release, CHANGELOG update)

## [0.2.0] - 2026-02-11

### Changed

- **BREAKING**: Transport refactored from stdio to Streamable HTTP (SSE)
  - Users must start server independently with `npm start` or `npm run dev`
  - Server runs as long-running process on port 3001 (HTTP) and 3002 (WebSocket)
  - Claude Code configuration must use `http` transport type instead of `stdio`
  - Multiple Claude Code sessions can now connect to a single server instance
- TypeScript module resolution changed from "node" to "Node16" for SDK deep imports compatibility
- README.md "Claude Code CLI" section now includes complete `claude mcp` command examples
  - Shows `claude mcp add` command with expected output
  - Shows `claude mcp list` for verifying connection health
  - Shows `claude mcp remove` for unregistering the server
  - Positioned before manual configuration section as recommended approach

### Added

- Multi-agent support: Multiple AI agents can now connect to the same RemNote knowledge base simultaneously
- HTTP MCP server with Streamable HTTP (SSE) transport for session management
- New `REMNOTE_HTTP_PORT` environment variable (default: 3001)
- Express-based HTTP server with JSON parsing middleware
- Session lifecycle management: multiple concurrent MCP sessions with independent state
- Comprehensive HTTP server test suite (15 tests covering initialization, session management, SSE streams, and error
  cases)
- "Two-Component Architecture" section in README.md for consistency with RemNote MCP Bridge documentation

### Dependencies

- Added `express` ^5.2.0 for HTTP server
- Added `@types/express` ^5.0.0 for TypeScript support

### Fixed

- Fixed `remnote_status` tool action name mismatch (server sent 'status', plugin expected 'get_status')

## [0.1.3] - 2026-02-07

### Added

- Demo documentation with screenshot showing Claude Code searching RemNote via MCP Bridge & Server
  - New `docs/demo.md` with visual demonstration
  - Demo section in README.md with preview image
  - Screenshot file: `docs/remnote-mcp-server-demo.jpg`
- npm package badge in README.md linking to npm registry page
- npm installation instructions as recommended installation method in README.md
  - Global installation via `npm install -g remnote-mcp-server`
  - Uninstall instructions for both npm and source installations
- Enhanced troubleshooting section covering both npm and source installation methods

## [0.1.2] - 2026-02-07

### Added

- Documentation of multi-agent limitations in README.md
  - Explains 1:1:1 architecture constraint (one AI agent ↔ one server ↔ one RemNote connection)
  - Details three architectural constraints: stdio point-to-point transport, single-client WebSocket, port binding
  - Provides practical implications and alternative approaches for users needing multiple agents
  - Notes planned migration to HTTP transport (SSE) which would enable multi-agent support
- Comprehensive testing infrastructure with Vitest (95 tests)
  - Unit tests for WebSocketServer, tools, schemas
  - Coverage thresholds enforced (80% lines/functions/statements, 75% branches)
- Code quality tools
  - ESLint with TypeScript-specific rules
  - Prettier for consistent code formatting
  - `./code-quality.sh` script for unified quality checks
- CI/CD integration
  - GitHub Actions workflow running all quality checks on push/PR
  - CI status badge in README
- npm scripts for testing, linting, and formatting
- Test helpers and mock implementations for isolated testing

### Changed

- MCP server version is now dynamically read from package.json instead of being hardcoded in src/index.ts

## [0.1.1] - 2026-02-07

### Added

- README.md now includes explanation of stdio transport architecture and its implications (lifecycle management, message
  protocol, logging constraints)
- AGENTS.md now references `.agents/dev-documentation.md` for documentation guidelines
- AGENTS.md now includes critical reminder to read `.agents/dev-workflow.md` before writing code or docs
- README.md now includes inline verification step for `npm link` using `which` command with concise explanation of what
  npm link creates
- README.md now explains Node.js environment requirement for Claude Code CLI to execute the `remnote-mcp-server` command
- LICENSE file (MIT License)
- Repository, homepage, and bugs fields in package.json for npm registry
- Files field in package.json to explicitly control published files
- prepublishOnly script to ensure build before publishing
- Additional keywords for improved npm discoverability
- Publishing documentation in docs/publishing.md for maintainers

### Fixed

- Version mismatch between package.json (0.1.0) and MCP server declaration (was 1.0.0)
- Corrected critical configuration error in all documentation files that would prevent users from successfully setting
  up the server

### Changed

- **BREAKING**: Documentation now shows correct Claude Code configuration format using `~/.claude.json` with
  `mcpServers` key instead of deprecated `~/.claude/.mcp.json` format
- Completely rewrote README.md for better user experience with comprehensive installation, verification,
  troubleshooting, and usage examples
- Updated AGENTS.md with correct configuration format and deprecation notices
- Updated IMPLEMENTATION.md with correct configuration examples

### Removed

- Deleted CLAUDE_CODE_CONFIG.md (content consolidated into README.md and AGENTS.md to eliminate redundancy)

## [0.1.0] - 2026-02-06

### Added

- Initial release: RemNote MCP Server
- WebSocket server for RemNote plugin bridge
- MCP stdio transport for Claude Code integration
- Six RemNote tools: create_note, search, read_note, update_note, append_journal, status
- Request/response correlation with UUID tracking
- 5-second request timeout handling
- Heartbeat support (ping/pong)
- Single-client connection model
- Graceful shutdown handling (SIGINT/SIGTERM)
- Zod schema validation for all tool parameters
- TypeScript strict mode compilation
- Development mode with hot reload
- Global npm linking support
