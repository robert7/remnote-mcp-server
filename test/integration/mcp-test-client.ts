/**
 * Thin wrapper around the MCP SDK Client for integration testing.
 * Handles connection lifecycle and tool call result parsing.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export class McpTestClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;

  /**
   * Connect to the MCP server at the given base URL.
   * Creates the transport and client, then performs the MCP handshake.
   */
  async connect(baseUrl: string): Promise<void> {
    const mcpUrl = baseUrl.endsWith('/mcp') ? baseUrl : `${baseUrl}/mcp`;
    this.transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    this.client = new Client({ name: 'integration-test', version: '1.0.0' });
    await this.client.connect(this.transport);
  }

  /**
   * Call an MCP tool and return the parsed JSON result.
   * Throws if the tool returns an error or if the response cannot be parsed.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    if (!this.client) {
      throw new Error('McpTestClient: not connected. Call connect() first.');
    }

    const result = await this.client.callTool({ name, arguments: args });

    // Check for MCP-level error flag
    if (result.isError) {
      const text = this.extractText(result);
      throw new ToolError(`Tool "${name}" returned error: ${text}`, text);
    }

    return this.parseResult(result);
  }

  /**
   * Call an MCP tool expecting it to fail. Returns the error text.
   * Throws if the tool succeeds unexpectedly.
   */
  async callToolExpectError(name: string, args: Record<string, unknown> = {}): Promise<string> {
    if (!this.client) {
      throw new Error('McpTestClient: not connected. Call connect() first.');
    }

    const result = await this.client.callTool({ name, arguments: args });

    // Tool might signal error via isError flag
    if (result.isError) {
      return this.extractText(result);
    }

    // Or the result content might contain error information
    const text = this.extractText(result);
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // Not JSON — return raw text
    }

    // Some tools return success but with error info in the response
    return text;
  }

  /**
   * Close the MCP session and transport.
   */
  async close(): Promise<void> {
    try {
      if (this.transport) {
        await this.transport.terminateSession();
      }
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (this.client) {
        await this.client.close();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.client = null;
    this.transport = null;
  }

  private extractText(result: Awaited<ReturnType<Client['callTool']>>): string {
    const content = result.content as Array<{ type: string; text?: string }>;
    if (content && content.length > 0 && content[0].text) {
      return content[0].text;
    }
    return JSON.stringify(result);
  }

  private parseResult(result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
    const text = this.extractText(result);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { _raw: text };
    }
  }
}

/** Error thrown when a tool call returns an error response. */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolResponse: string
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
