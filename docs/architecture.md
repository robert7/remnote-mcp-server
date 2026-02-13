# Architecture and Design Rationale

This document captures the design decisions and architectural rationale behind the RemNote MCP Server. For
implementation details, code patterns, and development workflows, see AGENTS.md and README.md.

## Performance Considerations

The multi-layer architecture was designed with several performance constraints:

**HTTP MCP Layer:**

- **Multiple concurrent sessions:** Supports multiple AI agents connecting simultaneously via Streamable HTTP (SSE)
- **Per-session MCP Server instances:** Each MCP session gets its own Server instance, sharing the WebSocket bridge
- **Stateful sessions:** Session state maintained in-memory via Map-based transport tracking
- **DNS rebinding protection:** Uses SDK's `createMcpExpressApp()` to prevent DNS rebinding attacks

**WebSocket Bridge Layer:**

- **Single client connection model:** Prevents resource contention and simplifies state management. Only one RemNote
  plugin connection is allowed at a time, with additional connection attempts rejected with WebSocket close code 1008.
- **5-second request timeout:** Prevents indefinite hanging of pending promises. Each request sent to the RemNote plugin
  must complete within 5 seconds, after which the promise is rejected. This ensures the MCP server remains responsive
  even if the RemNote plugin becomes unresponsive.
- **UUID-based request correlation:** Enables efficient request/response matching with multiple in-flight requests. Each
  request gets a unique UUID that the RemNote plugin echoes back in its response, allowing the server to match responses
  to pending promises without requiring sequential processing.
- **Event-driven architecture:** Non-blocking I/O throughout. The WebSocket server handles messages asynchronously, and
  all tool invocations return promises that resolve when the RemNote plugin responds.

## Security Model

The server operates under a localhost security boundary assumption:

- **Localhost only:** Both HTTP and WebSocket servers bind to 127.0.0.1 by default, making them inaccessible from the
  network. This assumes the local machine is a trusted security boundary.
- **DNS rebinding protection:** HTTP server uses SDK's `createMcpExpressApp()` which includes DNS rebinding protection
  to prevent malicious websites from accessing localhost services.
- **No authentication:** Since both the MCP server and RemNote plugin run on the same machine under the same user
  account, no authentication is implemented between them. The single-client connection model provides basic access
  control.
- **Input validation:** All tool parameters are validated at runtime using Zod schemas before being forwarded to the
  RemNote plugin. This prevents malformed requests from reaching RemNote and provides clear error messages to the MCP
  client.

## Error Handling Strategy

Error handling is implemented at three layers, each with specific responsibilities:

### WebSocket Layer (`websocket-server.ts`)

- **No client connected:** Returns descriptive error "RemNote plugin not connected. Please ensure the plugin is
  installed and running."
- **Request timeout (5s):** Rejects the pending promise with a timeout error
- **Connection lost mid-request:** All pending requests are immediately rejected with "Connection lost" error
- **Malformed messages:** Logged to stderr, response discarded or request rejected

Design rationale: Fail fast with clear error messages. When the connection is lost, immediately clean up all pending
requests rather than leaving them hanging indefinitely.

### MCP Tool Layer (`tools/index.ts`)

- **Validation errors (Zod):** Returns MCP error response with detailed validation messages showing which parameters
  failed and why
- **Bridge errors:** Passes through error messages from the RemNote plugin without modification
- **Unknown tools:** Returns error "Unknown tool: {name}"

Design rationale: Distinguish between client-side validation errors (fixable by the MCP client) and server-side errors
(issues with RemNote plugin or RemNote itself). Zod validation errors include detailed schema information to help
diagnose parameter issues.

### Request Correlation

- **Unknown response ID:** Warning logged to stderr, response discarded (orphaned response)
- **Duplicate response:** Warning logged to stderr, second response ignored

Design rationale: Defensive programming against protocol violations. Log warnings for debugging but don't crash the
server if the RemNote plugin sends unexpected response IDs.

## Future Enhancements

Potential architectural improvements for consideration:

- **TLS/SSL support:** Add encrypted WebSocket connections (wss://) if the security model changes to allow network
  access
- **Authentication/authorization:** If multi-user scenarios or network access is required, implement token-based auth
- **Session persistence:** Optional session resumability across server restarts (currently all sessions lost on restart)
- **Rate limiting:** Protect against rapid-fire requests that could overwhelm RemNote
- **Request/response logging:** Persistent logging to file for debugging and auditing (currently only stderr)
- **Metrics and monitoring:** Expose server metrics (request counts, latencies, error rates) for observability
- **Health check endpoint:** HTTP endpoint for monitoring tools to verify server health
- **Batch operations:** Support bundling multiple RemNote operations into a single request/response
- **Streaming responses:** For large result sets, stream data back incrementally rather than buffering entire response
