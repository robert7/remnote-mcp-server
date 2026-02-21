# CLI Options Reference

Complete reference for command-line options when starting the RemNote MCP Server.

## Basic Usage

```bash
remnote-mcp-server [options]
```

## Server Configuration Options

### --http-port

Specify the HTTP MCP server port.

**Default:** 3001 **Environment variable:** `REMNOTE_HTTP_PORT`

```bash
remnote-mcp-server --http-port 3003
```

**Use when:**

- Port 3001 is already in use
- Running multiple server instances
- Testing port configurations

### --http-host

Specify the HTTP server bind address.

**Default:** 127.0.0.1 (localhost only) **Environment variable:** `REMNOTE_HTTP_HOST`

```bash
remnote-mcp-server --http-host 0.0.0.0
```

**Use when:**

- Deploying on a VPS/cloud server
- Accessing from other devices on your local network
- Running in Docker containers

**Security note:** Binding to 0.0.0.0 exposes the server to your network. For remote access, use [ngrok or other secure
tunneling](remote-access.md) instead.

### --ws-port

Specify the WebSocket server port (RemNote plugin connection).

**Default:** 3002 **Environment variable:** `REMNOTE_WS_PORT`

```bash
remnote-mcp-server --ws-port 3004
```

**Important:** If you change the WebSocket port, you must also update the WebSocket URL in the RemNote Automation Bridge plugin
settings.

**Use when:**

- Port 3002 is already in use
- Running multiple server instances

## Logging Options

### --log-level

Set the console log level.

**Valid values:** `debug`, `info`, `warn`, `error` **Default:** `info`

```bash
remnote-mcp-server --log-level debug
```

**Log levels:**

- `debug` - Verbose debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages only

### --log-level-file

Set the file log level (when using --log-file).

**Valid values:** `debug`, `info`, `warn`, `error` **Default:** Same as `--log-level`

```bash
remnote-mcp-server --log-file /tmp/remnote.log --log-level-file debug
```

**Use when:**

- You want different verbosity for console vs file
- Debugging production issues (verbose file logs, quiet console)

### --verbose

Shorthand for `--log-level debug`.

```bash
remnote-mcp-server --verbose
```

Equivalent to:
```bash
remnote-mcp-server --log-level debug
```

### --log-file

Log output to a file in addition to stderr.

**Default:** None (console only)

```bash
remnote-mcp-server --log-file /tmp/remnote-mcp.log
```

**Use when:**

- Troubleshooting issues
- Running as a background service
- Auditing server activity

**Example with custom log level:**
```bash
remnote-mcp-server --log-file /tmp/remnote-mcp.log --log-level-file debug
```

### --request-log

Log all WebSocket requests to a file (JSON Lines format).

**Default:** None

```bash
remnote-mcp-server --request-log /tmp/requests.jsonl
```

**Use when:**

- Debugging WebSocket communication
- Analyzing request patterns
- Troubleshooting RemNote plugin integration

**View logs:**
```bash
tail -f /tmp/requests.jsonl | jq
```

### --response-log

Log all WebSocket responses to a file (JSON Lines format).

**Default:** None

```bash
remnote-mcp-server --response-log /tmp/responses.jsonl
```

**Use when:**

- Debugging WebSocket communication
- Analyzing response data
- Troubleshooting RemNote plugin integration

**View logs:**
```bash
tail -f /tmp/responses.jsonl | jq
```

## Information Options

### -h, --help

Display help message with all available options.

```bash
remnote-mcp-server --help
```

### -v, --version

Display the server version number.

```bash
remnote-mcp-server --version
```

Output:
```
0.2.1
```

## Environment Variables

All server configuration options can be set via environment variables as an alternative to CLI flags.

| Environment Variable | CLI Flag | Default |
|---------------------|----------|---------|
| `REMNOTE_HTTP_PORT` | `--http-port` | 3001 |
| `REMNOTE_HTTP_HOST` | `--http-host` | 127.0.0.1 |
| `REMNOTE_WS_PORT` | `--ws-port` | 3002 |

**Precedence (highest to lowest):**

1. CLI flags
2. Environment variables
3. Default values

**Example using environment variables:**

```bash
export REMNOTE_HTTP_PORT=3003
export REMNOTE_WS_PORT=3004
remnote-mcp-server
```

**Example with CLI flag override:**

```bash
export REMNOTE_HTTP_PORT=3003
remnote-mcp-server --http-port 3005
# Uses port 3005 (CLI flag wins)
```

## Common Usage Patterns

### Default (Quick Start)

```bash
remnote-mcp-server
```

- HTTP port: 3001
- WebSocket port: 3002
- Log level: info
- Output: stderr only

### Development/Debugging

```bash
remnote-mcp-server --verbose --log-file /tmp/remnote-debug.log
```

- Verbose console output
- File logging for later analysis
- Useful for troubleshooting

### Custom Ports

```bash
remnote-mcp-server --http-port 3003 --ws-port 3004
```

- Avoids port conflicts
- Allows multiple server instances

**Remember:** Update MCP client and RemNote plugin configuration to match!

### Production/Background Service

```bash
remnote-mcp-server --log-file /var/log/remnote-mcp.log --log-level warn
```

- Quiet console (warnings and errors only)
- File logging for monitoring
- Suitable for systemd services or background processes

### Full Debugging (WebSocket Communication)

```bash
remnote-mcp-server --verbose \
  --log-file /tmp/remnote-mcp.log \
  --request-log /tmp/requests.jsonl \
  --response-log /tmp/responses.jsonl
```

- Full verbosity
- General log file
- Separate request/response logs
- Maximum visibility for debugging

**View real-time logs:**
```bash
# Terminal 1: General logs
tail -f /tmp/remnote-mcp.log

# Terminal 2: Requests
tail -f /tmp/requests.jsonl | jq

# Terminal 3: Responses
tail -f /tmp/responses.jsonl | jq
```

### Network-Wide Access (Local Network)

```bash
remnote-mcp-server --http-host 0.0.0.0
```

**Security warning:** This exposes the server to any device on your network. Use only in trusted environments.

**Better alternatives for remote access:**

- [ngrok](remote-access.md) - Secure tunneling
- [Tailscale](https://tailscale.com/) - Mesh VPN
- [CloudFlare Tunnel](https://www.cloudflare.com/products/tunnel/) - Secure tunnel

## Usage with npm Scripts

When using `npm run dev` or `npm start`, pass CLI options after `--`:

```bash
# Development mode with custom options
npm run dev -- --verbose --ws-port 3004

# Production mode with custom options
npm start -- --http-port 3003 --log-file /tmp/remnote.log

# Show help
npm run dev -- --help
```

## Logging Output Formats

### Development (with npm install)

When `pino-pretty` is installed (via `npm install`):

- Pretty-formatted colored logs
- Human-readable timestamps
- Easier to read during development

Example:
```
[2024-01-15 10:30:45] INFO (http-server): HTTP server started
  port: 3001
  host: "127.0.0.1"
```

### Global Installation

When installed globally (`npm install -g remnote-mcp-server`):

- JSON logs to stderr
- pino-pretty not included (reduces package size)
- Machine-parseable for log aggregation

Example:
```json
{"level":"info","time":1705319445000,"context":"http-server","port":3001,"host":"127.0.0.1","msg":"HTTP server started"}
```

**Both modes are fully functional** - formatting is the only difference.

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**

```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
remnote-mcp-server --http-port 3003
```

### Invalid Port Number

**Error:** Port must be a number between 1 and 65535

**Solution:** Use a valid port number (1-65535). Avoid ports below 1024 (require root).

### Permission Denied

**Error:** `EACCES: permission denied`

**Solution:**

- Use ports above 1024 (don't require root)
- Or run with sudo (not recommended): `sudo remnote-mcp-server`

### Log File Not Writable

**Error:** Cannot write to log file

**Solution:**

```bash
# Ensure directory exists
mkdir -p /path/to/logs

# Ensure you have write permission
touch /path/to/logs/remnote.log

# Or use /tmp (always writable)
remnote-mcp-server --log-file /tmp/remnote-mcp.log
```

## Related Documentation

- [Configuration Guide](configuration.md) - Configuring MCP clients
- [Installation Guide](installation.md) - Installing the server
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Development Setup](development-setup.md) - Development workflow

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report bugs or ask questions
