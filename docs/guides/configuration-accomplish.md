# Accomplish Configuration

How to configure [Accomplish](https://github.com/accomplish-ai/accomplish) (formerly Openwork) to connect to the RemNote
MCP Server.

## Overview

Accomplish is an open source AI desktop agent that automates file management, document creation, and browser tasks
locally on your machine. Bring your own API keys (OpenAI, Anthropic, Google, xAI) or run local models via Ollama.

**Prerequisites:**

- RemNote MCP Server installed and running
- Accomplish installed
- RemNote app running with MCP Bridge plugin installed and connected

## Quick Start

**1. Start the server:**

```bash
remnote-mcp-server
```

**2. Edit Accomplish configuration:**

Edit `~/.config/opencode/opencode.json` to add the RemNote server:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "remnote": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "enabled": true
    }
  }
}
```

**3. Restart Accomplish**

**4. Test the connection:**

```
Search my RemNote for notes about "project management"
```

Accomplish should automatically invoke the `remnote_search` tool.

## Configuration

### Configuration File Location

Accomplish's MCP servers are configured in:

**Location:** `~/.config/opencode/opencode.json`

See details in [Accomplish MCP documentation](https://opencode.ai/docs/mcp-servers/).

### Configuration Format

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "remnote": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "enabled": true
    }
  }
}
```

**Parameters:**

- `type`: Must be `"remote"` for HTTP transport
- `url`: MCP server endpoint URL
- `enabled`: Set to `true` to enable the server

### Apply Changes

Restart Accomplish after editing the configuration file.

## Verification

### Test with a Query

In Accomplish, try a task that requires RemNote access:

```
Search my RemNote for notes about "project management"
```

Accomplish should automatically invoke the `remnote_search` tool.

### Check Tool Availability

Accomplish should show RemNote tools as available MCP tools. Check the Accomplish UI or logs to verify the connection.

## Common Configuration Mistakes

### Wrong Transport Type

Accomplish uses `"type": "remote"` for HTTP-based MCP servers.

❌ **Incorrect:**
```json
{
  "type": "stdio"
}
```

✅ **Correct:**
```json
{
  "type": "remote",
  "url": "http://localhost:3001/mcp"
}
```

### Missing /mcp Path

❌ **Incorrect:**
```json
{
  "url": "http://localhost:3001"
}
```

✅ **Correct:**
```json
{
  "url": "http://localhost:3001/mcp"
}
```

### Server Not Running

**Symptom:** Accomplish shows connection error

**Solution:** Verify the server is running:

```bash
lsof -i :3001
# Should show node process listening
```

If not running, start the server:

```bash
remnote-mcp-server
```

### Configuration Not Loaded

**Symptom:** RemNote tools don't appear in Accomplish

**Solutions:**

1. Verify the configuration file location is correct
2. Check JSON syntax is valid
3. Restart Accomplish completely
4. Check Accomplish logs for error messages

## Custom Ports

If you're using custom ports, update the URL accordingly:

```bash
# Start server with custom port
remnote-mcp-server --http-port 3003
```

Then update your configuration:

```json
{
  "mcp": {
    "remnote": {
      "type": "remote",
      "url": "http://localhost:3003/mcp",
      "enabled": true
    }
  }
}
```

## Example Usage

Once configured, Accomplish can use RemNote tools for various tasks:

**Search:**
```
Find all RemNote notes about "machine learning"
```

**Create notes:**
```
Create a RemNote note about today's meeting
```

**Update notes:**
```
Add "important" tag to my RemNote note about project deadline
```

**Journal:**
```
Add a journal entry: "Completed MCP integration setup"
```

See the [Tools Reference](tools-reference.md) for detailed documentation of all available tools.

## Multi-Model Support

Accomplish supports multiple AI models including:

- GPT-4, GPT-4o, GPT-5.2 (via OpenAI)
- Claude models (via Anthropic)
- Other model providers

All models can access the RemNote MCP Server through the same configuration.

## Next Steps

- [Tools Reference](tools-reference.md) - Available MCP tools and usage
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [CLI Options Reference](cli-options.md) - Server configuration options

## Need Help?

- [Accomplish Documentation](https://opencode.ai/docs/) - Official Accomplish docs
- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report problems or ask questions
