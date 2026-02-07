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

### Documentation Guidelines

**IMPORTANT**: Before updating any documentation, read `.agents/dev-documentation.md` first.

This file contains critical principles for writing maintainable documentation, including:

- Non-Redundancy Principle (avoid documenting what's obvious from code)
- What belongs in code-level vs developer vs user documentation
- Focus on WHY (design rationale) over WHAT/HOW (implementation details)

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

## Project Structure

```text
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
