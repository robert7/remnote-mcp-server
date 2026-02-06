# RemNote MCP Server

MCP server that bridges Claude Code (and other MCP clients) to RemNote via the RemNote MCP Bridge plugin.

## Installation

```bash
cd ~/Projects/_private/remnote-mcp-server
npm install
npm run build
npm link  # Makes remnote-mcp-server globally available
```

## Usage

### With Claude Code

Add to `~/.claude/claude_desktop_config.json`:

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

Then restart Claude Code.

### Manual Testing

```bash
# Start MCP server (requires RemNote with MCP Bridge plugin running)
npm start

# Or development mode with auto-reload
npm run dev
```

## Available Tools

- `remnote_create_note` - Create a new note
- `remnote_search` - Search the knowledge base
- `remnote_read_note` - Read a note by ID
- `remnote_update_note` - Update an existing note
- `remnote_append_journal` - Append to today's daily document
- `remnote_status` - Check connection status

## Architecture

```
Claude Code (stdio) ↔ MCP Server (WebSocket Server :3002) ↔ RemNote Plugin ↔ RemNote
```

## Development

```bash
npm run dev        # Development with hot reload
npm run typecheck  # Type checking only
npm run build      # Production build
```
