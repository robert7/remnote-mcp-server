# Troubleshooting Guide

Common issues and solutions for the RemNote MCP Server.

## Quick Diagnostics

Before diving into specific issues, verify the basic setup:

```bash
# 1. Check server is running
ps aux | grep remnote-mcp-server

# 2. Check ports are listening
lsof -i :3001  # HTTP MCP port
lsof -i :3002  # WebSocket port

# 3. Check server logs
# (if using --log-file, check that file)

# 4. Check MCP client configuration
cat ~/.claude.json | grep -A 5 remnote

# 5. Check RemNote plugin status
# (Open RemNote → Plugin control panel)
```

## Server Issues

### Server Not Starting

**Symptom:** Server command doesn't start or exits immediately

**Possible causes:**

1. **Command not found**
   ```bash
   remnote-mcp-server: command not found
   ```

**Solution:**
   ```bash
   # Verify installation
   which remnote-mcp-server

   # If not found, reinstall
   npm install -g remnote-mcp-server

   # Or check npm bin directory is in PATH
   echo $PATH
   npm config get prefix
   ```

2. **Node.js version too old**
   ```bash
   # Check version
   node --version
   # Requires >= 18.0.0

   # Update Node.js
   nvm install 18
   nvm use 18
   ```

3. **Missing dependencies**
   ```bash
   # For development installs
   cd /path/to/remnote-mcp-server
   npm install
   npm run build
   npm link
   ```

### Port Already in Use

**Symptom:** `EADDRINUSE: address already in use` error

**Solution:**

```bash
# Find what's using the ports
lsof -i :3001
lsof -i :3002

# Kill the process if needed
kill -9 <PID>

# Or use different ports
remnote-mcp-server --http-port 3003 --ws-port 3004
```

**For custom ports:**

1. Update MCP client configuration to use new HTTP port
2. Update RemNote plugin settings to use new WebSocket port

### Permission Errors

**Symptom:** `EACCES: permission denied` when starting server

**Solution:**

```bash
# Use ports above 1024 (don't require root)
remnote-mcp-server --http-port 3001  # Default, should work

# If you need ports below 1024, use sudo (not recommended)
sudo remnote-mcp-server --http-port 80
```

**For global installation permission errors:**

```bash
# Use nvm (recommended)
# See https://github.com/nvm-sh/nvm

# Or fix npm permissions
# See https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

### Server Starts But No Output

**Symptom:** Server starts but shows no log output

**Expected behavior:** Modern versions use structured logging. On first start, you should see:

```
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

**If you see nothing:**

1. Check the server actually started:
   ```bash
   lsof -i :3001
   ```

2. Check for verbose output:
   ```bash
   remnote-mcp-server --verbose
   ```

3. Log to file to capture output:
   ```bash
   remnote-mcp-server --log-file /tmp/remnote-mcp.log --verbose
   tail -f /tmp/remnote-mcp.log
   ```

## RemNote Plugin Issues

### Plugin Won't Connect

**Symptom:** Server running but plugin shows "Disconnected" status

**Solutions:**

1. **Verify plugin settings in RemNote:**
   - WebSocket URL: `ws://127.0.0.1:3002`
   - Auto-reconnect: Enabled
   - Check for typos in URL
2. **Verify WebSocket port is listening:**
   ```bash
   lsof -i :3002
   # Should show node process
   ```

3. **Check server logs for connection attempts:**
   ```bash
   remnote-mcp-server --verbose
   # Look for WebSocket connection messages
   ```

4. **Restart RemNote** after changing plugin settings
5. **Reinstall plugin** if persistent:
   - Remove plugin from RemNote
   - Restart RemNote
   - Reinstall plugin from [GitHub](https://github.com/robert7/remnote-mcp-bridge)
6. **Check plugin console for errors:**
   - Open RemNote Developer Tools: `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
   - Look for error messages in Console tab

### Plugin Connects Then Disconnects

**Symptom:** Plugin shows "Connected" briefly, then "Disconnected"

**Possible causes:**

1. **Server crashed** - Check server is still running:
   ```bash
   ps aux | grep remnote-mcp-server
   ```

2. **Port conflict** - Another process took the port:
   ```bash
   lsof -i :3002
   ```

3. **Network issue** - Check firewall settings (unlikely for localhost)

**Solution:**

- Restart server with verbose logging:
  ```bash
  remnote-mcp-server --verbose --log-file /tmp/remnote-debug.log
  ```

- Check logs for error messages
- Enable plugin auto-reconnect

### Plugin Shows Wrong Version

**Symptom:** `remnote_status` shows old plugin version

**Solution:**

1. Update RemNote MCP Bridge plugin:
   - Visit [GitHub repository](https://github.com/robert7/remnote-mcp-bridge)
   - Follow update instructions
2. Hard refresh RemNote (clear cache):
   - Close RemNote completely
   - Clear cache (method depends on platform)
   - Restart RemNote

## MCP Client Issues

### Tools Not Appearing in Claude Code

**Symptom:** RemNote tools don't show up in Claude Code

**Solutions:**

1. **Verify server is running:**
   ```bash
   lsof -i :3001
   ```

2. **Check configuration in `~/.claude.json`:**
   ```bash
   cat ~/.claude.json | grep -A 10 mcpServers
   ```

3. **Verify configuration format is correct:**

✅ **Correct:**
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

❌ **Incorrect (old stdio format):**
   ```json
   {
     "type": "stdio",
     "command": "remnote-mcp-server"
   }
   ```

4. **Restart Claude Code completely** (not just reload)
5. **Check MCP client logs:**
   ```bash
   tail -f ~/.claude/debug/mcp-*.log
   ```

6. **Test connection using CLI:**
   ```bash
   claude mcp list
   # Should show: remnote: http://localhost:3001/mcp (HTTP) - ✓ Connected
   ```

### Connection Timeout

**Symptom:** MCP client shows connection timeout

**Solutions:**

1. **Verify server is running and responding:**
   ```bash
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```

2. **Check for firewall blocking localhost** (rare but possible)
3. **Verify port number matches configuration:**
   ```bash
   # Check server port
   lsof -i :3001

   # Check configuration
   cat ~/.claude.json | grep -A 5 remnote
   ```

4. **Try different port:**
   ```bash
   remnote-mcp-server --http-port 3003
   # Update configuration to match
   ```

### Configuration Not Working

**Symptom:** Configuration changes don't take effect

**Solutions:**

1. **Ensure configuration is in correct location:**
   - Modern: `~/.claude.json` with `mcpServers` key
   - Old (deprecated): `~/.claude/.mcp.json`
2. **Verify JSON syntax:**
   ```bash
   cat ~/.claude.json | jq .
   # Should parse without errors
   ```

3. **Check project path matches:**
   - Configuration must be under correct project path in `~/.claude.json`
   - Use home directory path for global configuration
4. **Restart Claude Code completely:**
   - Quit Claude Code
   - Wait a few seconds
   - Restart
5. **Use CLI to manage configuration:**
   ```bash
   # Remove old configuration
   claude mcp remove remnote

   # Re-add with CLI
   claude mcp add remnote --transport http http://localhost:3001/mcp
   ```

## Tool Execution Issues

### Tools Return Errors

**Symptom:** MCP tools execute but return error messages

**Common errors:**

1. **"Note not found"**
   - Verify Rem ID is correct
   - Use `remnote_search` to find correct ID
   - Check note hasn't been deleted
2. **"Invalid parameter"**
   - Check parameter types match requirements
   - See [Tools Reference](tools-reference.md) for correct usage
3. **"RemNote plugin not connected"**
   - Check plugin status in RemNote
   - Verify WebSocket connection
   - See [Plugin Won't Connect](#plugin-wont-connect)
4. **"Request timeout"**
   - Check RemNote app is responsive
   - Check server logs for errors
   - Increase timeout if needed (not configurable yet - file an issue)

### Search Returns No Results

**Symptom:** `remnote_search` returns empty results even though notes exist

**Solutions:**

1. **Try broader search terms:**
   ```
   Search for "machine" instead of "machine learning algorithms"
   ```

2. **Check RemNote search works:**
   - Manually search in RemNote app
   - Verify notes actually contain the search term
3. **Verify plugin connection:**
   ```
   Use remnote_status to check connection
   ```

4. **Check RemNote indexing:**
   - RemNote may need time to index new notes
   - Wait a few seconds after creating notes

### Create Note Fails

**Symptom:** `remnote_create_note` returns error or note doesn't appear

**Solutions:**

1. **Check parameters are correct:**
   - Title is required
   - Content, parentId, tags are optional
   - See [Tools Reference](tools-reference.md)
2. **Verify RemNote is responsive:**
   - Check RemNote app isn't frozen
   - Try creating note manually in RemNote
3. **Check for special characters:**
   - Some characters may cause issues
   - Try simple title first
4. **Check server logs:**
   ```bash
   remnote-mcp-server --verbose
   ```

## Network Issues

### Can't Connect from Remote Client

**Symptom:** Claude Cowork or remote client can't connect

**Solutions:**

1. **Verify you've set up remote access:**
   - See [Remote Access Guide](remote-access.md)
   - Server must be exposed via ngrok or similar
2. **Check tunnel is running:**
   ```bash
   # For ngrok
   curl http://127.0.0.1:4040/api/tunnels | jq
   ```

3. **Verify HTTPS URL (not HTTP):**
   - Claude Cowork requires HTTPS
   - ngrok provides HTTPS by default
4. **Test tunnel endpoint:**
   ```bash
   curl -X POST https://your-ngrok-url.app/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```

### Firewall Blocking Connections

**Symptom:** Can't connect even though server is running

**Solutions:**

1. **For localhost connections (should always work):**
   - Verify using `localhost` or `127.0.0.1` (not `0.0.0.0`)
   - Check no VPN or security software blocking localhost
2. **For network connections:**
   - Check firewall rules allow traffic on ports 3001 and 3002
   - On macOS: System Preferences → Security & Privacy → Firewall
   - On Linux: `sudo ufw status`
3. **For remote connections:**
   - Use tunnel service (ngrok) instead of exposing directly
   - Firewall shouldn't block outbound tunnel connections

## Performance Issues

### Slow Response Times

**Symptom:** Tools take a long time to respond

**Possible causes:**

1. **Large note hierarchies:**
   - Reading deep hierarchies is slower
   - Use smaller `depth` parameter in `remnote_read_note`
2. **Many search results:**
   - Reduce `limit` parameter in `remnote_search`
   - Use `includeContent: false` for faster searches
3. **RemNote app performance:**
   - Check RemNote app isn't slow
   - Close other heavy applications
   - Restart RemNote
4. **Network latency (remote access):**
   - ngrok adds latency
   - Test locally first to isolate issue

### High CPU Usage

**Symptom:** Server uses excessive CPU

**Solutions:**

1. **Check for request loops:**
   - Verify MCP client isn't making rapid repeated requests
   - Check server logs for unusual activity
2. **Update to latest version:**
   ```bash
   npm update -g remnote-mcp-server
   ```

3. **Report issue:**
   - File bug report with logs on [GitHub](https://github.com/robert7/remnote-mcp-server/issues)

## Debugging

### Enable Verbose Logging

```bash
remnote-mcp-server --verbose --log-file /tmp/remnote-debug.log
```

### Log WebSocket Communication

```bash
remnote-mcp-server \
  --verbose \
  --request-log /tmp/requests.jsonl \
  --response-log /tmp/responses.jsonl
```

**View logs:**
```bash
# Main log
tail -f /tmp/remnote-debug.log

# Requests
tail -f /tmp/requests.jsonl | jq

# Responses
tail -f /tmp/responses.jsonl | jq
```

### Test Server Manually

```bash
# Test HTTP endpoint
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

### Check MCP Client Logs

**Claude Code:**
```bash
tail -f ~/.claude/debug/mcp-*.log
```

### Check RemNote Plugin Console

1. Open RemNote Developer Tools:
   - macOS: `Cmd+Option+I`
   - Windows/Linux: `Ctrl+Shift+I`
2. Check Console tab for errors
3. Check Network tab for WebSocket traffic

## Getting Help

### Before Filing an Issue

1. Check this troubleshooting guide
2. Search [existing issues](https://github.com/robert7/remnote-mcp-server/issues)
3. Collect diagnostic information:
   ```bash
   # Server version
   remnote-mcp-server --version

   # Node version
   node --version

   # OS version
   uname -a  # or: sw_vers (macOS)

   # Check ports
   lsof -i :3001
   lsof -i :3002

   # Capture logs
   remnote-mcp-server --verbose --log-file /tmp/debug.log
   ```

### Filing an Issue

Include in your bug report:

- Server version
- Node.js version
- Operating system
- MCP client (Claude Code, Accomplish, etc.)
- RemNote plugin version
- Steps to reproduce
- Error messages
- Relevant logs (redact sensitive information)

**File issues:** [github.com/robert7/remnote-mcp-server/issues](https://github.com/robert7/remnote-mcp-server/issues)

## Related Documentation

- [Installation Guide](installation.md) - Installation instructions
- [Configuration Guide](configuration.md) - Configuration details
- [CLI Options Reference](cli-options.md) - Command-line options
- [Tools Reference](tools-reference.md) - Tool usage details
- [Remote Access Guide](remote-access.md) - Remote access setup

## Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| Port already in use | `kill $(lsof -t -i:3001); kill $(lsof -t -i:3002)` |
| Plugin won't connect | Check URL: `ws://127.0.0.1:3002` |
| Tools not appearing | `claude mcp list` then restart Claude Code |
| Configuration ignored | Verify `~/.claude.json` format, restart client |
| Connection timeout | Verify server running: `lsof -i :3001` |
| Remote access failing | Use HTTPS ngrok URL with `/mcp` path |
| Slow responses | Reduce `depth`/`limit` parameters |
