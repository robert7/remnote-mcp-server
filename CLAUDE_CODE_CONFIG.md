# Claude Code Configuration

To enable the RemNote MCP server globally in Claude Code (available for all projects).

## Step 1: Create Global MCP Configuration

Create `~/.claude/.mcp.json`:

```json
{
  "remnote": {
    "type": "stdio",
    "command": "remnote-mcp-server",
    "env": {
      "REMNOTE_WS_PORT": "3002"
    }
  }
}
```

**Command:**
```bash
cat > ~/.claude/.mcp.json << 'EOF'
{
  "remnote": {
    "type": "stdio",
    "command": "remnote-mcp-server",
    "env": {
      "REMNOTE_WS_PORT": "3002"
    }
  }
}
EOF
```

## Step 2: Enable in Settings

Add to `~/.claude/settings.json` (inside the main object):

```json
"enabledMcpjsonServers": [
  "remnote"
]
```

**Full example settings.json:**
```json
{
  "permissions": { ... },
  "model": "sonnet",
  "enabledMcpjsonServers": [
    "remnote"
  ]
}
```

## Step 3: Restart Claude Code

The MCP server will start automatically when Claude Code launches.

## Verification

### 1. Check Server is Running

After Claude Code restarts, verify the server started:

```bash
# Check process
ps aux | grep remnote-mcp-server

# Check port 3002 is listening
lsof -i :3002
```

You should see `remnote-mcp-server` process running.

### 2. Check RemNote Plugin Connection

Open RemNote with the MCP Bridge plugin installed. The plugin sidebar should show:
- **Status:** "Connected" (green)
- **Server:** ws://127.0.0.1:3002
- Connection timestamp

### 3. Test RemNote Tools in Claude Code

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
  "timestamp": "..."
}
```

### 4. Test Other Tools

```
Search RemNote for "test"
```

This should use `remnote_search` tool and return results from your knowledge base.

## Testing Server Manually

To test the server independently (without Claude Code):

```bash
# Stop Claude Code first (to free port 3002)
cd ~/Projects/_private/remnote-mcp-server
npm run dev
```

Expected output:
```
[WebSocket Server] Listening on port 3002
[MCP Server] Server started on stdio
```

When RemNote plugin connects:
```
[WebSocket Server] Client connected
[RemNote Bridge] RemNote plugin connected
```

Press Ctrl+C to stop.

## Troubleshooting

### Server Not Starting

1. Check if globally linked:
   ```bash
   which remnote-mcp-server
   ```
   Should return: `/Users/<username>/.nvm/versions/node/<version>/bin/remnote-mcp-server`

2. Re-link if needed:
   ```bash
   cd ~/Projects/_private/remnote-mcp-server
   npm link
   ```

3. Check Claude Code logs:
   ```bash
   tail -f ~/.claude/debug/mcp-*.log
   ```

### Port 3002 Already in Use

If you see "EADDRINUSE" error:
```bash
# Find what's using the port
lsof -i :3002

# Kill the process if needed
kill -9 <PID>
```

### Plugin Won't Connect

1. Verify plugin settings in RemNote:
   - WebSocket URL: `ws://127.0.0.1:3002`
   - Auto-reconnect: Enabled

2. Check plugin console (RemNote Developer Tools):
   ```
   Cmd+Option+I (macOS)
   Ctrl+Shift+I (Windows/Linux)
   ```

3. Restart RemNote

### Tools Not Appearing

1. Verify server is enabled:
   ```bash
   grep enabledMcpjsonServers ~/.claude/settings.json
   ```

2. Check MCP config exists:
   ```bash
   cat ~/.claude/.mcp.json
   ```

3. Restart Claude Code completely

## Project-Specific Configuration

To configure for a specific project instead of globally, create `.mcp.json` in the project root:

```bash
cd /path/to/your/project
cat > .mcp.json << 'EOF'
{
  "remnote": {
    "type": "stdio",
    "command": "remnote-mcp-server",
    "env": {
      "REMNOTE_WS_PORT": "3002"
    }
  }
}
EOF
```

Then enable in project's `.claude/settings.json` or approve when prompted by Claude Code.
