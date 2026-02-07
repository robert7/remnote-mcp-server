# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that bridges AI agents to RemNote via a WebSocket connection. The server
acts as middleware between the agent's stdio MCP transport and a RemNote browser plugin.

**Architecture:**

```text
AI agent (stdio) ↔ MCP Server ↔ WebSocket Server :3002 ↔ RemNote Plugin ↔ RemNote
```

## Core Architecture

### Three-Layer Bridge System

1. **MCP Server Layer** (`src/index.ts`)
   - Uses `@modelcontextprotocol/sdk` for MCP protocol implementation
   - Communicates with AI agent (e.g., Claude Code) via stdio transport (stdin/stdout)
   - **CRITICAL**: stdout is RESERVED for MCP protocol messages only
   - All logging MUST go to stderr
   - Spawns WebSocket server on configurable port (default 3002)
   - Handles graceful shutdown on SIGINT/SIGTERM
2. **WebSocket Bridge Layer** (`src/websocket-server.ts`)
   - Single-client connection model (rejects multiple connections with code 1008)
   - Request/response correlation via UUID tracking
   - 5-second timeout for pending requests
   - Heartbeat support (ping/pong messages)
   - Cleans up pending requests on disconnect
   - Message protocol defined in `src/types/bridge.ts`:
     - Requests: `{ id: string, action: string, payload: Record<string, unknown> }`
     - Responses: `{ id: string, result?: unknown, error?: string }`
     - Heartbeats: `{ type: 'ping' | 'pong' }`
3. **Tool Registration Layer** (`src/tools/index.ts`)
   - Defines 6 MCP tools exposed to AI agents
   - Validates inputs via Zod schemas (`src/schemas/remnote-schemas.ts`)
   - Single unified handler dispatches by tool name
   - Returns results as formatted JSON text

### Available MCP Tools

- `remnote_create_note` - Create notes with optional parent and tags
- `remnote_search` - Search knowledge base (configurable limit, optional content)
- `remnote_read_note` - Read note by ID (configurable depth)
- `remnote_update_note` - Update title, append content, modify tags
- `remnote_append_journal` - Append to today's daily document
- `remnote_status` - Check connection status and statistics

## Development Commands

```bash
# Development with hot reload
npm run dev

# Type checking only
npm run typecheck

# Production build (compiles to dist/)
npm run build

# Run compiled binary
npm start
```

## Testing and Verification

**No automated test suite.** Manual testing workflow:

```bash
# 1. Start the server
npm start  # or npm run dev for hot reload

# 2. Verify process is running
ps aux | grep remnote-mcp-server

# 3. Verify WebSocket port is listening
lsof -i :3002

# 4. Test in Claude Code
# In chat: "Use remnote_status to check connection"
```

**Prerequisites:**

- RemNote app running with MCP Bridge plugin installed and connected
- Server configured in `~/.claude.json` under project's `mcpServers` key

## Configuration

**Environment Variables:**

- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

**Installation:**
```bash
npm install
npm run build

# CRITICAL: makes remnote-mcp-server command globally available
npm link
```

**Claude Code Configuration:**

MCP servers are configured in `~/.claude.json` under the `mcpServers` key. Configuration can be:

1. **Global (for all projects):** Place under a home directory project entry
2. **Project-specific:** Place under the specific project path

**Configuration format:**
```json
{
  "projects": {
    "/Users/username/path/to/project": {
      "mcpServers": {
        "remnote": {
          "type": "stdio",
          "command": "remnote-mcp-server",
          "args": [],
          "env": {
            "REMNOTE_WS_PORT": "3002"
          }
        }
      }
    }
  }
}
```

**Important:** The old separate `~/.claude/.mcp.json` file format is deprecated. Claude Code now uses a single
`~/.claude.json` file with `mcpServers` configuration per project. The `enabledMcpjsonServers` setting
in `~/.claude/settings.json` is also deprecated.

## Key Technical Constraints

1. **stdout reserved for MCP protocol** - All logging to stderr only
2. **Single WebSocket client** - Only one RemNote plugin connection allowed
3. **5-second request timeout** - Prevents indefinite pending promises
4. **UUID-based request tracking** - Allows multiple in-flight requests
5. **TypeScript strict mode** - All code must pass strict type checking
6. **Zod runtime validation** - Input schemas validated at runtime

## Code Patterns

**Logging:**
```typescript
// CORRECT - logs to stderr
console.error('[INFO] Message');

// WRONG - breaks MCP protocol
console.log('Message');
```

**Zod Schemas:**

- Schema definitions in `src/schemas/remnote-schemas.ts`
- Runtime validation + TypeScript type inference from single source
- Example: `RemNoteSearchParamsSchema.parse(params)`

**Request/Response Flow:**
```typescript
// Tools layer validates input
const params = RemNoteSearchParamsSchema.parse(input);

// Dispatches to WebSocket bridge
const result = await websocketServer.sendRequest('search', params);

// Returns formatted response
return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
```

## Development Workflow

### Git Commit Policy

**DO NOT create git commits unless:**

1. User explicitly requests commit creation
2. Using `/create-commit` command
3. Using `/create-release` command

**For all other changes:**

- Use `git add`, `git mv`, `git rm` as needed
- Stage files but DO NOT commit
- Inform user when changes are ready for review

### Changelog Maintenance

**MANDATORY: All functional changes MUST be documented in CHANGELOG.md.**

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

**Categories:**

- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Features marked for removal
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security fixes

**Example:**

```markdown
## [Unreleased]

### Added
- WebSocket reconnection handling for dropped connections

### Fixed
- Request timeout now properly cleans up pending promises
```

**Creating releases:** Use `/create-release` command

### Code Changes Requirements

**When planning code changes, MUST include:**

1. Test updates (which tests to modify/add)
2. Documentation updates (docstrings, README, etc.)
3. Verification steps (type checks, manual testing)

**When executing code changes, MUST:**

1. Update tests (if test infrastructure exists)
2. Update documentation (inline comments, docstrings, README)
3. Run `npm run typecheck`
4. Test manually with verification steps above

### Documentation Guidelines

**IMPORTANT**: Before updating any documentation, read `.agents/dev-documentation.md` first.

This file contains critical principles for writing maintainable documentation, including:

- Non-Redundancy Principle (avoid documenting what's obvious from code)
- What belongs in code-level vs developer vs user documentation
- Focus on WHY (design rationale) over WHAT/HOW (implementation details)

## Project Structure

```
src/
├── index.ts                    # Main entry point, MCP server setup
├── websocket-server.ts         # WebSocket bridge implementation
├── tools/
│   └── index.ts               # Tool registration and handlers
├── types/
│   └── bridge.ts              # TypeScript interfaces for messages
└── schemas/
    └── remnote-schemas.ts     # Zod validation schemas

dist/                           # Compiled output (gitignored)
.agents/                        # Development guidelines
```

## Dependencies

## Common Issues

**Port already in use:**
```bash
# Find process using port 3002
lsof -i :3002
# Kill if needed
kill -9 <PID>
```

**RemNote plugin not connecting:**

- Verify RemNote app is running
- Check plugin is installed and enabled
- Verify WebSocket URL in plugin matches server port
- Check server logs (stderr) for connection messages

**Configuration not working:**

- Ensure configuration is in `~/.claude.json` under `mcpServers` key (NOT separate `~/.claude/.mcp.json`)
- Restart Claude Code after configuration changes
- Check logs: `~/.claude/debug/mcp-*.log`
