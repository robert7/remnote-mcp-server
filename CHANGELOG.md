# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Internal

- Fixed intermittent test failures on GitHub Actions caused by race condition between HTTP server start and connection readiness
  - Added `waitForHttpServer()` test helper with exponential backoff retry logic to ensure server is ready before tests attempt connections
  - Fixed socket resource leak in error handler that caused file descriptor exhaustion on CI with coverage enabled
  - Uses lightweight TCP connection probes (1-2ms overhead locally, up to ~127ms worst case on slow CI)
  - Updated all 21 HTTP server test cases to use the helper after `start()` calls

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
- Coauthorship policy documented in CLAUDE.md
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
