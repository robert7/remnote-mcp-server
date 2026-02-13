# Remote Access Setup

How to expose your local RemNote MCP Server to cloud-based services like Claude Cowork.

## Overview

By default, the RemNote MCP Server binds to localhost (127.0.0.1) and is only accessible from your local machine.
To enable cloud-based AI services like **Claude Cowork** to access your RemNote knowledge base, you need to expose the
HTTP MCP endpoint remotely.

**Security Warning:** The methods described here provide **no authentication** and expose your RemNote access to anyone
with the URL. Use only for:

- Local development and testing
- Short-term demonstrations
- Integration testing with Claude Cowork

**Note:** OAuth 2.1 authentication is planned for production deployments (see [CHANGELOG.md](../../CHANGELOG.md) Stage
2).

## Architecture

When using remote access, the architecture becomes:

```
Claude Cowork (Cloud) ↔ Tunnel (HTTPS) ↔ HTTP MCP Server :3001 (127.0.0.1)
                                          ↕
                                          WebSocket Server :3002 (127.0.0.1)
                                          ↕
                                          RemNote Plugin (Local)
```

**Critical Security:** The WebSocket server ALWAYS binds to localhost (127.0.0.1) and cannot be overridden. Only the
HTTP MCP endpoint is exposed via tunnel.

## Quick Setup with ngrok

ngrok is the recommended solution for development and testing.

### Prerequisites

- RemNote MCP server installed
- RemNote app running with MCP Bridge plugin installed
- ngrok account (free tier works for testing)

### Installation

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Linux:** [ngrok on Linux](https://ngrok.com/docs/guides/device-gateway/linux)
```

**Windows:**
```bash
choco install ngrok
```

### Authentication

1. Sign up at [ngrok.com](https://ngrok.com) (free tier is sufficient)
2. Get your authtoken from
   [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Usage

**Step 1: Start the RemNote MCP Server**

Start the server normally (default localhost binding):

```bash
remnote-mcp-server
```

Expected output:
```
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

**Note:** ngrok tunnels to localhost, so the default 127.0.0.1 binding works perfectly. No special host configuration
is needed.

**Step 2: Start ngrok Tunnel**

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

**Step 3: Configure Claude Cowork**

Add the MCP server to Claude Cowork configuration using the ngrok URL:

**Server URL:** `https://abc123.ngrok-free.app/mcp`

**Note:** The `/mcp` path is required - it's the endpoint path for the MCP protocol.

### Testing

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

### ngrok Limitations

**Free Tier:**

- URL changes on every restart (random subdomain like `abc123.ngrok-free.app`)
- Session timeout after 2 hours of inactivity
- "ngrok Browser Warning" screen for first-time visitors

**Solution:** Upgrade to ngrok paid plan for:

- Static domains (e.g., `remnote-mcp.ngrok.app`)
- Longer session durations
- No browser warning screen

**Security:**

- **No authentication** - Anyone with the URL can access your RemNote
- **HTTP only from your server** - HTTPS termination happens at ngrok
- **Logs visible in ngrok dashboard** - All requests are logged

**Mitigation:**

1. Use ngrok static domains (easier to share)
2. Rotate URLs frequently (free tier does this automatically)
3. Monitor ngrok web interface: `http://127.0.0.1:4040`
4. For production: OAuth 2.1 authentication (planned - see [CHANGELOG.md](../../CHANGELOG.md) Stage 2)

## Alternative Solutions

### Tailscale

Secure mesh VPN for accessing local services remotely.

**Installation:** See [tailscale.com/download](https://tailscale.com/download)

**Usage:**

1. Install Tailscale on both client and server machines
2. Start Tailscale on both
3. Access server via Tailscale IP (e.g., `http://100.x.x.x:3001/mcp`)

**Pros:**

- Secure (WireGuard VPN)
- No public exposure
- Works across networks

**Cons:**

- Requires Tailscale on both ends (not suitable for Claude Cowork)
- More complex setup

### CloudFlare Tunnel

Free alternative with authentication options.

**Installation:** See
[developers.cloudflare.com/cloudflare-one/connections/connect-apps](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps)

**Usage:**

1. Install CloudFlare Tunnel client
2. Configure tunnel to port 3001
3. Set up CloudFlare Access for authentication (optional)

**Pros:**

- Free
- Optional authentication
- Good performance

**Cons:**

- More complex setup
- Requires CloudFlare account

## When Do I Need 0.0.0.0?

You do **NOT** need to bind to 0.0.0.0 for ngrok or tunnel usage. These tools tunnel to localhost.

**Bind to 0.0.0.0 only when:**

- Deploying on a VPS/cloud server and accessing from outside that machine
- Running in Docker containers (container networking requires it)
- Accessing the server from other devices on your local network
- Using a different reverse proxy that requires network-wide binding

**For ngrok specifically:** The server stays on 127.0.0.1, and ngrok creates a tunnel to localhost:3001.

**Example (binding to 0.0.0.0):**
```bash
remnote-mcp-server --http-host 0.0.0.0
```

**Security warning:** This exposes the server to any device on your network. Use only in trusted environments.

## Troubleshooting

### Connection Refused

**Symptom:** `curl` or Claude Cowork fails with "connection refused"

**Solution:**

1. Verify server is running:
   ```bash
   ps aux | grep remnote-mcp-server
   lsof -i :3001
   ```

2. Verify tunnel is forwarding to port 3001:
   - Check ngrok output or web interface: `http://127.0.0.1:4040`
3. Test locally first:
   ```bash
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```

### RemNote Plugin Not Connecting

**Symptom:** Server starts but RemNote plugin won't connect

**Solution:**

1. WebSocket MUST be on localhost only
2. Plugin connects to `ws://127.0.0.1:3002` (NOT via tunnel)
3. Verify server logs show `wsHost: "127.0.0.1"`
4. If `wsHost` is `0.0.0.0`, this is a bug - file an issue

**Verify plugin settings in RemNote:**

- WebSocket URL: `ws://127.0.0.1:3002`
- Auto-reconnect: Enabled

### Tunnel URL Changes Every Restart

**Expected behavior** on free tier. Solutions:

1. Use environment variable or script to update configuration automatically
2. Upgrade to ngrok paid plan for static domains
3. Use ngrok labeled tunnels feature (requires configuration file)

### Rate Limiting

ngrok free tier has request rate limits. If you hit limits:

- Reduce polling frequency in your application
- Upgrade to ngrok paid plan
- Use request batching where possible

### HTTPS Required

**Symptom:** Claude Cowork rejects HTTP URLs

**Solution:** ngrok provides HTTPS by default. Use the `https://` URL from ngrok output, not `http://`.

## Security Best Practices

### For Testing

1. **Use temporary URLs** - ngrok free tier provides this automatically
2. **Monitor access** - Check ngrok dashboard at `http://127.0.0.1:4040`
3. **Limit exposure time** - Stop tunnel when not in use
4. **Don't share URLs publicly** - Keep URLs private

### For Production

**Don't use ngrok for production!** Instead:

- Implement OAuth 2.1 authentication (planned - see [CHANGELOG.md](../../CHANGELOG.md))
- Use proper authentication and authorization
- Deploy on secure infrastructure
- Use rate limiting and monitoring

See [Production Deployment Guide](../production-deployment.md) (coming soon) for details.

## Related Documentation

- [Configuration Guide](configuration.md) - Configure MCP clients
- [CLI Options Reference](cli-options.md) - Server configuration options
- [Troubleshooting](troubleshooting.md) - Common issues
- [Demo](../demo.md) - See remote access in action (Claude Cowork)

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report bugs or ask questions
