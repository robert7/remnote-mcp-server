# Claude Code Configuration

How to configure [Claude Code CLI](https://claude.com/claude-code) to connect to the RemNote MCP Server.

## Overview

Claude Code is a local terminal-based AI agent that runs on your machine. It connects to the RemNote MCP Server via HTTP on localhost.

**Prerequisites:**

- RemNote MCP Server installed and running
- Claude Code CLI installed
- RemNote app running with MCP Bridge plugin installed and connected

## Quick Start

**1. Start the server:**

```bash
remnote-mcp-server
```

**2. Add the MCP server:**

```bash
# Navigate to your project directory
cd /Users/username/Projects/your-project

# Add the server
claude mcp add remnote --transport http http://localhost:3001/mcp
```

**3. Verify connection:**

```bash
claude mcp list
```

Expected output:
```
remnote: http://localhost:3001/mcp (HTTP) - ✓ Connected
```

**4. Start using RemNote:**

```bash
claude

prompt: search my RemNote for notes about "AI"
```

Claude will automatically use `remnote_search` and other RemNote tools as needed.

## Using the CLI Tool (Recommended)

Claude Code provides CLI commands to manage MCP servers.

### Add Server

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

### List Servers

```bash
claude mcp list
```

Example output:
```
remnote: http://localhost:3001/mcp (HTTP) - ✓ Connected
```

### Remove Server

```bash
claude mcp remove remnote
```

Example output:
```
✓ Removed MCP server "remnote"
  Config: /Users/username/.claude.json
```

## Manual Configuration

If you prefer to manually configure the MCP server instead of using `claude mcp add`, you can directly edit your `~/.claude.json` file.

### Configuration Structure

MCP servers are configured in `~/.claude.json` under the `mcpServers` key within project-specific sections.

### Global Configuration

Place the `mcpServers` configuration under your home directory path to make it available to all projects:

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

### Project-Specific Configuration

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

### Apply Changes

After manually editing the configuration, restart Claude Code completely to load the new configuration.

## Verifying Configuration

### Using remnote_status Tool

In any Claude Code session:

```
Use remnote_status to check the connection
```

### Using /mcp Command

```
/mcp
```

This shows all connected MCP servers and their health status.

### Using CLI

```bash
claude mcp list
```

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

## Custom Ports

If you're using custom ports, update the configuration accordingly:

```bash
# Start server with custom port
remnote-mcp-server --http-port 3003
```

Then update your configuration:

```json
{
  "type": "http",
  "url": "http://localhost:3003/mcp"
}
```

## Deprecated Configuration

**Old location (no longer used):**

- `~/.claude/.mcp.json`
- `enabledMcpjsonServers` setting

**Current location:**

- `~/.claude.json` with `mcpServers` under project paths

If you have old configuration, migrate to the new format using `claude mcp add`.

## Example Usage

Once configured, Claude Code can use RemNote tools automatically:

**Search:**
```
Search my RemNote for notes about "machine learning"
```

**Create notes:**
```
Create a RemNote note titled "Meeting Notes" with these bullet points:
- Discussed project timeline
- Assigned tasks to team members
```

**Update notes:**
```
Add a tag "important" to note abc123
```

**Journal:**
```
Add to my journal: "Completed the MCP integration today"
```

See the [Tools Reference](tools-reference.md) for detailed documentation of all available tools.

## Next Steps

- [Tools Reference](tools-reference.md) - Available MCP tools and usage
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [CLI Options Reference](cli-options.md) - Server configuration options

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report problems or ask questions
