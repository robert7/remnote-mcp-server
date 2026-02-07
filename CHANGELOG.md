# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Documentation now shows correct Claude Code configuration format using `~/.claude.json` with `mcpServers` key instead of deprecated `~/.claude/.mcp.json` format
- Completely rewrote README.md for better user experience with comprehensive installation, verification, troubleshooting, and usage examples
- Updated AGENTS.md with correct configuration format and deprecation notices
- Updated IMPLEMENTATION.md with correct configuration examples

### Removed
- Deleted CLAUDE_CODE_CONFIG.md (content consolidated into README.md and AGENTS.md to eliminate redundancy)

### Fixed
- Corrected critical configuration error in all documentation files that would prevent users from successfully setting up the server

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
