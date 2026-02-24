# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Legacy bridge warning**: `remnote_status` now injects `version_warning` for legacy bridge plugins (0.5.x) that
  don't send a `hello` message, by falling back to `pluginVersion` from the `get_status` response.

### Added

- **Automatic version compatibility checks**: Server receives bridge `hello` message on connect, stores bridge version,
  and logs a warning if minor versions differ (0.x rule). `remnote_status` response now includes `serverVersion` and
  `version_warning` (when bridge/server minor versions differ).

### Enhanced

- `remnote_search` tool now supports `includeContent: "markdown"` to render child subtrees as indented markdown previews.
- `remnote_search` tool now also supports `includeContent: "structured"` to return nested child objects with `remId`s
  via `contentStructured` for follow-up note reads/navigation.
- `remnote_read_note` tool now returns rendered markdown content of the child subtree by default.
- New output fields in both tools: `headline` (display-oriented full line with type-aware delimiters), `aliases`
  (alternate names), `contentProperties` (rendering metadata: `childrenRendered`, `childrenTotal`, `contentTruncated`).
- New input parameters for both tools: `childLimit`, `maxContentLength`.

### Changed

- **BREAKING**: `includeContent` parameter changed from `boolean` to `'none' | 'markdown'` string enum in both
  `SearchSchema` and `ReadNoteSchema`.
- **BREAKING**: `remnote_read_note` no longer returns `children` array. Use `content` (markdown mode) instead.
- **BREAKING**: `content` field in `remnote_read_note` changed from echoing `title` to rendered markdown of child subtree.
- **BREAKING**: `detail` field removed from advertised `remnote_search` / `remnote_read_note` output schemas (bridge no longer returns it).
- Default `depth` for `remnote_read_note` increased from 3 to 5.
- Search schema defaults: `depth=1`, `childLimit=20`, `maxContentLength=3000`.
- Read schema defaults: `depth=5`, `childLimit=100`, `maxContentLength=100000`.
- Updated `outputSchema` for both `SEARCH_TOOL` and `READ_NOTE_TOOL` to reflect new fields.

### Documentation

- Added bridge/plugin compatibility warnings and links in install/development/troubleshooting docs, referencing the
  canonical bridge-side `0.x` version compatibility guide.
- Updated tools reference parameter docs for string `includeContent` and corrected search/read depth defaults.
- Updated tools reference for `remnote_search includeContent: "structured"` and `contentStructured` use cases.

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
