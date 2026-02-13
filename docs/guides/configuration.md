# Configuration Guide

How to configure MCP clients to connect to the RemNote MCP Server.

## Overview

The RemNote MCP Server uses Streamable HTTP transport, which means:

- The server must be started independently before client connections
- Clients connect via HTTP to `http://localhost:3001/mcp` (default)
- Multiple clients can connect simultaneously
- Each client gets its own MCP session

## Claude Code CLI

### Using the CLI Tool (Recommended)

Claude Code provides CLI commands to manage MCP servers.

**Add the server:**

```bash
# Navigate to your project directory
cd /Users/username/Projects/sample-project

# Add the MCP server
claude mcp add remnote --transport http http://localhost:3001/mcp
```

Example output:
```
Added HTTP MCP server remnote with URL: http://localhost:3001/mcp to local config
File modified: /Users/username/.claude.json [project: /Users/username/Projects/sample-project]
```

**Verify connection:**

```bash
claude mcp list
```

Example output:
```
remnote: http://localhost:3001/mcp (HTTP) - ✓ Connected
```

**Using the server:**

Once configured, Claude Code automatically loads RemNote tools in your sessions:

```bash
claude

prompt: show remnote note titles related to AI assisted coding
```

The AI will automatically use `remnote_search` and other tools as needed.

**Remove the server:**

```bash
claude mcp remove remnote
```

Example output:
```
✓ Removed MCP server "remnote"
  Config: /Users/username/.claude.json
```

### Manual Configuration

If you prefer to manually configure the MCP server instead of using `claude mcp add`, you can directly edit your `~/.claude.json` file.

**Configuration structure:**

MCP servers are configured in `~/.claude.json` under the `mcpServers` key within project-specific sections.

**Add to `~/.claude.json`:**

```json
{
  "projects": {
    "/Users/username": {
      "mcpServers": {
        "remnote": {
          "type": "http",
          "url": "http://localhost:3001/mcp"
        }
      }
    }
  }
}
```

**For global configuration (all projects):**

Place the `mcpServers` configuration under your home directory path:

```json
{
  "projects": {
    "/Users/username": {
      "mcpServers": {
        "remnote": {
          "type": "http",
          "url": "http://localhost:3001/mcp"
        }
      }
    }
  }
}
```

**For project-specific configuration:**

Place under the specific project path:

```json
{
  "projects": {
    "/Users/username/Projects/my-project": {
      "mcpServers": {
        "remnote": {
          "type": "http",
          "url": "http://localhost:3001/mcp"
        }
      }
    }
  }
}
```

**After editing:**

Restart Claude Code completely to load the new configuration.

### Verifying Configuration

**In any Claude Code session:**

```
Use remnote_status to check the connection
```

Or use the `/mcp` command to see all connected MCP servers and their health.

## Accomplish

[Accomplish](https://github.com/accomplish-ai/accomplish) (formerly Openwork) is a task-based MCP client.

### Configuration

Edit Accomplish's MCP configuration file to add the RemNote server.

**Location:** Typically in Accomplish's settings or configuration directory.

**Configuration format:**

```json
{
  "mcpServers": {
    "remnote": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Restart Accomplish** after editing the configuration.

### Verification

In Accomplish, try a task that requires RemNote access:

```
Search my RemNote for notes about "project management"
```

Accomplish should automatically invoke the `remnote_search` tool.

## Claude Cowork

[Claude Cowork](https://claude.com/claude-cowork) is a cloud-based AI workspace. To use the RemNote MCP Server with Claude Cowork, you need to expose your local server to the internet.

**Prerequisites:**

- RemNote MCP Server running locally
- Remote access tool (ngrok, localtunnel, etc.)

**See the [Remote Access Setup Guide](remote-access.md) for detailed instructions.**

**Quick setup with ngrok:**

```bash
# 1. Start server normally
remnote-mcp-server

# 2. In another terminal, start ngrok
ngrok http 3001

# 3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)

# 4. Configure in Claude Cowork:
#    Server URL: https://abc123.ngrok-free.app/mcp
```

**Security note:** This exposes your RemNote access to anyone with the URL. Use only for development/testing. See the [Remote Access Guide](remote-access.md) for security considerations.

## Other MCP Clients

Any MCP client that supports Streamable HTTP transport can connect to the RemNote MCP Server.

### Generic Configuration

**Server URL:** `http://localhost:3001/mcp`

**Transport type:** HTTP with SSE (Server-Sent Events)

**Protocol version:** 2024-11-05 or later

### Connection Flow

1. Client sends POST request to `/mcp` with `initialize` method
2. Server responds with session ID in `mcp-session-id` header
3. Client includes session ID in subsequent requests
4. Server uses SSE for notifications and streaming responses

For technical details, see the [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#http-with-sse).

## Environment Variables

You can customize server ports and host binding via environment variables.

### Available Variables

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_HTTP_HOST` - HTTP server bind address (default: 127.0.0.1)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

### Using Custom Ports

**Start server with custom ports:**

```bash
export REMNOTE_HTTP_PORT=3003
export REMNOTE_WS_PORT=3004
remnote-mcp-server
```

**Or use CLI flags:**

```bash
remnote-mcp-server --http-port 3003 --ws-port 3004
```

**Update client configuration:**

After changing ports, update your MCP client configuration to use the new HTTP port:

```json
{
  "type": "http",
  "url": "http://localhost:3003/mcp"
}
```

**Update RemNote plugin:**

If you changed the WebSocket port, update the plugin settings in RemNote:

- WebSocket URL: `ws://127.0.0.1:3004` (or your custom port)

## RemNote Plugin Configuration

The RemNote MCP Bridge plugin must be configured to match the server's WebSocket port.

### Plugin Settings

**Location:** RemNote app → Plugin control panel

**Settings:**

- **WebSocket URL:** `ws://127.0.0.1:3002` (default, or your custom port)
- **Auto-reconnect:** Enabled (recommended)

### Verifying Plugin Connection

The plugin control panel should show:

- **Status:** "Connected" (green indicator)
- **Server:** ws://127.0.0.1:3002
- Connection timestamp
- Statistics (requests sent/received)

If the status shows "Disconnected," see the [Troubleshooting Guide](troubleshooting.md#plugin-wont-connect).

## Common Configuration Mistakes

### Wrong Transport Type

❌ **Incorrect (old stdio transport):**
```json
{
  "type": "stdio",
  "command": "remnote-mcp-server"
}
```

✅ **Correct (HTTP transport):**
```json
{
  "type": "http",
  "url": "http://localhost:3001/mcp"
}
```

### Missing /mcp Path

❌ **Incorrect:**
```json
{
  "type": "http",
  "url": "http://localhost:3001"
}
```

✅ **Correct:**
```json
{
  "type": "http",
  "url": "http://localhost:3001/mcp"
}
```

### Server Not Running

**Symptom:** Client shows connection error or timeout

**Solution:** Verify the server is running:

```bash
lsof -i :3001
# Should show node process listening
```

If not running, start the server:

```bash
remnote-mcp-server
```

### Wrong Port in Configuration

**Symptom:** Client can't connect even though server is running

**Solution:** Verify the port in your configuration matches the server's HTTP port:

```bash
# Check what port the server is using
lsof -i :3001

# Verify your configuration
cat ~/.claude.json | grep -A 5 remnote
```

### Deprecated Configuration File

**Old location (deprecated):**
- `~/.claude/.mcp.json` (no longer used)
- `enabledMcpjsonServers` setting (deprecated)

**Current location:**
- `~/.claude.json` with `mcpServers` under project paths

If you have old configuration, migrate to the new format.

## Multi-Client Setup

Multiple MCP clients can connect to the same RemNote MCP Server simultaneously.

### How It Works

- One server process runs on ports 3001 (HTTP) and 3002 (WebSocket)
- Each client gets its own MCP session
- All sessions share the same WebSocket bridge to RemNote
- Concurrent requests are handled via UUID-based correlation

### Example: Claude Code + Accomplish

**Terminal 1: Start server**
```bash
remnote-mcp-server
```

**Terminal 2: Claude Code**
```bash
claude
prompt: Search my RemNote for "AI"
```

**Accomplish window:**
```
Task: Create a RemNote note about today's meeting
```

Both clients can operate simultaneously without conflicts.

### Limitations

The WebSocket bridge enforces a **single RemNote plugin connection**. This means:

- Multiple AI clients can connect to the server
- But only one RemNote app instance can be connected at a time

This is a RemNote plugin limitation, not an MCP server limitation.

## Configuration Precedence

When using CLI flags, environment variables, and default values:

**Precedence (highest to lowest):**

1. CLI flags (`--http-port 3003`)
2. Environment variables (`REMNOTE_HTTP_PORT=3003`)
3. Default values (3001 for HTTP, 3002 for WebSocket)

**Example:**

```bash
# Environment variable sets port to 3003
export REMNOTE_HTTP_PORT=3003

# CLI flag overrides to 3005
remnote-mcp-server --http-port 3005

# Server uses 3005 (CLI flag wins)
```

## Next Steps

- [CLI Options Reference](cli-options.md) - Complete CLI flag documentation
- [Tools Reference](tools-reference.md) - Available MCP tools
- [Troubleshooting](troubleshooting.md) - Common configuration issues
- [Remote Access Setup](remote-access.md) - Expose server for Claude Cowork

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report problems or ask questions
