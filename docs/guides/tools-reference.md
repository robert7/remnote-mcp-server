# MCP Tools Reference

Complete reference for all RemNote MCP tools available through the server.

## Overview

The RemNote MCP Server exposes 8 tools that allow AI agents to interact with your RemNote knowledge base. Tools are
automatically available in any connected MCP client.

## Tool Summary

| Tool | Description | Use Case |
|------|-------------|----------|
| `remnote_create_note` | Create new notes or flashcards | Adding new knowledge, ideas, references, or flashcards |
| `remnote_create_note_md` | Create hierarchical markdown trees | Quickly importing bulleted outlines/trees |
| `remnote_search` | Search knowledge base | Finding existing notes, exploring topics |
| `remnote_search_by_tag` | Search by tag | Finding ancestor context for tagged notes |
| `remnote_read_note` | Read note content | Retrieving details, reading hierarchies |
| `remnote_update_note` | Modify existing notes | Appending content, adding tags, renaming |
| `remnote_append_journal` | Add to daily document | Journaling, logging, daily notes |
| `remnote_get_playbook` | Get operating playbook | Session preflight, traversal defaults, write safety guidance |
| `remnote_status` | Check connection health | Verifying setup, debugging |

## remnote_create_note

Create a new note/flashcard in RemNote with optional parent hierarchy and tags.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title/name of the note, or the front text of a flashcard |
| `content` | string | No | Child content as bullet points (newline-separated) |
| `parentId` | string | No | Parent Rem ID to nest this note under |
| `tags` | string[] | No | Array of tag names to apply |
| `backText` | string | No | The back text to create a flashcard |
| `isConcept` | boolean | No | Explicitly create a Concept card (::) |
| `isDescriptor`| boolean | No | Explicitly create a Descriptor card (;;) |

### Usage

**Create a simple note:**
```
Create a RemNote note titled "Project Ideas"
```

**Create with content:**
```
Create a note "Shopping List" with content:
- Milk
- Bread
- Eggs
```

**Create under a parent:**
```
Create a note "Chapter 1" under the note with ID abc123
```

**Create with tags:**
```
Create a note "Important Meeting" with tags "work" and "urgent"
```

**Create a flashcard:**
```
Create a Concept card titled "Photosynthesis" with back text "Process by which plants make food"
```

### Response

Returns the created note's Rem ID and confirmation:

```json
{
  "remId": "abc123xyz",
  "title": "Project Ideas",
  "backText": "Optional back text returned if created as a card"
}
```

### Tips

- Use descriptive titles for better searchability
- Structure content with bullets (`-` or `•`) for RemNote hierarchy
- Use `parentId` to organize notes within existing hierarchies
- Tags can be existing or new - new tags are created automatically
- Provide `backText` to turn the note into a flashcard

## remnote_create_note_md

Create a hierarchical note tree in RemNote from a markdown string (indented bullets). Automatically parses indentations into parent-child Rem relationships using RemNote's native capabilities.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Markdown text containing the bulleted tree |
| `title` | string | No | Optional root Rem title to enclose the entire tree. If not provided, parent Rem will be used as the title. |
| `parentId` | string | No | Parent Rem ID where the tree will be created, if not provided, the tree will be created under defaultParentId under plugin settings. |
| `tags` | string[] | No | Array of tags to apply to the root/title Rem |

### Usage

**Create from an outline or hierarchical note:**
```
Create a markdown tree:
- Programming Languages
  - Python
  - JavaScript
    - React
    - Node
- Databases
```

**Create flashcards via markdown:**
Since this uses RemNote's native markdown parser, you can create flashcards inline using `::` for Concept cards and `;;` for Descriptor cards. This function fully supports RemNote's markdown-based flashcard creation.

For example, if you want to batch create flashcards, you can use the following format:

```
Create a markdown tree of biology terms, titled as "Energy Flow in Biology":
- Photosynthesis :: Process by which plants make food
- Cellular Respiration
  - Definition ;; The process of breaking down glucose for energy
```

For more usage, refer to https://help.remnote.com/en/articles/9252072-how-to-import-flashcards-from-text#h_fc1588b3b7

### Response

Returns an array of remIds containing the title (if provided) and each generated markdown line, in top-to-bottom order:

```json
{
  "remIds": ["abc123xyz", "def456xyz"],
  "title": "Title of the markdown tree"
}
```

### Tips

- Provide a `title` if you want all items nested logically under a single new Rem
- Use `- ` or `* ` for each bullet and use leading spaces for nesting levels

## remnote_search

Search your RemNote knowledge base with full-text search.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query text |
| `limit` | number | No | Maximum results to return (1-150, default: 50) |
| `includeContent` | string | No | Content mode: `none` (default), `markdown`, or `structured` |
| `depth` | number | No | Max child depth for rendered content (0-10, default: 1) |

### Usage

**Basic search:**
```
Search my RemNote for "machine learning"
```

**Search with more results:**
```
Search for "project management" and show up to 50 results
```

**Search with content:**
```
Search for "AI ethics" and include the note content
```

### Response

Returns array of matching notes:

```json
{
  "results": [
    {
      "remId": "abc123",
      "title": "Machine Learning Basics",
      "headline": "Machine Learning Basics",
      "parentRemId": "parent987",
      "parentTitle": "AI Notes",
      "remType": "document"
    },
    {
      "remId": "def456",
      "title": "Deep Learning Overview",
      "headline": "Deep Learning Overview",
      "remType": "text"
    }
  ]
}
```

**With content included:**
```json
{
  "results": [
    {
      "remId": "abc123",
      "title": "Machine Learning Basics",
      "headline": "Machine Learning Basics",
      "parentRemId": "parent987",
      "parentTitle": "AI Notes",
      "remType": "document",
      "content": "- Supervised learning\n- Unsupervised learning\n"
    }
  ]
}
```

### Tips

- Use specific terms for better results
- Increase `limit` for comprehensive searches
- Use `includeContent: "none"` (default) for faster searches when you only need titles
- Use `includeContent: "markdown"` when you need rendered child context
- Use `includeContent: "structured"` when you need nested child `remId`s for follow-up reads/navigation
- For whole-KB orientation, start with `includeContent: "structured"`, `depth: 1`, `childLimit: 500`
- Use `parentRemId` and `parentTitle` to show where a result sits in your hierarchy.

## remnote_search_by_tag

Search by tag and return resolved ancestor context targets.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tag` | string | Yes | Tag name (with or without `#` prefix) |
| `limit` | number | No | Maximum results to return (1-150, default: 50) |
| `includeContent` | string | No | Content mode: `none` (default), `markdown`, or `structured` |
| `depth` | number | No | Max child depth for rendered content (0-10, default: 1) |

### Behavior

- For each tagged match, the bridge resolves the returned target to:
  1) nearest ancestor document/daily document,
  2) otherwise nearest non-document ancestor,
  3) otherwise the tagged note itself.
- Output shape is the same as `remnote_search`.

### Usage

**Find daily notes by tag:**
```text
Search by tag "#daily"
```

**Find tagged results with content:**
```text
Search by tag "project-review" and include structured content
```

## remnote_read_note

Read a specific note by its Rem ID, including child content.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | The Rem ID to read |
| `depth` | number | No | Depth of children to include in rendered content (0-10, default: 5) |
| `includeContent` | string | No | Content mode: `markdown` (default), `structured`, or `none` |

### Usage

**Read a note:**
```
Read the RemNote note with ID abc123
```

**Read with more depth:**
```
Read note def456 with depth 5 to include more nested children
```

**Read top-level only:**
```
Read note xyz789 with depth 0 (no children)
```

### Response

Returns note metadata plus optional rendered child content:

```json
{
  "remId": "abc123",
  "title": "Project Overview",
  "headline": "Project Overview",
  "parentRemId": "folder001",
  "parentTitle": "Work Projects",
  "remType": "document",
  "content": "- Goals\n  - Improve performance\n- Timeline\n",
  "contentProperties": {
    "childrenRendered": 3,
    "childrenTotal": 3,
    "contentTruncated": false
  }
}
```

In `includeContent: "structured"` mode, the response includes `contentStructured` (nested child nodes with `remId`s)
instead of markdown `content`.

### Tips

- Use `depth: 0` for just the note title (no children)
- Use `includeContent: "none"` when you only need metadata and parent context.
- Use `includeContent: "structured"` when you need nested child `remId`s for deterministic follow-up navigation.
- Start traversal with `includeContent: "structured"`, `depth: 1`, `childLimit: 500`, then deepen selected branches.
- Use `depth: 1-3` for common hierarchies
- Use `depth: 4-10` for deep nested structures
- Higher depth may be slower for large hierarchies

## remnote_update_note

Update an existing note - change title, append content, or modify tags.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | The Rem ID to update |
| `title` | string | No | New title for the note |
| `appendContent` | string | No | Content to append as children (newline-separated) |
| `replaceContent` | string | No | Replace direct children (newline-separated; empty string clears all direct children) |
| `addTags` | string[] | No | Tags to add |
| `removeTags` | string[] | No | Tags to remove |

**Notes:**

- At least one of `title`, `appendContent`, `replaceContent`, `addTags`, or `removeTags` must be provided.
- `appendContent` and `replaceContent` are mutually exclusive in one request.
- Replace calls can be rejected by bridge policy settings:
  - `acceptWriteOperations=false` blocks all update operations.
  - `acceptReplaceOperation=false` blocks replace operations.

### Usage

**Rename a note:**
```
Rename note abc123 to "Updated Project Name"
```

**Append content:**
```
Add to note def456:
- New task
- Another item
```

**Replace content:**
```
Replace note def456 content with:
- Fresh item 1
- Fresh item 2
```

**Clear direct children:**
```
Replace content of note def456 with an empty string
```

**Add tags:**
```
Add tags "important" and "review" to note xyz789
```

**Remove tags:**
```
Remove tag "draft" from note abc123
```

**Multiple updates:**
```
Update note def456: rename to "Completed Project", add tag "done", append "Final notes"
```

### Response

Returns confirmation of updates:

```json
{
  "remId": "abc123",
  "updated": true,
  "changes": {
    "title": "Updated Project Name",
    "contentAppended": true,
    "tagsAdded": ["important"],
    "tagsRemoved": []
  }
}
```

### Tips

- You can update multiple properties in one call
- `appendContent` adds to the end and keeps existing content.
- `replaceContent` rewrites direct child bullets under the note.
- `replaceContent: ""` clears all direct children.
- Tags are case-sensitive
- New tags are created automatically when added

## remnote_append_journal

Append content to today's daily document in RemNote.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Content to append to today's daily document |
| `timestamp` | boolean | No | Include timestamp (default: true) |

### Usage

**Add journal entry:**
```
Add to my journal: "Completed the MCP integration today"
```

**Add without timestamp:**
```
Add to my journal without timestamp: "Project milestone reached"
```

### Response

Returns confirmation:

```json
{
  "success": true,
  "date": "2024-01-15",
  "timestamp": "10:30:45",
  "content": "Completed the MCP integration today"
}
```

### Tips

- Entries are added to today's daily document (created automatically if it doesn't exist)
- Use `timestamp: true` (default) for timestamped entries
- Use `timestamp: false` for plain entries
- Great for logging daily activities, thoughts, or progress notes

## remnote_get_playbook

Return a compact operational playbook for MCP agents.

Use this tool when an agent needs built-in guidance for:

- status-first session preflight recommendations,
- hierarchy traversal presets for whole-KB navigation,
- `markdown` vs `structured` content-mode decisions,
- write/replace safety checks.

### Parameters

None.

### Usage

```text
Get the RemNote MCP playbook
```

Or:

```text
Call remnote_get_playbook and follow its navigation defaults
```

### Response

Returns a structured playbook object, including:

- `decisionTree` - short natural-language operating decisions.
- `navigationPresets.orientation` - recommended traversal defaults (`structured`, `depth: 1`, `childLimit: 500`).
- `contentModes` - when to use `structured` vs `markdown` vs `none`.
- `writePolicy` - how to interpret `acceptWriteOperations` / `acceptReplaceOperation`.
- `currentStatus` - live `remnote_status` snapshot when available.

### Tips

- Treat this as guidance, not rigid policy.
- Call `remnote_status` once per session (recommended) and before high-risk writes.
- For whole-KB orientation, start shallow and ID-first:
  - `structured` mode, `depth: 1`, `childLimit: 500`.

## remnote_status

Check connection status, compatibility warnings, and write-policy capabilities.

### Parameters

None.

### Usage

```
Check the RemNote connection status
```

Or:
```
Use remnote_status to verify the bridge is working
```

### Response

Returns connection health and policy capabilities:

```json
{
  "connected": true,
  "serverVersion": "0.8.0",
  "pluginVersion": "0.3.2",
  "acceptWriteOperations": true,
  "acceptReplaceOperation": false,
  "statistics": {
    "requestsSent": 142,
    "responsesReceived": 141,
    "errors": 1,
    "uptime": "2h 34m"
  }
}
```

**If disconnected:**
```json
{
  "connected": false,
  "error": "RemNote plugin not connected"
}
```

### Tips

- Use this to verify your setup after installation
- Call once per session before normal operations (recommended)
- Check after configuration changes
- Check before write operations when safety/capability matters
- Useful for debugging connection and compatibility issues
- See [Troubleshooting Guide](troubleshooting.md) if status shows disconnected

## Conversational Usage

AI agents automatically select the appropriate tool based on natural language commands. You don't need to specify tool
names.

### Examples

**Natural command → Tool used**

| User says | AI uses |
|-----------|---------|
| "Create a note about X" | `remnote_create_note` |
| "Create a note about X" | `remnote_create_note` |
| "Search for Y" | `remnote_search` |
| "Show me note abc123" | `remnote_read_note` |
| "Add Z to note def456" | `remnote_update_note` |
| "Log today's progress" | `remnote_append_journal` |
| "How should I navigate this KB?" | `remnote_get_playbook` |
| "Is RemNote connected?" | `remnote_status` |

### Complex Workflows

AI agents can chain multiple tools:

**"Find my project management notes and create a summary"**

1. `remnote_search` - Search for "project management"
2. `remnote_read_note` - Read each result
3. `remnote_create_note` - Create summary note

**"Update my tasks note with today's completed items"**

1. `remnote_search` - Find "tasks" note
2. `remnote_read_note` - Read current tasks
3. `remnote_update_note` - Append completed items

## Error Handling

### Common Errors

**Note not found:**
```json
{
  "error": "Note with ID abc123 not found"
}
```

**Invalid parameters:**
```json
{
  "error": "Parameter 'limit' must be between 1 and 100"
}
```

**Connection error:**
```json
{
  "error": "RemNote plugin not connected"
}
```

### Troubleshooting

- **Note not found:** Verify the Rem ID is correct (use search to find it)
- **Invalid parameters:** Check parameter types and ranges
- **Connection errors:** See [Troubleshooting Guide](troubleshooting.md#plugin-wont-connect)
- **Timeout errors:** Check RemNote app is running and plugin is connected

## Best Practices

### Creating Notes

- Use descriptive titles for better searchability
- Structure content hierarchically with bullet points
- Use tags for categorization and filtering
- Set parent relationships to maintain organization

### Searching

- Start with broad searches, then refine
- Use `includeContent: false` for title-only searches (faster)
- Use `includeContent: true` when you need content analysis
- Increase `limit` for comprehensive searches

### Reading Notes

- Use appropriate `depth` based on hierarchy complexity
- Lower depths are faster for shallow structures
- Higher depths capture more context for nested content

### Updating Notes

- Combine multiple updates in one call for efficiency
- Use descriptive titles after renaming
- Add tags for better organization
- Append content for logging or adding details

### Journaling

- Use timestamps for time-tracking
- Use plain entries for topic-based organization
- Log regularly for better knowledge capture

## Related Documentation

- [Configuration Guide](configuration.md) - Set up MCP clients
- [Installation Guide](installation.md) - Install the server
- [Troubleshooting](troubleshooting.md) - Common issues
- [Demo](../demo.md) - See tools in action

## Need Help?

- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Report bugs or ask questions
