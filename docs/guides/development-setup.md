# Development Setup Guide

Instructions for contributors who want to modify, test, or develop the RemNote MCP Server.

## Prerequisites

- **Node.js** >= 18.0.0 (preferably via nvm)
- **git** - Version control
- **RemNote app** with MCP Bridge plugin (for testing)
- **Claude Code CLI** or another MCP client (for integration testing)

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/robert7/remnote-mcp-server.git
cd remnote-mcp-server
```

### 2. Install Dependencies

```bash
npm install
```

This installs both production and development dependencies, including:

- TypeScript and type definitions
- Testing frameworks (Vitest)
- Code quality tools (ESLint, Prettier)
- Development utilities (pino-pretty for pretty logs)

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

### 4. Link for Local Testing

```bash
npm link
```

This makes the `remnote-mcp-server` command globally available, pointing to your local development build.

**Verify:**
```bash
which remnote-mcp-server
# Should point to your local project's bin file

remnote-mcp-server --version
# Should match version in package.json
```

## Development Workflow

### Running in Development Mode

**With hot reload:**
```bash
npm run dev
```

This uses `tsx watch` to automatically restart the server when you modify source files.

**Pass CLI options:**
```bash
npm run dev -- --verbose
npm run dev -- --ws-port 4002 --http-port 4001
npm run dev -- -h
```

### Using node-check.sh Script

For development, the project includes `node-check.sh` to activate nvm and ensure the correct Node.js environment:

```bash
# Activate environment and run commands
source ./node-check.sh && npm install
source ./node-check.sh && npm test
source ./node-check.sh && npm run dev
```

This script ensures the correct Node.js version is available via nvm.

### Type Checking

Check TypeScript types without building:

```bash
npm run typecheck
```

### Code Formatting

**Auto-format code:**
```bash
npm run format
```

**Check formatting without changes:**
```bash
npm run format:check
```

### Linting

**Run ESLint:**
```bash
npm run lint
```

**Auto-fix lint issues:**
```bash
npm run lint:fix
```

## Testing

### Running Tests

**Run all tests:**
```bash
npm test
```

**Watch mode (re-run on changes):**
```bash
npm run test:watch
```

**Coverage report:**
```bash
npm run test:coverage
```

**View detailed coverage:**
```bash
open coverage/index.html
```

**Interactive test UI:**
```bash
npm run test:ui
```

### Writing Tests

Tests are located in `test/unit/` and use Vitest.

**Test file structure:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Component Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Test logic
    expect(result).toBe(expected);
  });
});
```

### Manual Integration Testing

**Prerequisites:**

1. Server running (`npm run dev` or `npm start`)
2. RemNote app running with MCP Bridge plugin connected
3. MCP client configured (e.g.,  CLI)

**Test steps:**

1. Verify server ports are listening:
   ```bash
   lsof -i :3001
   lsof -i :3002
   ```

2. Check plugin connection in RemNote control panel
3. Test basic operations in your MCP client:
   - `remnote_status` - Check connection
   - `remnote_search` - Search your knowledge base
   - `remnote_create_note` - Create a test note
   - `remnote_read_note` - Read the created note
   - `remnote_update_note` - Update the test note

## Code Quality Checks

### Run All Quality Checks

The project includes a comprehensive quality check script:

```bash
./code-quality.sh
```

This runs:

1. Type checking (`npm run typecheck`)
2. Linting (`npm run lint`)
3. Format checking (`npm run format:check`)
4. Full test suite (`npm test`)
5. Coverage validation

**All checks must pass before committing code.**

### Pre-commit Checks

Before creating a commit:

1. Run `./code-quality.sh` to verify all quality checks pass
2. Update tests for any code changes
3. Update documentation (docstrings, developer docs, user docs)
4. Update CHANGELOG.md with your changes

## Project Structure

```
remnote-mcp-server/
├── src/
│   ├── index.ts                # Entry point, server startup
│   ├── http-server.ts          # HTTP MCP server
│   ├── websocket-server.ts     # WebSocket bridge
│   ├── tools/
│   │   └── index.ts           # MCP tool registration
│   ├── types/
│   │   └── bridge.ts          # TypeScript interfaces
│   └── schemas/
│       └── remnote-schemas.ts # Zod validation schemas
├── test/
│   └── unit/                  # Test suite (95+ tests)
├── dist/                      # Compiled output (gitignored)
├── docs/                      # User documentation
├── .agents/                   # Developer guidelines
├── package.json               # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Test configuration
```

## Building for Production

### Build

```bash
npm run build
```

Output: `dist/` directory (gitignored)

### Run Production Build

```bash
npm start
```

This runs the compiled JavaScript from `dist/`.

## Publishing to npm

**For maintainers only.** See [npm Publishing Guide](../npm-publishing.md).

## Environment Variables

Development supports the same environment variables as production:

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_HTTP_HOST` - HTTP server bind address (default: 127.0.0.1)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

**Example:**
```bash
export REMNOTE_HTTP_PORT=3003
export REMNOTE_WS_PORT=3004
npm run dev
```

## Logging

### Development Logging

With `npm install` (includes devDependencies):

- Pretty-formatted colored logs via pino-pretty
- Human-readable output for debugging

### Production Logging

With global installation:

- JSON logs to stderr (pino-pretty not included)
- Machine-parseable for log aggregation

Both modes are fully functional - formatting is the only difference.

## Common Development Tasks

### Adding a New MCP Tool

1. Add Zod schema to `src/schemas/remnote-schemas.ts`
2. Register tool in `src/tools/index.ts`
3. Add handler logic in tool dispatcher
4. Write unit tests in `test/unit/`
5. Update `docs/guides/tools-reference.md`
6. Update CHANGELOG.md

### Modifying WebSocket Protocol

1. Update types in `src/types/bridge.ts`
2. Modify handlers in `src/websocket-server.ts`
3. Update corresponding RemNote plugin code
4. Write integration tests
5. Update `docs/architecture.md` if protocol changes significantly
6. Update CHANGELOG.md

### Debugging

**Enable verbose logging:**
```bash
npm run dev -- --verbose
```

**Log to file:**
```bash
npm run dev -- --log-file /tmp/remnote-mcp.log --log-level-file debug
```

**Log WebSocket requests/responses:**
```bash
npm run dev -- --request-log /tmp/requests.jsonl --response-log /tmp/responses.jsonl
```

**Check logs:**
```bash
tail -f /tmp/remnote-mcp.log
tail -f /tmp/requests.jsonl | jq
```

## Contributing Guidelines

Before submitting a pull request:

1. **Run all quality checks:** `./code-quality.sh`
2. **Write/update tests** for code changes
3. **Update documentation**:
   - Code docstrings
   - Developer docs (.agents/, docs/)
   - User guides (docs/guides/)
4. **Update CHANGELOG.md** with your changes
5. **Verify manual testing** works end-to-end
6. **Follow commit message conventions** (see project Git history)

## Resources

- [Architecture Documentation](../architecture.md) - Design rationale and system architecture
- [CLAUDE.md](../../CLAUDE.md) - AI agent guidelines (useful for understanding project conventions)
- [CHANGELOG.md](../../CHANGELOG.md) - Version history and roadmap
- [MCP Specification](https://modelcontextprotocol.io/) - Protocol specification

## Getting Help

- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Bug reports and feature requests
