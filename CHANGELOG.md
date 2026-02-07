# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
