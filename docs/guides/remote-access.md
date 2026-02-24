# Remote Access Setup

How to expose your local RemNote MCP Server to cloud-based services like Claude Cowork and ChatGPT Apps.

## Overview

By default, the RemNote MCP Server binds to localhost (127.0.0.1) and is only accessible from your local machine.
To enable cloud-based AI services to access your RemNote knowledge base, you need to expose the HTTP MCP endpoint
remotely.

**Security Warning:** The methods described here provide **no authentication** by default and expose your RemNote access
to anyone with the URL. Of course, **you can configure authentication** and access controls with tools like ngrok,
Cloudflare or Tailscale.

Unless you configure authentication, use remote access only for:

- Local development and testing
- Short-term demonstrations
- Integration testing with cloud-based agents (for example Claude Cowork or ChatGPT Apps)

## Architecture

When using remote access, the architecture becomes:

```
Cloud Agent (Claude Cowork or ChatGPT) ↔ Tunnel (HTTPS) ↔ HTTP MCP Server :3001 (127.0.0.1)
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
- RemNote app running with RemNote Automation Bridge plugin installed
- ngrok account (free tier works for testing)

### Installation

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Linux:** [ngrok on Linux](https://ngrok.com/docs/guides/device-gateway/linux)

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
Session Status online Account your-account (Plan: Free) Version 3.x.x Region United States (us) Latency - Web Interface
http://127.0.0.1:4040 Forwarding https://abc123.ngrok-free.app -> http://localhost:3001
```

Copy the HTTPS forwarding URL (for example, `https://abc123.ngrok-free.app`).

**Step 3: Configure your cloud client**

Set the MCP server URL to:

```text
https://abc123.ngrok-free.app/mcp
```

**Note:** The `/mcp` path is required.

### Testing

To test the exposed endpoint, use the curl command from the [Troubleshooting
Guide](troubleshooting.md#testing-the-mcp-http-endpoint), replacing `http://localhost:3001` with your ngrok HTTPS URL
(for example, `https://abc123.ngrok-free.app`).

Expected response: JSON with server capabilities and an `mcp-session-id` header.

Important: include the required `Accept: application/json, text/event-stream` header.

### ngrok Limitations

**Free Tier:**

- URL changes on every restart (random subdomain like `abc123.ngrok-free.app`)
- Session timeout after 2 hours of inactivity
- "ngrok Browser Warning" screen for first-time visitors

**Solution:** Upgrade to ngrok paid plan for:

- Static domains (for example, `remnote-mcp.ngrok.app`)
- Longer session durations
- No browser warning screen

**Security and privacy considerations:**

- No authentication by default: anyone with the URL can access your RemNote endpoint
- HTTPS terminates at ngrok
- Requests are visible in the ngrok dashboard

**Mitigation options:**

1. Use temporary URLs and rotate frequently
2. Monitor ngrok dashboard at `http://127.0.0.1:4040`
3. Stop the tunnel when not in use
4. Do not share URLs publicly
5. Optionally add ngrok traffic policy authentication
6. For OAuth-based gating, review ngrok OAuth traffic policy actions: [Traffic policy
   overview](https://ngrok.com/docs/traffic-policy/index#traffic-policy-overview), [OAuth
   action](https://ngrok.com/docs/traffic-policy/actions/oauth)

## Alternative Solutions

### Cloudflare Tunnel

Cloudflare Tunnel is a free alternative with optional identity and access controls.

- Docs: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- Signup: [try.cloudflare.com](https://try.cloudflare.com/)
- Optional: configure [Access
  policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/) for
  authentication and access control

### Tailscale

Tailscale Funnel can expose local services through your tailnet.

- Docs: [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel)
- Pricing: [Tailscale Personal](https://tailscale.com/pricing?plan=personal)
- Authentication using OAuth see [OAuth in the Tailscale API](https://tailscale.com/blog/oauth)

## When Do I Need 0.0.0.0?

You do **NOT** need to bind to 0.0.0.0 for ngrok or tunnel usage. These tools tunnel to localhost.

Bind to 0.0.0.0 only when:

- Deploying on a VPS/cloud server and accessing from outside that machine
- Running in Docker containers (container networking requires it)
- Accessing the server from other devices on your local network
- Using a reverse proxy that requires network-wide binding

For ngrok specifically, the server stays on 127.0.0.1 and ngrok tunnels to localhost:3001.

Example:
```bash
remnote-mcp-server --http-host 0.0.0.0
```

Security warning: this exposes the server to any device on your network.

## Troubleshooting

### Connection Refused

**Symptom:** `curl` or your cloud client fails with "connection refused"

1. Verify server is running: `lsof -i :3001`
2. Verify tunnel forwarding to port 3001 (for ngrok, check `http://127.0.0.1:4040`)
3. Test local endpoint first (see [Troubleshooting: Testing the MCP HTTP
   Endpoint](troubleshooting.md#testing-the-mcp-http-endpoint))

### RemNote Plugin Not Connecting

**Symptom:** Server starts but RemNote plugin won't connect

1. WebSocket must stay on localhost
2. Plugin must connect to `ws://127.0.0.1:3002` (never through tunnel)
3. Verify server logs show `wsHost: "127.0.0.1"`
4. Verify plugin WebSocket URL and auto-reconnect setting

### Tunnel URL Changes Every Restart

Expected on free tier. Options:

1. Use scripts/env vars to update client config
2. Upgrade to ngrok paid plan for static domains
3. Use labeled tunnels with ngrok config

### HTTPS Required

**Symptom:** Cloud client rejects HTTP URLs

Use the `https://` tunnel URL, not `http://`.

### Rate Limiting

If ngrok free-tier limits are hit:

- Reduce polling frequency
- Upgrade ngrok plan
- Batch requests where possible

## Security Best Practices

1. Use temporary URLs
2. Monitor tunnel access logs
3. Keep exposure windows short
4. Keep URLs private

## Related Documentation

- [Configuration Guide](configuration.md) - Configure MCP clients
- [Claude Cowork Configuration](configuration-claude-cowork.md) - Cowork-specific setup steps
- [ChatGPT Configuration](configuration-chatgpt.md) - ChatGPT Apps setup steps
- [CLI Options Reference](cli-options.md) - Server configuration options
- [Troubleshooting](troubleshooting.md) - Common issues
- [Demo](../demo.md) - See remote access in action

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report bugs or ask questions
