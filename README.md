# RemNote MCP Server

![Status](https://img.shields.io/badge/status-beta-yellow) ![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/robert7/remnote-mcp-server/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/robert7/remnote-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/robert7/remnote-mcp-server)

MCP server that bridges AI agents (e.g. Claude Code) to [RemNote](https://remnote.com/) via the [RemNote Automation
Bridge plugin](https://github.com/robert7/remnote-mcp-bridge).

> This is a working solution, but still experimental. If you run into any issues, please [report them here](https://github.com/robert7/remnote-mcp-server/issues).

## What is This?

The RemNote MCP Server enables AI assistants like Claude Code to interact directly with your RemNote knowledge base
through the Model Context Protocol (MCP). Create notes, hierarchical markdown trees, and RemNote-native flashcards;
search and read your knowledge base; update existing notes; and maintain your daily journal, all through
conversational commands.

For some agentic workflows or CLI-first automation, the companion app
**[remnote-cli](https://github.com/robert7/remnote-cli)** may be a better fit than running a full MCP server.

## Demo

See AI agent examples in action with RemNote: **[View Demo →](docs/demo.md)**

### Two-Component Architecture

This system consists of **two separate components** that work together:

1. **[RemNote Automation Bridge](https://github.com/robert7/remnote-mcp-bridge)** - A RemNote plugin that runs in your
   browser or RemNote desktop app and exposes RemNote API functionality via WebSocket
2. **RemNote MCP Server** (this project) - A standalone server that connects your AI assistant to the bridge using MCP
   protocol

**Both components are required** for AI integration with RemNote.

For the detailed bridge connection lifecycle, retry phases, and wake-up triggers, use the bridge repo as the source of
truth: [Connection Lifecycle Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/connection-lifecycle.md).

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

- **Create Notes & Flashcards** - Create simple notes, hierarchical markdown trees, or RemNote-native flashcards
- **Search Knowledge Base** - Run full-text searches or tag-based searches with ancestor context
- **Read Notes** - Retrieve note content in markdown or structured form with configurable traversal depth
- **Update Notes** - Modify titles, append or replace hierarchical content, and manage tags
- **Journal Entries** - Append timestamped daily entries, including hierarchical markdown content
- **Agent Playbook** - Return built-in navigation and safety guidance for MCP clients
- **Connection Status** - Check server and plugin connection health

## Quick Start

### 1. Install the Server

> **Version compatibility (`0.x` semver):** install a `remnote-mcp-server` version compatible with your installed RemNote Automation Bridge plugin version. See the [Bridge / Consumer Version Compatibility Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md).

```bash
npm install -g remnote-mcp-server
```

### 2. Install the RemNote Plugin

Install the [RemNote Automation Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) in your RemNote app.
Currently available from GitHub; registration in the RemNote marketplace is pending approval. Configure the plugin
to connect to `ws://127.0.0.1:3002`.

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
  - [ChatGPT](docs/guides/configuration-chatgpt.md) - ChatGPT Apps configuration
  - [Claude Cowork](docs/guides/configuration-claude-cowork.md) - Cloud-based (requires remote access setup)
  - [Claude Code CLI](docs/guides/configuration-claude-code-CLI.md) - Detailed Claude Code CLI configuration
  - [Accomplish](docs/guides/configuration-accomplish.md) - Accomplish (Openwork) configuration

## Documentation

### Getting Started

- **[Installation Guide](docs/guides/installation.md)** - Complete installation instructions
- **[Bridge / Consumer Version Compatibility
  Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)**
  \- Match server version to installed bridge plugin version (`0.x` semver)
- **[Bridge Connection Lifecycle](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/connection-lifecycle.md)** - Canonical bridge connect/retry behavior
- **[Configuration Guide](docs/guides/configuration.md)** - Configure Claude Code CLI, Accomplish, and other clients
- **[ChatGPT Configuration Guide](docs/guides/configuration-chatgpt.md)** - Set up ChatGPT Apps with your MCP server
- **[Demo & Screenshots](docs/demo.md)** - See the server in action with different AI clients

### Usage

- **[CLI Options Reference](docs/guides/cli-options.md)** - Command-line options and environment variables
- **[MCP Tools Reference](docs/guides/tools-reference.md)** - Detailed reference for all 9 RemNote tools
- **[Remote Access Setup](docs/guides/remote-access.md)** - Expose server for Claude Cowork (ngrok, etc.)

### Help & Advanced

- **[Troubleshooting](docs/guides/troubleshooting.md)** - Common issues and solutions
- **[Architecture](docs/architecture.md)** - Design rationale and technical architecture

### Development

- **[Development Setup](docs/guides/development-setup.md)** - Contributing guide for developers
- **[Integration Testing](docs/guides/integration-testing.md)** - Canonical shared workflow for updating and running MCP server + CLI integration coverage against live RemNote
- **[Publishing Guide](docs/npm-publishing.md)** - npm publishing process (maintainers only)

## Available MCP Tools

| Tool                      | Description                                    |
|---------------------------|------------------------------------------------|
| `remnote_create_note`     | Create notes, markdown trees, or flashcards with title, content, parent, and tags |
| `remnote_search`          | Search knowledge base with full-text search    |
| `remnote_search_by_tag`   | Search by tag with ancestor-context resolution |
| `remnote_read_note`       | Read note by ID in markdown or structured form |
| `remnote_update_note`     | Update title, append/replace content, or modify tags |
| `remnote_append_journal`  | Append hierarchical content to today's daily document |
| `remnote_read_table`      | Read Advanced Table columns, rows, and typed property metadata |
| `remnote_get_playbook`    | Get recommended MCP usage/navigation playbook  |
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
- If this started after upgrades, verify bridge/server version compatibility (`0.x` minor versions may break); see the
  [Bridge / Consumer Version Compatibility
  Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)

See the [Troubleshooting Guide](docs/guides/troubleshooting.md) for detailed solutions.

## Contributing & Development

**Development setup:**

> **Version compatibility tip:** when testing against a local or marketplace-installed bridge plugin, use a server checkout/tag compatible with that bridge plugin version (see the [Bridge / Consumer Version Compatibility Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)).

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

Pull requests that affect bridge-consumer behavior should follow the shared PR rules in the bridge repo: [Pull Request Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/pull-request-guide.md). In particular, keep bridge/server/CLI parity for shared functionality changes and link related PRs across the affected repos.

For the canonical workflow for updating and running shared live integration coverage, see the [Integration Testing Guide](docs/guides/integration-testing.md).

## Related Projects

- [RemNote Automation Bridge](https://github.com/robert7/remnote-mcp-bridge) - Browser plugin for RemNote integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Open protocol for AI-application integration

## License

MIT

## Links

- [Documentation](docs/guides/) - Complete documentation
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Bug reports and feature requests
- [npm Package](https://www.npmjs.com/package/remnote-mcp-server) - Official npm package
- [CHANGELOG](CHANGELOG.md) - Version history and roadmap
