# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## CRITICAL: Companion Project Context

When additional context is needed, agents SHOULD inspect companion projects from this repo root (`$(pwd)`), where
companions are sibling directories at `$(pwd)/../...`.

- `$(pwd)/../remnote-mcp-bridge` - RemNote plugin bridge layer; authoritative for WebSocket action names/payload
  contracts and bridge-side behavior.
- `$(pwd)/../remnote-cli` - CLI companion app using the same bridge; useful for daemon-based workflows and
  contract-consistency checks.

Agents should check companion repos every time it is useful for protocol, architecture, or integration context.

Terminology aliases used across docs and discussions:

- `remnote-mcp-server` = "MCP server" (this repository)
- `remnote-mcp-bridge` = "MCP bridge" or "bridge plugin" (same project)
- `remnote-cli` = "CLI companion app" (same project)

## Project Overview

This is an MCP (Model Context Protocol) server that bridges AI agents to RemNote via a WebSocket connection. The server
acts as middleware between the agent's HTTP MCP transport and a RemNote browser plugin.

**Architecture:**

```text
AI agents (HTTP) ↔ MCP HTTP Server :3001 ↔ WebSocket Server :3002 ↔ RemNote Plugin ↔ RemNote
```

## Core Architecture

### Three-Layer Bridge System

1. **MCP Server Layer** (`src/index.ts`, `src/http-server.ts`)
   - Uses `@modelcontextprotocol/sdk` for MCP protocol implementation
   - Communicates with AI agents (e.g., Claude Code) via Streamable HTTP transport (SSE)
   - HTTP server listens on configurable port (default 3001)
   - Supports multiple concurrent MCP sessions from different AI agents
   - Each session gets independent MCP Server instance with shared WebSocket bridge
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

## MANDATORY: Code Change Requirements

**ALL code changes MUST follow these requirements (non-negotiable):**

1. **Tests** - Update/add tests for all code changes (no exceptions)
2. **Documentation** - Update docstrings and docs where applicable
3. **Code Quality** - Run linting and formatting checks
4. **Test Execution** - Run test suite to verify changes
5. **Full Code Quality Execution** - Run all code quality checks by executing `./code-quality.sh`
6. **CHANGELOG.md** - Document all functional changes

See **.agents/dev-requirements.md** for detailed guidelines on:

- Planning requirements (what to include in every plan)
- Execution requirements (tests, docs, code quality, verification)

**If you skip any of these steps, the task is INCOMPLETE.**

## MANDATORY: Documentation Change Requirements

**Before making ANY documentation change, you MUST read .agents/dev-documentation.md** for documentation standards and
guidelines.

**ALL documentation changes MUST be documented in CHANGELOG.md** - this includes updates to:

- Documentation files in `docs/` and `.agents/`
- README.md and other markdown files
- Docstrings and code comments (when updated without functional changes)

**No exceptions** - if you update documentation, you update CHANGELOG.md.

## CRITICAL: ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in .agents/PLANS.md) from design
to implementation.

## CRITICAL: Git Commit Policy

**DO NOT create git commits unless explicitly requested by the user.**

- You may use `git add`, `git rm`, `git mv`, and other git commands
- You may stage changes and prepare them for commit
- **DO NOT** run `git commit` - the user handles commits manually
- When changes are ready, inform the user: "Changes are staged and ready for you to commit"

**Exceptions - commits ARE allowed ONLY when:**

1. User explicitly requests: "create a commit" or "commit these changes"
2. Using `/create-commit` slash command
3. Using `/create-release` slash command

**IMPORTANT:** Even when exceptions apply:

- Commit messages must NOT include co-authorship attribution
- No "Co-Authored-By: <agent name>" or similar text
- These are the user's commits, not the agent's

See **.agents/dev-workflow.md** for complete Git Commit Policy details.

## Development Environment

**node-check.sh Script:**

For development, use `node-check.sh` to activate nvm and ensure the correct Node.js environment:

```bash
# Activate environment and run commands
source ./node-check.sh && npm install
source ./node-check.sh && npm test
source ./node-check.sh && npm run dev
```

This script ensures the correct Node.js version is available via nvm.

## Development Commands

**IMPORTANT:** The server must be started independently as a long-running process. It does not auto-start with Claude
Code.

```bash
# Development with hot reload
npm run dev

# Type checking only
npm run typecheck

# Production build (compiles to dist/)
npm run build

# Run compiled binary (production)
npm start
```

Expected output when starting:
```
[WebSocket Server] Listening on port 3002
[HTTP Server] Listening on port 3001
```

**Note on Logging:**

- Development environment (with `npm install`): Pretty-formatted colored logs
- Global installation (via `npm link`): JSON logs to stderr (pino-pretty not included)
- Both modes are fully functional - formatting is the only difference

## Testing and Verification

**Automated test suite with 95+ tests.**

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Code Quality Checks

```bash
# Run all quality checks (type check, lint, format, test, coverage)
./code-quality.sh

# Individual checks
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run lint:fix     # Auto-fix lint issues
npm run format       # Auto-format code
npm run format:check # Check formatting
```

### Coverage Requirements

- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

View detailed coverage: `open coverage/index.html`

### Manual Testing Prerequisites

- RemNote app running with RemNote Automation Bridge plugin installed and connected
- Server configured in `~/.claude.json` under project's `mcpServers` key

## Configuration

**Environment Variables:**

- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)
- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)

**Installation:**
```bash
npm install
npm run build

# CRITICAL: makes remnote-mcp-server command globally available
npm link
```

**Starting the Server:**

The server must be started independently before using with Claude Code:

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
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
          "type": "http",
          "url": "http://127.0.0.1:3001/mcp"
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

1. **Single WebSocket client** - Only one RemNote plugin connection allowed
2. **5-second request timeout** - Prevents indefinite pending promises
3. **UUID-based request tracking** - Allows multiple in-flight requests
4. **TypeScript strict mode** - All code must pass strict type checking
5. **Zod runtime validation** - Input schemas validated at runtime
6. **Independent server process** - Must be started separately from Claude Code

## Code Patterns

**Logging:** All logging goes to stderr:
```typescript
console.error('[INFO] Message');
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

## Project Structure

```text
src/
├── index.ts                    # Main entry point, server startup
├── http-server.ts              # HTTP MCP server with session management
├── websocket-server.ts         # WebSocket bridge implementation
├── tools/
│   └── index.ts               # Tool registration and handlers
├── types/
│   └── bridge.ts              # TypeScript interfaces for messages
└── schemas/
    └── remnote-schemas.ts     # Zod validation schemas

dist/                           # Compiled output (gitignored)
test/unit/                      # Test suite (105+ tests)
.agents/                        # Development guidelines
docs/                           # Architecture documentation
```

For architectural design rationale (performance considerations, security model, error handling strategy), see
[docs/architecture.md](./docs/architecture.md).

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
