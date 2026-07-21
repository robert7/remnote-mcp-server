# ChatGPT Configuration

Set up ChatGPT Apps to connect to your RemNote MCP Server.

> Prerequisite: ChatGPT custom private MCP server setup currently requires Developer Mode to be enabled and an eligible
> paid ChatGPT subscription.  See:
> [OpenAI's Developer Mode guide](https://developers.openai.com/api/docs/guides/developer-mode/).

> Prerequisite: You also need a publicly reachable HTTPS MCP URL for your local server. Use
> [Remote Access Setup](remote-access.md) to configure ngrok/Cloudflare/Tailscale and security settings.

## Step 1: Open Apps settings

Open ChatGPT settings, go to **Apps**, and click **Create app**.

![ChatGPT Apps Settings](../images/remnote-mcp-server-demo-chatgpt-1.jpg)

## Step 2: Create the MCP app

Enter your app details and MCP Server URL, confirm the custom server warning, then click **Create**.

![Create ChatGPT MCP App](../images/remnote-mcp-server-demo-chatgpt-2.jpg)

## Step 3: Confirm app is enabled

Verify your `remnote` app appears in the enabled apps list.

![Enabled ChatGPT App](../images/remnote-mcp-server-demo-chatgpt-3.jpg)

## Step 4: Verify connection details and actions

Open the app details page to confirm URL, connection status, and exposed RemNote actions.

![ChatGPT App Details](../images/remnote-mcp-server-demo-chatgpt-4.jpg)

## Step 5: Run tool discovery

Ask ChatGPT to run discovery and verify it can list and call RemNote tools (including `remnote_status`).

![ChatGPT Tool Discovery](../images/remnote-mcp-server-demo-chatgpt-5.jpg)

## Step 6: Run a status preflight

Ask ChatGPT to check the MCP bridge status and verify connection plus write-policy settings.

![ChatGPT MCP Status Check](../images/remnote-mcp-server-demo-chatgpt-status-check.jpg)

## Step 7: Run a notes-only synthesis

Prompt ChatGPT for a focused summary grounded in your RemNote notes.

![ChatGPT Notes Summary](../images/remnote-mcp-server-demo-chatgpt-notes-summary.jpg)

## Step 8: Ask for a targeted follow-up comparison

Use a follow-up prompt requesting differences/contradictions against current internet knowledge.

![ChatGPT Follow-up Diff Request](../images/remnote-mcp-server-demo-chatgpt-followup-diff-request.jpg)

## Step 9: Confirm diff-style output

Verify ChatGPT returns a concise contradiction/mismatch list with clear takeaways.

![ChatGPT Notes vs Internet Diff](../images/remnote-mcp-server-demo-chatgpt-notes-vs-internet-diff.jpg)

PS: I first treated the "take melatonin ~7 hours before sleep" claim as a model error/hallucination. In the next
answer, ChatGPT quoted my actual note and context ("Take melatonin 9 hours after wake and 7 before sleep, eg 5 PM" for
delayed phase sleep disorder), so this was still a distortion, but not fully made up.
