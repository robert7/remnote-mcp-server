# RemNote MCP Server

![Status](https://img.shields.io/badge/status-beta-yellow) ![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/robert7/remnote-mcp-server/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/robert7/remnote-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/robert7/remnote-mcp-server)

MCP server that bridges AI agents (e.g. Claude Code) to [RemNote](https://remnote.com/) via the [RemNote Bridge for MCP &
OpenClaw plugin](https://github.com/robert7/remnote-mcp-bridge).

> This is a working **proof-of-concept/experimental solution**. It "works on my machine" — you're invited to test
> it and [report any bugs or issues](https://github.com/robert7/remnote-mcp-server/issues).

## What is This?

The RemNote MCP Server enables AI assistants like Claude Code to interact directly with your RemNote knowledge base
through the Model Context Protocol (MCP). Create notes, search your knowledge base, update existing notes, and maintain
your daily journal—all through conversational commands.

## Demo

See AI agent examples in action with RemNote: **[View Demo →](docs/demo.md)**

### Two-Component Architecture

This system consists of **two separate components** that work together:

1. **[RemNote Bridge for MCP & OpenClaw](https://github.com/robert7/remnote-mcp-bridge)** - A RemNote plugin that runs in your browser
   or RemNote desktop app and exposes RemNote API functionality via WebSocket
2. **RemNote MCP Server** (this project) - A standalone server that connects your AI assistant to the bridge using MCP
   protocol

**Both components are required** for AI integration with RemNote.

### How It Works

```text
AI agents (HTTP) ↔ MCP HTTP Server :3001 ↔ WebSocket Server :3002 ↔ RemNote Plugin ↔ RemNote
```

The server acts as a bridge:

- Communicates with AI agents via Streamable HTTP transport (MCP protocol) - supports both local and remote access
- HTTP server (port 3001) manages MCP sessions for multiple concurrent agents
- WebSocket server (port 3002) connects to the RemNote browser plugin
- Translates MCP tool calls into RemNote API actions

**Multi-Agent Support:** Multiple AI agents can connect simultaneously to the same RemNote knowledge base. Each agent
gets its own MCP session while sharing the WebSocket bridge.

**Remote Access:** By default, the server binds to localhost (127.0.0.1) for local AI agents. Cloud-based services like
Claude Cowork require remote access—use tunneling tools like ngrok to expose the HTTP endpoint securely. The WebSocket
connection always stays local for security. See [Remote Access Guide](docs/guides/remote-access.md) for setup.

## Features

- **Create Notes** - Create new notes with optional parent hierarchy and tags
- **Search Knowledge Base** - Full-text search with configurable result limits
- **Read Notes** - Retrieve note content with configurable child depth
- **Update Notes** - Modify titles, append content, add/remove tags
- **Journal Entries** - Append timestamped entries to daily documents
- **Connection Status** - Check server and plugin connection health

## Quick Start

### 1. Install the Server

```bash
npm install -g remnote-mcp-server
```

### 2. Install the RemNote Plugin

Install the [RemNote Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) in your RemNote app. Currently
available from GitHub; registration in the RemNote marketplace is pending approval. Configure the plugin to connect
to `ws://127.0.0.1:3002`.

### 3. Start the Server

```bash
remnote-mcp-server
```

Expected output:

```text
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

Keep this terminal running.

### 4. Configure Your AI Client

- [Configuration Guide](docs/guides/configuration.md) - Overview and generic setup
  - [Claude Code CLI](docs/guides/configuration-claude-code-CLI.md) - Detailed Claude Code CLI configuration
  - [Accomplish](docs/guides/configuration-accomplish.md) - Accomplish (Openwork) configuration
  - [Claude Cowork](docs/guides/configuration-claude-cowork.md) - Cloud-based (requires remote access setup)

## Documentation

### Getting Started

- **[Installation Guide](docs/guides/installation.md)** - Complete installation instructions
- **[Configuration Guide](docs/guides/configuration.md)** - Configure Claude Code CLI, Accomplish, and other clients
- **[Demo & Screenshots](docs/demo.md)** - See the server in action with different AI clients

### Usage

- **[CLI Options Reference](docs/guides/cli-options.md)** - Command-line options and environment variables
- **[MCP Tools Reference](docs/guides/tools-reference.md)** - Detailed reference for all 6 RemNote tools
- **[Remote Access Setup](docs/guides/remote-access.md)** - Expose server for Claude Cowork (ngrok, etc.)

### Help & Advanced

- **[Troubleshooting](docs/guides/troubleshooting.md)** - Common issues and solutions
- **[Architecture](docs/architecture.md)** - Design rationale and technical architecture

### Development

- **[Development Setup](docs/guides/development-setup.md)** - Contributing guide for developers
- **[Integration Testing](docs/guides/integration-testing.md)** - End-to-end validation against a live RemNote instance
- **[Publishing Guide](docs/npm-publishing.md)** - npm publishing process (maintainers only)

## Available MCP Tools

| Tool                      | Description                                    |
|---------------------------|------------------------------------------------|
| `remnote_create_note`     | Create new notes with optional parent and tags |
| `remnote_search`          | Search knowledge base with full-text search    |
| `remnote_read_note`       | Read note by ID with configurable depth        |
| `remnote_update_note`     | Update title, append content, or modify tags   |
| `remnote_append_journal`  | Append to today's daily document               |
| `remnote_status`          | Check connection status and statistics         |

See the [Tools Reference](docs/guides/tools-reference.md) for detailed usage and examples.

## Supported AI Clients

- **[Claude Code CLI](https://claude.com/claude-code)** - Local terminal-based agent
- **[Claude Cowork](https://claude.com/blog/cowork-research-preview)** - Cloud-based workspace (requires [remote
  access](docs/guides/remote-access.md))
- **[Accomplish](https://github.com/accomplish-ai/accomplish)** - Task-based MCP client (formerly Openwork)
- **Any MCP client** supporting Streamable HTTP transport

## Example Usage

**Create notes:**

```text
Create a note about "Project Ideas" with content:
- AI-powered note taking
- Personal knowledge management
```

**Search:**

```text
Search my RemNote for notes about "machine learning"
```

**Update notes:**

```text
Add a tag "important" to note abc123
```

**Journal entries:**

```text
Add to my journal: "Completed the RemNote MCP integration"
```

See the [Tools Reference](docs/guides/tools-reference.md) for more examples.

## Configuration

### Environment Variables

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_HTTP_HOST` - HTTP server bind address (default: 127.0.0.1)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

### Custom Ports

```bash
remnote-mcp-server --http-port 3003 --ws-port 3004
```

After changing ports, update your MCP client configuration and RemNote plugin settings.

See [CLI Options Reference](docs/guides/cli-options.md) for all options.

## Troubleshooting

**Server won't start:**

- Check ports aren't in use: `lsof -i :3001` and `lsof -i :3002`
- Verify installation: `which remnote-mcp-server`

**Plugin won't connect:**

- Verify plugin settings: WebSocket URL `ws://127.0.0.1:3002`
- Check server is running: `lsof -i :3002`

**Tools not appearing:**

- Verify configuration: `claude mcp list`
- Restart Claude Code completely

See the [Troubleshooting Guide](docs/guides/troubleshooting.md) for detailed solutions.

## Contributing & Development

**Development setup:**

```bash
git clone https://github.com/robert7/remnote-mcp-server.git
cd remnote-mcp-server
npm install
npm run build
npm link
```

**Development workflow:**

```bash
npm run dev          # Watch mode with hot reload
npm test             # Run test suite
./code-quality.sh    # Run all quality checks
```

See the [Development Setup Guide](docs/guides/development-setup.md) for complete instructions.

## Related Projects

- [RemNote Bridge for MCP & OpenClaw](https://github.com/robert7/remnote-mcp-bridge) - Browser plugin for RemNote integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Open protocol for AI-application integration

## License

MIT

## Links

- [Documentation](docs/guides/) - Complete documentation
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Bug reports and feature requests
- [npm Package](https://www.npmjs.com/package/remnote-mcp-server) - Official npm package
- [CHANGELOG](CHANGELOG.md) - Version history and roadmap
