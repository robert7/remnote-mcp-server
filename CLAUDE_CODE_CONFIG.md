# Claude Code Configuration

To enable the RemNote MCP server in Claude Code, add the following configuration to your Claude Code settings.

## Configuration Location

The exact location depends on your Claude Code installation. You may need to add this to:

- `~/.claude/mcp_config.json` (if it exists)
- `~/.claude/settings.json` under an `mcpServers` key
- Or use the Claude Code UI to add MCP servers

## Configuration to Add

```json
{
  "mcpServers": {
    "remnote": {
      "command": "remnote-mcp-server",
      "env": {
        "REMNOTE_WS_PORT": "3002"
      }
    }
  }
}
```

## Verification

After adding the configuration and restarting Claude Code:

1. Open RemNote with the MCP Bridge plugin installed and enabled
2. The plugin should show "Connected" status
3. In Claude Code, you should be able to use RemNote tools:
   - `remnote_create_note`
   - `remnote_search`
   - `remnote_read_note`
   - `remnote_update_note`
   - `remnote_append_journal`
   - `remnote_status`

## Manual Testing

To test the server manually without Claude Code:

```bash
cd ~/Projects/_private/remnote-mcp-server
npm run dev
```

The server will start and wait for:

1. RemNote plugin to connect via WebSocket (port 3002)
2. MCP client to connect via stdio

You should see:
```
[WebSocket Server] Listening on port 3002
[MCP Server] Server started on stdio
```

When the RemNote plugin connects:
```
[WebSocket Server] Client connected
[RemNote Bridge] RemNote plugin connected
```
