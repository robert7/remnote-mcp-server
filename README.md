# RemNote MCP Server

![Status](https://img.shields.io/badge/status-beta-yellow) ![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/robert7/remnote-mcp-server/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/robert7/remnote-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/robert7/remnote-mcp-server)

MCP server that bridges AI agents (e.g. Claude Code) to [RemNote](https://remnote.com/) via the [RemNote MCP Bridge
plugin](https://github.com/robert7/remnote-mcp-bridge).

> **Note:** This is a working proof-of-concept/experimental solution. It "works on my machine" — you're invited to test it and [report any bugs or issues](https://github.com/robert7/remnote-mcp-server/issues).

## Demo

See Claude Code in action with RemNote: **[View Demo →](docs/demo.md)**

## Two-Component Architecture

This system consists of **two separate components** that work together:

1. **[RemNote MCP Bridge](https://github.com/robert7/remnote-mcp-bridge)** - A RemNote plugin that runs in your browser
   or RemNote desktop app and exposes RemNote API functionality via WebSocket
2. **RemNote MCP Server** (this repository) - A standalone server that connects your AI assistant to the bridge using
   MCP protocol

**Both components are required** for AI integration with RemNote.

## What is This?

The RemNote MCP Server enables AI assistants like Claude Code to interact directly with your RemNote knowledge base
through the Model Context Protocol (MCP). This allows you to create notes, search your knowledge base, update existing
notes, and maintain your daily journal—all through conversational commands.

**Architecture:**

```text
AI agents (HTTP) ↔ MCP HTTP Server :3001 ↔ WebSocket Server :3002 ↔ RemNote Plugin ↔ RemNote
```

The server acts as a bridge:

- Communicates with AI agents via Streamable HTTP transport (MCP protocol)
- HTTP server (port 3001) manages MCP sessions for multiple concurrent agents
- WebSocket server (port 3002) connects to the RemNote browser plugin
- Translates MCP tool calls into RemNote API actions

**About Streamable HTTP Transport**

This MCP server uses [Streamable HTTP
transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#http-with-sse), a communication
mechanism for MCP that supports multiple concurrent clients.

**Key characteristics:**

- **Lifecycle management**: You must start the server independently (`npm start` or `npm run dev`). Claude Code connects
  to the running server via HTTP.
- **Message protocol**: Communication uses JSON-RPC over HTTP POST for requests and Server-Sent Events (SSE) for
  notifications.
- **Multi-client support**: Multiple AI agents can connect simultaneously, each with their own MCP session.
- **Session management**: Server tracks sessions via `mcp-session-id` headers and UUID-based request correlation.

This architecture enables multiple Claude Code windows to access RemNote concurrently while maintaining process
isolation and security boundaries. For technical details, see the [MCP
specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

## Features

- **Create Notes** - Create new notes with optional parent hierarchy and tags
- **Search Knowledge Base** - Full-text search with configurable result limits
- **Read Notes** - Retrieve note content with configurable child depth
- **Update Notes** - Modify titles, append content, add/remove tags
- **Journal Entries** - Append timestamped entries to daily documents
- **Connection Status** - Check server and plugin connection health

## Multi-Agent Support

**Multiple AI agents can now connect simultaneously!** The server uses Streamable HTTP transport, allowing multiple
Claude Code sessions (or other MCP clients) to access the same RemNote knowledge base concurrently.

### How It Works

- One long-running server process on ports 3001 (HTTP) and 3002 (WebSocket)
- Multiple AI agents connect via HTTP and get independent MCP sessions
- All sessions share the same WebSocket bridge to RemNote
- Concurrent requests are handled via UUID-based correlation

### Limitations

The WebSocket bridge still enforces a **single RemNote plugin connection**. This means:

- Multiple AI agents can connect to the server
- But only one RemNote app instance can be connected at a time
- This is a RemNote plugin limitation, not an MCP server limitation

## Prerequisites

- **Node.js** >= 18.0.0
- **RemNote app** with [RemNote MCP Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) installed
- **Claude Code CLI** installed and configured

## Installation

### 1. Install the MCP Server

**From npm (recommended for most users):**

See [MCP Server npm Package](https://www.npmjs.com/package/remnote-mcp-server).

```bash
# Install globally
npm install -g remnote-mcp-server

# Verify installation
which remnote-mcp-server
# Should output: /path/to/node/bin/remnote-mcp-server
```

**Uninstalling:**

```bash
# Remove global installation
npm uninstall -g remnote-mcp-server
```

**From source (for development):**

```bash
git clone https://github.com/robert7/remnote-mcp-server.git
cd remnote-mcp-server
npm install
```

### 2. Install RemNote MCP Bridge Plugin

Install the [RemNote MCP Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) in your RemNote app:

1. Open RemNote
2. Navigate to plugin installation (see plugin repository for instructions)

### 3. Start the Server

**IMPORTANT:** You must start the server before using it with Claude Code.

```bash
# Start with default settings
remnote-mcp-server

# With custom ports
remnote-mcp-server --ws-port 4002 --http-port 4001

# With verbose logging
remnote-mcp-server --verbose

# With file logging
remnote-mcp-server --log-file /tmp/remnote-mcp.log --log-level-file debug

# OR development mode (with hot reload)
npm run dev
# you can also pass CLI options after `--`, e.g.
npm run dev -- -h
```

**CLI Options:**

Server Configuration:
- `--ws-port <number>` - WebSocket port (default: 3002, env: REMNOTE_WS_PORT)
- `--http-port <number>` - HTTP MCP port (default: 3001, env: REMNOTE_HTTP_PORT)
- `--http-host <host>` - HTTP server bind address (default: 127.0.0.1, env: REMNOTE_HTTP_HOST)

Logging Configuration:
- `--log-level <level>` - Console log level: debug, info, warn, error (default: info)
- `--log-level-file <level>` - File log level (default: same as --log-level)
- `--verbose` - Shorthand for --log-level debug
- `--log-file <path>` - Log to file (default: console only)
- `--request-log <path>` - Log all WebSocket requests to file (JSON Lines)
- `--response-log <path>` - Log all WebSocket responses to file (JSON Lines)

Information:
- `-h, --help` - Display help message
- `-v, --version` - Display version number

Expected output:
```
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

**Note on Logging:**
- Development environment (with `npm install`): Pretty-formatted colored logs
- Global installation (via `npm link`): JSON logs to stderr (pino-pretty not included)
- Both modes are fully functional - formatting is the only difference

Keep this terminal running. The server must be running for Claude Code to connect.

## Configuration of AI Agents

### Claude Code CLI

Use the `claude mcp` CLI commands to add, test, and remove the MCP server.

**Add the server:**

```bash
# goto your project directory
cd /Users/username/Projects/sample-project
claude mcp add remnote --transport http http://localhost:3001/mcp
```

Example output:

```text
Added HTTP MCP server remnote with URL: http://localhost:3001/mcp to local config
File modified: /Users/username/.claude.json [project: /Users/username/Projects/sample-project]
```

**Verify connection:**

```bash
claude mcp list
```

Example output:

```text
remnote: http://localhost:3001/mcp (HTTP) - ✓ Connected
```

As alternative you can use `/mcp` command in any Claude Code session to check the connection health.

**Using the server:**

Once configured, Claude Code automatically loads RemNote tools in your sessions. See the [Example Usage](#example-usage)
section below for conversational commands.

```bash
# In any Claude Code session
claude

prompt:
show remnote note titles related do AI assisted coding
...
remnote - remnote_search (MCP)(query: "AI assisted coding", limit: 20, includeContent: false)
...
Found 20 notes related to "AI assisted coding". The main results include:

  Primary note:
  - AI assisted coding (remId: qtVwh5XBQbJM2HfSp)

  Related tools/platforms:
  - Claude Code
  - Gemini CLI
  ...
```

**Remove the server:**

```bash
claude mcp remove remnote
```

Example output:

```text
✓ Removed MCP server "remnote"
  Config: /Users/username/.claude.json
```

### Claude Code CLI (manual configuration)

If you prefer to manually configure the MCP server in Claude Code CLI instead of using `claude mcp add`, you can
directly edit your `~/.claude.json` file.

MCP servers are configured in `~/.claude.json` under the `mcpServers` key within project-specific sections.

**Add to your `~/.claude.json`:**

```json
{
  "projects": {
    "/Users/username": {
      ...
      "mcpServers": {
        "remnote": {
          "type": "http",
          "url": "http://localhost:3001/mcp"
        }
   ...     
}
```

Restart Claude Code completely to load the MCP server configuration. Claude Code will connect to the running server.

## Verification

### Check Server is Running

Verify both ports are listening:

```bash
# Check HTTP port (MCP)
lsof -i :3001

# Check WebSocket port (RemNote bridge)
lsof -i :3002
```

You should see the `node` process listening on both ports.

### Check RemNote Plugin Connection

Open RemNote with the MCP Bridge plugin installed. The plugin control panel should show:

- **Status:** "Connected" (green)
- **Server:** ws://127.0.0.1:3002
- Connection timestamp

### Test in Claude Code

In any Claude Code session, try:

```
Use remnote_status to check the connection
```

Expected response:

```json
⏺ remnote - remnote_status (MCP)
  ⎿ {
       "connected": true,
       "pluginVersion": "0.3.2"
     }
```

### Test RemNote Integration

Try creating a note:

```
Create a RemNote note titled "MCP Test" with content "Testing the bridge"
```

This should use the `remnote_create_note` tool and create a new note in your RemNote knowledge base.

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `remnote_create_note` | Create a new note with optional parent and tags | `title`, `content`, `parentId`, `tags` |
| `remnote_search` | Search knowledge base | `query`, `limit`, `includeContent` |
| `remnote_read_note` | Read note by RemNote ID | `remId`, `depth` |
| `remnote_update_note` | Update title, append content, or modify tags | `remId`, `title`, `appendContent`, `addTags`, `removeTags` |
| `remnote_append_journal` | Append to today's daily document | `content`, `timestamp` |
| `remnote_status` | Check connection status and statistics | _(no parameters)_ |

## Example Usage

### Conversational Commands

Claude Code will automatically select the appropriate tool based on your natural language commands:

**Create notes:**
```
Create a note about "Project Ideas" with content:
- AI-powered note taking
- Personal knowledge management
```

**Search:**
```
Search my RemNote for notes about "machine learning"
```

**Read specific notes:**
```
Read the note with ID abc123
```

**Update notes:**
```
Add a tag "important" to note abc123
```

**Journal entries:**
```
Add to my journal: "Completed the RemNote MCP integration"
```

**Check status:**
```
Check if RemNote is connected
```

## Dependencies

### Optional Development Dependencies

- **pino-pretty** - Provides formatted console output in development
  - Automatically used when stdout is a TTY (interactive terminal)
  - Gracefully falls back to JSON logging if unavailable (e.g., global installations)
  - To enable in development: `npm install` (installs devDependencies)

## Configuration

### Environment Variables

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_HTTP_HOST` - HTTP server bind address (default: 127.0.0.1)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

**Example with custom ports:**

```bash
# Set environment variables before starting
export REMNOTE_HTTP_PORT=3003
export REMNOTE_WS_PORT=3004
npm start
# you can pass CLI options after `--`, e.g.
npm start -- -h
```

Then update your `~/.claude.json` and RemNote plugin settings to use the new ports.

**Note:** If you change the WebSocket port, you must also update the WebSocket URL in the RemNote MCP Bridge plugin
settings.

### RemNote Plugin Settings

Configure in the plugin control panel:

- **WebSocket URL:** `ws://127.0.0.1:3002` (or your custom port)
- **Auto-reconnect:** Enabled (recommended)

## Remote Access (ngrok/Claude Cowork)

By default, the RemNote MCP server binds to localhost (127.0.0.1) and is only accessible from your local machine. To enable cloud-based AI services like **Claude Cowork** to access your RemNote knowledge base, you need to expose the HTTP MCP endpoint remotely.

**Quick Setup with ngrok (Development/Testing):**

```bash
# 1. Start server normally - localhost binding is fine
remnote-mcp-server

# 2. In another terminal, start ngrok
ngrok http 3001

# 3. Use the ngrok HTTPS URL in Claude Cowork
# Example: https://abc123.ngrok-free.app/mcp
```

**Note:** ngrok tunnels to localhost, so no special host binding is needed. The default 127.0.0.1 binding works perfectly.

**Security Note:** The WebSocket server (RemNote plugin connection) ALWAYS stays on localhost (127.0.0.1) regardless of HTTP binding. This ensures your RemNote app connection is never exposed.

For detailed setup instructions, security considerations, and troubleshooting, see:
- **[ngrok Setup Guide](./docs/ngrok-setup.md)** - Development/testing with ngrok

For production deployments with OAuth 2.1 authentication, see:
- **[Production Deployment Guide](./docs/production-deployment.md)** - Coming soon

## Troubleshooting

### Server Not Starting

1. **Verify the server is running:**
   ```bash
   lsof -i :3001
   lsof -i :3002
   ```
Both ports should show active listeners.

2. **Check server output:**
   - You should see: `[HTTP Server] Listening on port 3001`
   - And: `[WebSocket Server] Listening on port 3002`
3. **If server fails to start:**
   - Check if ports are already in use (see "Port Already in Use" below)
   - Verify installation: `which remnote-mcp-server`
   - Check server logs for errors

### Port Already in Use

If you see "EADDRINUSE" error for port 3001 or 3002:

```bash
# Find what's using the ports
lsof -i :3001
lsof -i :3002

# Kill the process if needed
kill -9 <PID>
```

Alternatively, configure different ports using environment variables (see Configuration section).

### Plugin Won't Connect

1. **Verify plugin settings in RemNote:**
   - WebSocket URL: `ws://127.0.0.1:3002`
   - Auto-reconnect: Enabled
2. **Check plugin console (RemNote Developer Tools):**
   ```
   Cmd+Option+I (macOS)
   Ctrl+Shift+I (Windows/Linux)
   ```

3. **Restart RemNote** after changing settings
4. **Check server logs** for connection messages

### Tools Not Appearing in Claude Code

1. **Verify configuration in `~/.claude.json`:**
   ```bash
   cat ~/.claude.json | grep -A 10 mcpServers
   ```

2. **Ensure configuration is under correct project path** (use home directory for global)
3. **Restart Claude Code completely** (not just reload)
4. **Check MCP logs:**
   ```bash
   tail -f ~/.claude/debug/mcp-*.log
   ```

### Configuration Not Working

**Common issues:**

❌ **Wrong transport type:**
```json
"type": "stdio"  // OLD - doesn't work anymore
```

✅ **Correct transport type:**
```json
"type": "http"  // NEW - required
```

❌ **Using command instead of URL:**
```json
{
  "type": "stdio",
  "command": "remnote-mcp-server"  // OLD
}
```

✅ **Correct configuration:**
```json
{
  "type": "http",
  "url": "http://127.0.0.1:3001/mcp"  // NEW
}
```

## Development

### Setup

```bash
npm install
npm run build
npm link  # Make command globally available
```

### Development Workflow

```bash
npm run dev          # Watch mode with hot reload
npm run typecheck    # Type checking only
npm run build        # Production build
```

### Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report
```

### Code Quality

```bash
./code-quality.sh    # Run all checks
npm run lint         # ESLint only
npm run format       # Format code
```

### Development Documentation

- **[docs/architecture.md](./docs/architecture.md)** - Architecture and design rationale
- **[AGENTS.md](./AGENTS.md)** - AI agent and developer guidance
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history

## Related Projects

- [RemNote MCP Bridge Plugin](https://github.com/robert7/remnote-mcp-bridge) - Browser plugin for RemNote integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Open protocol for AI-application integration

## License

MIT
