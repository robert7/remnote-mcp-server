# RemNote MCP Server

![Status](https://img.shields.io/badge/status-beta-yellow) ![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/robert7/remnote-mcp-server/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/robert7/remnote-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/robert7/remnote-mcp-server)

MCP server that bridges Claude Code (and other MCP clients) to [RemNote](https://remnote.com/) via the [RemNote MCP
Bridge plugin](https://github.com/robert7/remnote-mcp-bridge).

## Demo

See Claude Code in action with RemNote: **[View Demo →](docs/demo.md)**

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

## Features

- **Create Notes** - Create new notes with optional parent hierarchy and tags
- **Search Knowledge Base** - Full-text search with configurable result limits
- **Read Notes** - Retrieve note content with configurable child depth
- **Update Notes** - Modify titles, append content, add/remove tags
- **Journal Entries** - Append timestamped entries to daily documents
- **Connection Status** - Check server and plugin connection health

## Multi-Agent Support

**Multiple AI agents can now connect simultaneously!** The server uses Streamable HTTP transport, allowing multiple Claude Code sessions (or other MCP clients) to access the same RemNote knowledge base concurrently.

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
npm run build

# Creates global symlink: makes remnote-mcp-server command available system-wide
npm link

# Verify it worked
which remnote-mcp-server
# Should output e.g.: /Users/<username>/.nvm/versions/node/<version>/bin/remnote-mcp-server
```

**What npm link does:** Creates a symbolic link from your global `node_modules` bin directory to this project's
executable, allowing Claude Code to launch `remnote-mcp-server` from anywhere without publishing to npm.

**Important:** Claude Code CLI must have access to the same Node.js environment where you ran `npm link`. If Claude Code
uses a different Node.js version or environment (e.g., different shell PATH), it won't find the command. Ensure your
shell configuration (`.bashrc`, `.zshrc`) properly exposes your Node.js environment.

**Unlinking the source installation:**

When you no longer want the global `remnote-mcp-server` command to point to your local repository:

```bash
# Remove the global symlink
npm unlink -g remnote-mcp-server

# Verify it's removed
which remnote-mcp-server
# Should output nothing if successfully unlinked
```

After unlinking, you can install the published npm package globally with `npm install -g remnote-mcp-server` if needed.

**About Streamable HTTP Transport**

This MCP server uses [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#http-with-sse),
a communication mechanism for MCP that supports multiple concurrent clients.

**Key characteristics:**

- **Lifecycle management**: You must start the server independently (`npm start` or `npm run dev`). Claude Code connects to the running server via HTTP.
- **Message protocol**: Communication uses JSON-RPC over HTTP POST for requests and Server-Sent Events (SSE) for notifications.
- **Multi-client support**: Multiple AI agents can connect simultaneously, each with their own MCP session.
- **Session management**: Server tracks sessions via `mcp-session-id` headers and UUID-based request correlation.

This architecture enables multiple Claude Code windows to access RemNote concurrently while maintaining process isolation and security boundaries. For technical details, see the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

### 2. Install RemNote MCP Bridge Plugin

Install the [RemNote MCP Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) in your RemNote app:

1. Open RemNote
2. Navigate to plugin installation (see plugin repository for instructions)
3. Configure WebSocket URL: `ws://127.0.0.1:3002`
4. Enable auto-reconnect

### 3. Start the Server

**IMPORTANT:** You must start the server before using it with Claude Code.

```bash
# Production mode
npm start

# OR development mode (with hot reload)
npm run dev
```

Expected output:
```
[WebSocket Server] Listening on port 3002
[HTTP Server] Listening on port 3001
```

Keep this terminal running. The server must be running for Claude Code to connect.

### 4. Configure Claude Code CLI

MCP servers are configured in `~/.claude.json` under the `mcpServers` key within project-specific sections.

**Add to your `~/.claude.json`:**

```json
{
  "projects": {
    "/Users/username": {
      "mcpServers": {
        "remnote": {
          "type": "streamable-http",
          "url": "http://127.0.0.1:3001/mcp"
        }
      }
    }
  }
}
```

**Configuration Notes:**

- **Global availability:** Use your home directory path (`/Users/username`) to make RemNote tools available in all
  projects
- **Project-specific:** Use a specific project path to limit availability to that project
- **Multiple projects:** Add `mcpServers` configuration under each project path as needed

**Example with multiple projects:**

```json
{
  "projects": {
    "/Users/username": {
      "mcpServers": {
        "remnote": {
          "type": "streamable-http",
          "url": "http://127.0.0.1:3001/mcp"
        }
      }
    },
    "/Users/username/Projects/my-project": {
      "mcpServers": {
        "remnote": {
          "type": "streamable-http",
          "url": "http://127.0.0.1:3001/mcp"
        }
      }
    }
  }
}
```

### 5. Restart Claude Code

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
{
  "connected": true,
  "actionsProcessed": 0,
  "pluginVersion": "1.1.0",
  "timestamp": "2026-02-07T..."
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

## Configuration

### Environment Variables

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

**Example with custom ports:**

```bash
# Set environment variables before starting
export REMNOTE_HTTP_PORT=3003
export REMNOTE_WS_PORT=3004
npm start
```

Then update your `~/.claude.json`:

```json
{
  "projects": {
    "/Users/username": {
      "mcpServers": {
        "remnote": {
          "type": "streamable-http",
          "url": "http://127.0.0.1:3003/mcp"
        }
      }
    }
  }
}
```

**Note:** If you change the WebSocket port, you must also update the WebSocket URL in the RemNote MCP Bridge plugin settings.

### RemNote Plugin Settings

Configure in the plugin control panel:

- **WebSocket URL:** `ws://127.0.0.1:3002` (or your custom port)
- **Auto-reconnect:** Enabled (recommended)

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
"type": "streamable-http"  // NEW - required
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
  "type": "streamable-http",
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

### Before Committing

Run `./code-quality.sh` to ensure all checks pass.

### Manual Testing

To test the server:

```bash
cd ~/Projects/_private/remnote-mcp-server
npm run dev
```

Expected output:
```
[WebSocket Server] Listening on port 3002
[HTTP Server] Listening on port 3001
```

When the RemNote plugin connects:
```
[WebSocket Server] Client connected
[RemNote Bridge] RemNote plugin connected
```

When Claude Code connects, you'll see HTTP requests in the logs.

Press Ctrl+C to stop.

### Development Documentation

- **[docs/architecture.md](./docs/architecture.md)** - Architecture and design rationale
- **[AGENTS.md](./AGENTS.md)** - AI agent and developer guidance
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history

## Related Projects

- [RemNote MCP Bridge Plugin](https://github.com/robert7/remnote-mcp-bridge) - Browser plugin for RemNote integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Open protocol for AI-application integration

## License

MIT
