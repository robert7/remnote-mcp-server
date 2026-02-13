# Claude Cowork Configuration

How to configure [Claude Cowork](https://claude.com/claude-cowork) (cloud-based) to connect to the RemNote MCP Server.

## Overview

Claude Cowork is a cloud-based AI workspace that runs in the browser. Since the RemNote MCP Server runs locally on your machine, you need to expose it to the internet for Claude Cowork to connect.

**Prerequisites:**

- RemNote MCP Server installed and running locally
- RemNote app running with MCP Bridge plugin installed and connected
- Remote access tool (ngrok, CloudFlare Tunnel, etc.)

## Architecture

When using Claude Cowork, the architecture becomes:

```
Claude Cowork (Cloud) ↔ Tunnel (HTTPS) ↔ HTTP MCP Server :3001 (127.0.0.1)
                                          ↕
                                          WebSocket Server :3002 (127.0.0.1)
                                          ↕
                                          RemNote Plugin (Local)
```

**Critical Security:** The WebSocket server ALWAYS binds to localhost (127.0.0.1) and cannot be overridden. Only the HTTP MCP endpoint is exposed via tunnel.

## Quick Setup with ngrok

ngrok is the recommended solution for development and testing.

### Prerequisites

- ngrok account (free tier works for testing)
- ngrok installed ([installation instructions](https://ngrok.com/download))

### Step 1: Start the Server

Start the server normally (default localhost binding):

```bash
remnote-mcp-server
```

Expected output:
```
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

**Note:** ngrok tunnels to localhost, so the default 127.0.0.1 binding works perfectly. No special host configuration is needed.

### Step 2: Start ngrok Tunnel

In a separate terminal, start ngrok:

```bash
ngrok http 3001
```

ngrok will output:
```
Session Status                online
Account                       your-account (Plan: Free)
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3001
```

Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok-free.app`).

### Step 3: Configure Claude Cowork

Add the MCP server to Claude Cowork configuration using the ngrok URL:

**Server URL:** `https://abc123.ngrok-free.app/mcp`

**Note:** The `/mcp` path is required - it's the endpoint path for the MCP protocol.

### Step 4: Test the Connection

In Claude Cowork, try:

```
Use remnote_status to check the connection
```

You should see connection details and plugin information.

## Testing

To test the exposed endpoint, use the curl command from the [Troubleshooting Guide](troubleshooting.md#testing-the-mcp-http-endpoint), replacing `http://localhost:3001` with your ngrok HTTPS URL (e.g., `https://abc123.ngrok-free.app`).

**Expected response:** JSON with server capabilities and `mcp-session-id` header.

**Important:** Don't forget the required `Accept` header - see the troubleshooting guide for the complete example.

## ngrok Limitations

### Free Tier

- URL changes on every restart (random subdomain like `abc123.ngrok-free.app`)
- Session timeout after 2 hours of inactivity
- "ngrok Browser Warning" screen for first-time visitors

### Solutions

**For persistent URLs:** Upgrade to ngrok paid plan for:

- Static domains (e.g., `remnote-mcp.ngrok.app`)
- Longer session durations
- No browser warning screen

**For development:**

- Use the free tier and reconfigure Claude Cowork when the URL changes
- Monitor ngrok web interface: `http://127.0.0.1:4040`

## Security Considerations

**⚠️ Warning:** The methods described here provide **no authentication** and expose your RemNote access to anyone with the URL.

### For Testing Only

Use remote access only for:

- Local development and testing
- Short-term demonstrations
- Integration testing with Claude Cowork

### Security Risks

- **No authentication** - Anyone with the URL can access your RemNote
- **HTTP only from your server** - HTTPS termination happens at ngrok
- **Logs visible in ngrok dashboard** - All requests are logged

### Mitigation

1. Use temporary URLs (ngrok free tier provides this automatically)
2. Rotate URLs frequently
3. Monitor ngrok web interface: `http://127.0.0.1:4040`
4. Stop the tunnel when not in use
5. Don't share URLs publicly

### For Production

**Don't use ngrok for production!** Instead:

- Implement OAuth 2.1 authentication (planned - see [CHANGELOG.md](../../CHANGELOG.md) Stage 2)
- Use proper authentication and authorization
- Deploy on secure infrastructure
- Use rate limiting and monitoring

See [Production Deployment Guide](../production-deployment.md) (coming soon) for details.

## Alternative Solutions

### CloudFlare Tunnel

Free alternative with authentication options.

**Installation:** See [CloudFlare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps)

**Pros:**

- Free
- Optional authentication via CloudFlare Access
- Good performance

**Cons:**

- More complex setup
- Requires CloudFlare account

### Tailscale

Secure mesh VPN for accessing local services remotely.

**Installation:** See [tailscale.com/download](https://tailscale.com/download)

**Pros:**

- Secure (WireGuard VPN)
- No public exposure
- Works across networks

**Cons:**

- Requires Tailscale on both ends (not suitable for Claude Cowork)
- More complex setup

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

**Symptom:** Claude Cowork fails with "connection refused"

**Solutions:**

1. Verify server is running: `lsof -i :3001`
2. Verify tunnel is forwarding to port 3001: Check ngrok web interface at `http://127.0.0.1:4040`
3. Test locally first (see [Troubleshooting: Testing the MCP HTTP Endpoint](troubleshooting.md#testing-the-mcp-http-endpoint))

### RemNote Plugin Not Connecting

**Symptom:** Server starts but RemNote plugin won't connect

**Solutions:**

1. WebSocket MUST be on localhost only
2. Plugin connects to `ws://127.0.0.1:3002` (NOT via tunnel)
3. Verify server logs show `wsHost: "127.0.0.1"`
4. Check plugin settings in RemNote: WebSocket URL should be `ws://127.0.0.1:3002`

### Tunnel URL Changes Every Restart

**Expected behavior** on free tier.

**Solutions:**

1. Upgrade to ngrok paid plan for static domains
2. Use environment variable or script to update configuration automatically
3. Use ngrok labeled tunnels feature (requires configuration file)

### HTTPS Required

**Symptom:** Claude Cowork rejects HTTP URLs

**Solution:** ngrok provides HTTPS by default. Use the `https://` URL from ngrok output, not `http://`.

## Example Usage

Once configured, Claude Cowork can use RemNote tools:

**Search:**
```
Search my RemNote for notes about "blue light & sleep"
```

**Create notes:**
```
Create a RemNote note with key findings from this conversation
```

**Update notes:**
```
Add today's discussion to my RemNote journal
```

See the [Tools Reference](tools-reference.md) for detailed documentation of all available tools.

## Next Steps

- [Remote Access Setup Guide](remote-access.md) - Detailed ngrok and tunneling documentation
- [Tools Reference](tools-reference.md) - Available MCP tools and usage
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

## Need Help?

- [Remote Access Guide](remote-access.md) - Comprehensive remote access documentation
- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report problems or ask questions
