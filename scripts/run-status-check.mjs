import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpUrl = process.env.MCP_URL;
if (!mcpUrl) {
  console.error('Status check failed: MCP_URL is not set');
  process.exit(1);
}

const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
const client = new Client({ name: 'run-status-check', version: '1.0.0' });

try {
  await client.connect(transport);
  const result = await client.callTool({ name: 'remnote_status', arguments: {} });

  if (result.isError) {
    const text =
      Array.isArray(result.content) && result.content[0]?.type === 'text'
        ? (result.content[0].text ?? JSON.stringify(result))
        : JSON.stringify(result);
    console.error(`Status check failed: ${text}`);
    process.exit(1);
  }

  const text =
    Array.isArray(result.content) && result.content[0]?.type === 'text'
      ? (result.content[0].text ?? '{}')
      : JSON.stringify(result);

  try {
    const parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Status check failed: ${message}`);
  process.exit(1);
} finally {
  try {
    await transport.terminateSession();
  } catch {
    // Ignore cleanup errors
  }
  try {
    await client.close();
  } catch {
    // Ignore cleanup errors
  }
}
