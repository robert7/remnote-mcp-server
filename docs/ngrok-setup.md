# ngrok Setup for Claude Cowork Integration

This guide explains how to expose the RemNote MCP server to cloud-based services like Claude Cowork using ngrok.

## Security Notice

⚠️ **DEVELOPMENT/TESTING ONLY** - This setup provides no authentication and exposes your RemNote access to anyone with
the ngrok URL. Use only for:

- Local development and testing
- Short-term demonstrations
- Integration testing with Claude Cowork

**Note:** OAuth 2.1 authentication is planned for **production deployments**.

TODO: For production deployments, see [TODO: Production Deployment Guide](./production-deployment.md).

## Architecture

When using ngrok, the architecture becomes:

```
Claude Cowork (Cloud) ↔ ngrok HTTPS ↔ HTTP MCP Server :3001 (127.0.0.1)
                                      ↕
                                      WebSocket Server :3002 (127.0.0.1)
                                      ↕
                                      RemNote Plugin (Local)
```

**Critical Security:** The WebSocket server ALWAYS binds to localhost (127.0.0.1) and cannot be overridden. Only the
HTTP MCP endpoint is exposed via ngrok.

## Prerequisites

- RemNote MCP server installed (`npm install && npm link`)
- RemNote app running with MCP Bridge plugin installed
- ngrok account (free tier works for testing)

## Installation

### Install ngrok

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Linux:**
```bash
# Download and install from https://ngrok.com/download
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

**Windows:**
```bash
choco install ngrok
```

### Authenticate ngrok

1. Sign up at [ngrok.com](https://ngrok.com) (free tier is sufficient)
2. Get your authtoken from
   [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

## Usage

### Step 1: Start the RemNote MCP Server

Start the server normally (default localhost binding):

```bash
remnote-mcp-server
```

Expected output:
```json
{"level":"info","time":1234567890,"context":"websocket-server","port":3002,"host":"127.0.0.1","msg":"WebSocket server started"}
{"level":"info","time":1234567890,"context":"http-server","port":3001,"host":"127.0.0.1","msg":"HTTP server started"}
{"level":"info","time":1234567890,"wsPort":3002,"wsHost":"127.0.0.1","httpPort":3001,"httpHost":"127.0.0.1","msg":"RemNote MCP Server v0.3.1 listening"}
```

**Note:** ngrok tunnels to localhost, so the default 127.0.0.1 binding works perfectly. No special host configuration
is needed.

### Step 2: Start ngrok Tunnel

In a separate terminal, start ngrok:

```bash
ngrok http 3001
```

ngrok will output:
```
Session Status                online
Account                       your-account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3001
```

Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok-free.app`).

### Step 3: Configure Claude Cowork

Add the MCP server to Claude Cowork configuration using the ngrok URL:

**Server URL:** `https://abc123.ngrok-free.app/mcp`

Note: The `/mcp` path is required - it's the endpoint path for the MCP protocol.

## Testing

Test the exposed endpoint:

```bash
# Replace with your ngrok URL
curl -X POST https://abc123.ngrok-free.app/mcp \
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

Expected: JSON response with server capabilities and a `mcp-session-id` header.

## Limitations

### Free Tier

- URL changes on every restart (random subdomain like `abc123.ngrok-free.app`)
- Session timeout after 2 hours of inactivity
- "ngrok Browser Warning" screen for first-time visitors

**Solution:** Upgrade to ngrok paid plan for:

- Static domains (e.g., `remnote-mcp.ngrok.app`)
- Longer session durations
- No browser warning screen

### Security

- **No authentication** - Anyone with the URL can access your RemNote
- **HTTP only from your server** - HTTPS termination happens at ngrok
- **Logs visible in ngrok dashboard** - All requests are logged

**Mitigation:**

1. Use ngrok static domains (easier to share)
2. Rotate URLs frequently (free tier does this automatically)
3. Monitor ngrok web interface: `http://127.0.0.1:4040`
4. For production: OAuth 2.1 authentication (planned - see CHANGELOG.md Stage 2)

## Troubleshooting

### Connection Refused

**Symptom:** `curl` or Claude Cowork fails with "connection refused"

**Solution:**

- Verify server is running: `ps aux | grep remnote-mcp-server`
- Verify ngrok is forwarding to port 3001: Check ngrok output

### RemNote Plugin Not Connecting

**Symptom:** Server starts but RemNote plugin won't connect

**Solution:**

- WebSocket MUST be on localhost only
- Plugin connects to `ws://127.0.0.1:3002` (NOT via ngrok)
- Verify logs show `"wsHost":"127.0.0.1"`
- If `wsHost` is `0.0.0.0`, this is a bug - file an issue

### ngrok URL Changes Every Restart

**Expected behavior** on free tier. Solutions:

1. Use environment variable or script to update configuration automatically
2. Upgrade to ngrok paid plan for static domains
3. Use ngrok labeled tunnels feature (requires configuration file)

### Rate Limiting

ngrok free tier has request rate limits. If you hit limits:

- Reduce polling frequency in your application
- Upgrade to ngrok paid plan
- Use request batching where possible

## When Do I Need 0.0.0.0?

You do NOT need to bind to 0.0.0.0 for ngrok usage. ngrok tunnels to localhost.

**Bind to 0.0.0.0 only when:**

- Deploying on a VPS/cloud server and accessing from outside that machine
- Running in Docker containers (container networking requires it)
- Accessing the server from other devices on your local network
- Using a different reverse proxy that requires network-wide binding

**For ngrok specifically:** The server stays on 127.0.0.1, and ngrok creates a tunnel to localhost:3001.

## Alternative Solutions

If ngrok doesn't meet your needs:

- **localtunnel** - Open source alternative (`npx localtunnel --port 3001`)
- **Tailscale** - Secure mesh VPN for accessing local services remotely
- **CloudFlare Tunnel** - Free alternative with authentication options
- **Production deployment** - See [Production Deployment Guide](./production-deployment.md)

## Next Steps

- **For testing:** This setup is ready to use with Claude Cowork
- **For production:** Implement OAuth 2.1 authentication (see [Production Deployment](./production-deployment.md))
- **For security:** Monitor ngrok dashboard at `http://127.0.0.1:4040` during use
