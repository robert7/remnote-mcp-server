# RemNote MCP Server Implementation

## Overview

The RemNote MCP Server bridges Claude Code (via MCP protocol) to RemNote knowledge bases through the RemNote MCP Bridge plugin.

**Architecture Flow:**
```
Claude Code (stdio/MCP) ↔ MCP Server (WebSocket Server :3002) ↔ RemNote Plugin (WebSocket Client) ↔ RemNote API
```

## Project Structure

```
remnote-mcp-server/
├── src/
│   ├── index.ts                    # Main entry point: MCP + WebSocket server
│   ├── websocket-server.ts         # WebSocket server for RemNote plugin
│   ├── tools/
│   │   └── index.ts                # All 6 MCP tools consolidated
│   ├── schemas/
│   │   └── remnote-schemas.ts      # Zod validation schemas
│   └── types/
│       └── bridge.ts               # WebSocket protocol types
├── dist/                           # Compiled output
├── package.json
├── tsconfig.json
├── README.md
├── CLAUDE_CODE_CONFIG.md           # Configuration instructions
└── IMPLEMENTATION.md               # This file
```

## Key Components

### 1. WebSocket Server (`src/websocket-server.ts`)

Manages bidirectional communication with the RemNote plugin:

- **Port:** 3002 (configurable via `REMNOTE_WS_PORT`)
- **Single client:** Only one RemNote plugin connection allowed
- **Request/response correlation:** UUID-based tracking
- **Timeout:** 5 seconds per request
- **Heartbeat:** Responds to ping with pong
- **Error handling:** Connection loss rejects all pending requests

**Key Methods:**
- `start()` - Start WebSocket server
- `stop()` - Graceful shutdown
- `sendRequest(action, payload)` - Send request to RemNote plugin with correlation
- `isConnected()` - Check if plugin is connected
- `onClientConnect(callback)` - Register connect callback
- `onClientDisconnect(callback)` - Register disconnect callback

### 2. MCP Tools (`src/tools/index.ts`)

Six RemNote tools exposed to Claude Code:

1. **`remnote_create_note`**
   - Create new note with title, optional content, parent, and tags
   - Maps to RemNote action: `create_note`

2. **`remnote_search`**
   - Search knowledge base with query, limit, and includeContent options
   - Maps to RemNote action: `search`

3. **`remnote_read_note`**
   - Read specific note by ID with configurable depth
   - Maps to RemNote action: `read_note`

4. **`remnote_update_note`**
   - Update note title, append content, add/remove tags
   - Maps to RemNote action: `update_note`

5. **`remnote_append_journal`**
   - Append content to today's daily document
   - Maps to RemNote action: `append_journal`

6. **`remnote_status`**
   - Check connection status and statistics
   - Maps to RemNote action: `status`

All tools:
- Use Zod schemas for parameter validation
- Return JSON-formatted results
- Handle errors gracefully with `isError` flag

### 3. Main Entry Point (`src/index.ts`)

Coordinates MCP server and WebSocket server:

1. Creates MCP server with stdio transport
2. Starts WebSocket server on port 3002
3. Registers all tools
4. Logs connection events to stderr (stdio reserved for MCP)
5. Handles graceful shutdown (SIGINT, SIGTERM)

## WebSocket Protocol

### Message Types

**Request (MCP Server → RemNote Plugin):**
```typescript
{
  id: string;           // UUID for correlation
  action: string;       // create_note, search, read_note, etc.
  payload: Record<string, unknown>;  // Action parameters
}
```

**Response (RemNote Plugin → MCP Server):**
```typescript
{
  id: string;           // Matches request ID
  result?: unknown;     // Success result
  error?: string;       // Error message if failed
}
```

**Heartbeat:**
```typescript
{ type: 'ping' }  // From plugin
{ type: 'pong' }  // From server
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd ~/Projects/_private/remnote-mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Link Globally

```bash
npm link
```

This makes `remnote-mcp-server` available globally.

### 4. Configure Claude Code

Add to Claude Code's MCP configuration (see `CLAUDE_CODE_CONFIG.md`):

```json
{
  "mcpServers": {
    "remnote": {
      "command": "remnote-mcp-server"
    }
  }
}
```

### 5. Install RemNote Plugin

Ensure the RemNote MCP Bridge plugin is installed and configured to connect to `ws://127.0.0.1:3002`.

## Development

### Scripts

```bash
npm run dev        # Development mode with hot reload (tsx watch)
npm run build      # Production build (TypeScript compilation)
npm run start      # Start built server
npm run typecheck  # Type checking only
```

### Development Workflow

1. Start development server:
   ```bash
   npm run dev
   ```

2. Open RemNote with MCP Bridge plugin

3. Verify connection in console:
   ```
   [WebSocket Server] Listening on port 3002
   [MCP Server] Server started on stdio
   [WebSocket Server] Client connected
   [RemNote Bridge] RemNote plugin connected
   ```

4. Make changes to `src/*` - server auto-reloads

5. Test tools via Claude Code or MCP Inspector

## Error Handling

### WebSocket Layer

- **No client connected:** Returns error "RemNote plugin not connected. Please ensure the plugin is installed and running."
- **Request timeout (5s):** Rejects promise with timeout error
- **Connection lost mid-request:** All pending requests fail with "Connection lost"
- **Malformed messages:** Logged to stderr, request rejected

### MCP Tool Layer

- **Validation errors (Zod):** Returns MCP error response with validation details
- **Bridge errors:** Passes through error message from RemNote plugin
- **Unknown tools:** Returns error "Unknown tool: {name}"

### Request Correlation

- **Unknown response ID:** Warning logged, response discarded
- **Duplicate response:** Warning logged, second response ignored

## Logging

All logs go to **stderr** (stdout reserved for MCP stdio protocol):

- `[WebSocket Server]` - WebSocket server events
- `[MCP Server]` - MCP server events
- `[RemNote Bridge]` - RemNote plugin connection events

## Testing

### Manual Testing Steps

1. **Start RemNote** with MCP Bridge plugin enabled
2. **Verify plugin shows "Disconnected"** (no server running)
3. **Start MCP server:**
   ```bash
   npm run dev
   ```
4. **Verify plugin shows "Connected"**
5. **Test via Claude Code:**
   - "Create a note titled 'MCP Test'"
   - "Search for 'MCP Test'"
   - "Read the note with ID {remId}"
   - "Update note {remId} with new content"
   - "Append 'Test entry' to today's journal"
   - "Check RemNote status"

6. **Verify in RemNote:**
   - Notes appear in knowledge base
   - Action history shows in plugin sidebar

### Error Testing

- **Non-existent Rem ID:** Should return error gracefully
- **Invalid parameters:** Zod validation should catch and report
- **Plugin disconnect:** Tools should fail with connection error
- **Server restart:** Plugin should auto-reconnect

## Environment Variables

- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

## TypeScript Configuration

- **Target:** ES2022
- **Module:** ES2022 (native ESM)
- **Strict mode:** Enabled
- **Source maps:** Enabled
- **Declarations:** Enabled

## Dependencies

### Production
- `@modelcontextprotocol/sdk` ^1.26.0 - MCP protocol implementation
- `ws` ^8.19.0 - WebSocket server
- `zod` ^4.3.6 - Schema validation

### Development
- `typescript` ^5.9.3 - TypeScript compiler
- `tsx` ^4.21.0 - TypeScript execution with hot reload
- `@types/node` ^25.2.1 - Node.js type definitions
- `@types/ws` ^8.18.1 - WebSocket type definitions

## Performance Considerations

- **Single client connection:** Prevents resource contention
- **Request timeout:** 5-second limit prevents hanging requests
- **UUID correlation:** Efficient request/response matching
- **Event-driven architecture:** Non-blocking I/O

## Security Considerations

- **Localhost only:** WebSocket server binds to 127.0.0.1 (default ws module behavior)
- **Single client:** Prevents unauthorized connections
- **No authentication:** Assumes local machine security boundary
- **Input validation:** All parameters validated via Zod schemas

## Future Enhancements

Potential improvements:
- [ ] TLS/SSL support for WebSocket
- [ ] Authentication/authorization
- [ ] Multiple client support with session management
- [ ] Rate limiting
- [ ] Request/response logging to file
- [ ] Metrics and monitoring
- [ ] Health check endpoint
- [ ] Batch operations support
- [ ] Streaming responses for large results

## Troubleshooting

### Plugin Won't Connect

1. Verify server is running: `ps aux | grep remnote-mcp-server`
2. Check port is available: `lsof -i :3002`
3. Verify plugin WebSocket URL: `ws://127.0.0.1:3002`
4. Check server logs for errors

### Tools Not Appearing in Claude Code

1. Verify MCP configuration is correct
2. Restart Claude Code
3. Check Claude Code logs/console
4. Run `remnote-mcp-server` manually to check for errors

### Request Timeouts

1. Check RemNote plugin is responsive
2. Verify network connectivity
3. Increase timeout in `websocket-server.ts` if needed
4. Check RemNote API performance

### Build Errors

1. Clear dist: `rm -rf dist/`
2. Clear node_modules: `rm -rf node_modules/`
3. Reinstall: `npm install`
4. Rebuild: `npm run build`

## Version History

### v1.0.0 (2026-02-06)

Initial release:
- WebSocket server for RemNote plugin bridge
- MCP stdio transport for Claude Code
- Six RemNote tools
- Request/response correlation
- Heartbeat handling
- Error handling and reconnection support
