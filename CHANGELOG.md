# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic
Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- README.md now includes explanation of stdio transport architecture and its implications (lifecycle management, message
  protocol, logging constraints)
- AGENTS.md now references `.agents/dev-documentation.md` for documentation guidelines
- README.md now includes inline verification step for `npm link` using `which` command with concise explanation of what
  npm link creates
- README.md now explains Node.js environment requirement for Claude Code CLI to execute the `remnote-mcp-server` command
- LICENSE file (MIT License)
- Repository, homepage, and bugs fields in package.json for npm registry
- Files field in package.json to explicitly control published files
- prepublishOnly script to ensure build before publishing
- Additional keywords for improved npm discoverability
- Coauthorship policy documented in CLAUDE.md

### Fixed

- Version mismatch between package.json (0.1.0) and MCP server declaration (was 1.0.0)

### Changed

- **BREAKING**: Documentation now shows correct Claude Code configuration format using `~/.claude.json` with
  `mcpServers` key instead of deprecated `~/.claude/.mcp.json` format
- Completely rewrote README.md for better user experience with comprehensive installation, verification,
  troubleshooting, and usage examples
- Updated AGENTS.md with correct configuration format and deprecation notices
- Updated IMPLEMENTATION.md with correct configuration examples

### Removed

- Deleted CLAUDE_CODE_CONFIG.md (content consolidated into README.md and AGENTS.md to eliminate redundancy)

### Fixed

- Corrected critical configuration error in all documentation files that would prevent users from successfully setting
  up the server

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
