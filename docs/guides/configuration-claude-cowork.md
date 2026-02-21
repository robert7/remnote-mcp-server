# Claude Cowork Configuration

How to configure [Claude Cowork](https://claude.com/blog/cowork-research-preview) (cloud-based) to connect to the
RemNote MCP Server.

## Overview

Claude Cowork is Anthropic's research preview feature in the Claude Desktop app that extends the agentic architecture
of Claude Code to non-coding knowledge work.

## Prerequisites

- RemNote MCP Server installed and running locally
- RemNote app running with RemNote Automation Bridge plugin installed and connected
- Remote HTTPS access to your local MCP endpoint (see [Remote Access Setup](remote-access.md))

## Configure Claude Cowork

1. Complete remote access setup and get a public HTTPS tunnel URL (for example, `https://abc123.ngrok-free.app`).
2. In Claude Cowork, add the MCP server URL as:

```text
https://abc123.ngrok-free.app/mcp
```

3. In Claude Cowork, run a quick check:

```text
Use remnote_status to check the connection
```

Expected: response includes connection information and plugin details.

## Example Usage

Once configured, Claude Cowork can use RemNote tools:

**Search:**
```text
Search my RemNote for notes about "blue light & sleep"
```

**Create notes:**
```text
Create a RemNote note with key findings from this conversation
```

**Update notes:**
```text
Add today's discussion to my RemNote journal
```

See the [Tools Reference](tools-reference.md) for detailed documentation of all available tools.

## Related Documentation

- [Remote Access Setup](remote-access.md) - Tunnel setup, security, and troubleshooting
- [Tools Reference](tools-reference.md) - Available MCP tools and usage
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

## Need Help?

- [Remote Access Setup](remote-access.md) - Tunnel setup and diagnostics
- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report problems or ask questions
