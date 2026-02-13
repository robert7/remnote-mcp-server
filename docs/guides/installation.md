# Installation Guide

Complete installation instructions for the RemNote MCP Server.

## Prerequisites

- **Node.js** >= 18.0.0
- **RemNote app** (desktop or web browser)
- **RemNote MCP Bridge plugin** - Install from [GitHub](https://github.com/robert7/remnote-mcp-bridge)
- **An MCP client** - Examples:
  - [Claude Code CLI](https://claude.com/claude-code)
  - [Accomplish](https://github.com/accomplish-ai/accomplish) (formerly Openwork)
  - [Claude Cowork](https://claude.com/claude-cowork) (requires [remote access setup](remote-access.md))

## Installation from npm

**Recommended for most users.**

### Install Globally

```bash
npm install -g remnote-mcp-server
```

### Verify Installation

```bash
which remnote-mcp-server
# Should output: /path/to/node/bin/remnote-mcp-server

remnote-mcp-server --version
# Should output: 0.x.x
```

### Uninstalling

```bash
npm uninstall -g remnote-mcp-server
```

## Installation from Source

**For contributors and developers.** See [Development Setup Guide](development-setup.md) for detailed instructions.

**Quick start:**

```bash
git clone https://github.com/robert7/remnote-mcp-server.git
cd remnote-mcp-server
npm install
npm run build
npm link  # Make command globally available
```

## RemNote MCP Bridge Plugin Setup

The server requires the RemNote MCP Bridge plugin to communicate with RemNote.

### Installation

1. Open your RemNote app
2. Follow plugin installation instructions from the [RemNote MCP Bridge repository](https://github.com/robert7/remnote-mcp-bridge)

### Plugin Configuration

Once installed, configure the plugin:

1. Open the plugin control panel in RemNote
2. Verify the WebSocket URL: `ws://127.0.0.1:3002` (default)
3. Enable **Auto-reconnect** (recommended)

## Starting the Server

### Basic Usage

```bash
remnote-mcp-server
```

Expected output:
```
RemNote MCP Server v0.2.1 listening { wsPort: 3002, httpPort: 3001 }
```

### With Custom Ports

```bash
remnote-mcp-server --ws-port 4002 --http-port 4001
```

### With Verbose Logging

```bash
remnote-mcp-server --verbose
```

### With File Logging

```bash
remnote-mcp-server --log-file /tmp/remnote-mcp.log --log-level-file debug
```

**Important:** The server must remain running for AI agents to connect. Keep the terminal open.

For more CLI options, see [CLI Options Reference](cli-options.md).

## Verification

### 1. Check Server is Running

Verify both ports are listening:

```bash
# Check HTTP port (MCP)
lsof -i :3001

# Check WebSocket port (RemNote bridge)
lsof -i :3002
```

You should see the `node` process listening on both ports.

### 2. Check RemNote Plugin Connection

Open RemNote with the MCP Bridge plugin installed. The plugin control panel should show:

- **Status:** "Connected" (green indicator)
- **Server:** ws://127.0.0.1:3002
- Connection timestamp
- Statistics (requests sent/received)

### 3. Test MCP Connection

Once you've configured an MCP client (see [Configuration Guide](configuration.md)), test the connection:

**In Claude Code:**
```
Use remnote_status to check the connection
```

Expected response:
```json
⏺ remnote - remnote_status (MCP)
  ⎿ {
       "connected": true,
       "pluginVersion": "0.3.2"
     }
```

### 4. Test RemNote Integration

Try creating a test note:

```
Create a RemNote note titled "MCP Test" with content "Testing the bridge"
```

This should use the `remnote_create_note` tool and create a new note in your RemNote knowledge base. Verify it appears in RemNote.

## Common Installation Issues

### Node.js Version Too Old

**Symptom:** Installation fails with compatibility errors

**Solution:**
```bash
node --version
# Ensure >= 18.0.0

# Update Node.js using nvm:
nvm install 18
nvm use 18
```

### Permission Errors (npm install -g)

**Symptom:** `EACCES` errors during global installation

**Solution:**
```bash
# Option 1: Use nvm (recommended)
# See https://github.com/nvm-sh/nvm

# Option 2: Fix npm permissions
# See https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

# Option 3: Use sudo (not recommended)
sudo npm install -g remnote-mcp-server
```

### Server Command Not Found

**Symptom:** `remnote-mcp-server: command not found`

**Solution:**
```bash
# Verify global npm bin directory is in PATH
npm config get prefix
# Should be in your PATH (check with: echo $PATH)

# If not in PATH, add to ~/.bashrc or ~/.zshrc:
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Port Already in Use

**Symptom:** `EADDRINUSE` error when starting server

**Solution:** See [Troubleshooting Guide](troubleshooting.md#port-already-in-use)

### Plugin Won't Connect

**Symptom:** Server starts but plugin shows "Disconnected"

**Solution:** See [Troubleshooting Guide](troubleshooting.md#plugin-wont-connect)

## Next Steps

- [Configure your AI client](configuration.md) - Set up Claude Code, Accomplish, or Claude Cowork
- [Learn the MCP tools](tools-reference.md) - Explore available RemNote operations
- [View demos](../demo.md) - See the server in action with different clients

## Need Help?

- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report bugs or ask questions
