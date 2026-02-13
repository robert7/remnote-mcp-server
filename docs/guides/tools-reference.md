# MCP Tools Reference

Complete reference for all RemNote MCP tools available through the server.

## Overview

The RemNote MCP Server exposes 6 tools that allow AI agents to interact with your RemNote knowledge base. Tools are
automatically available in any connected MCP client.

## Tool Summary

| Tool | Description | Use Case |
|------|-------------|----------|
| `remnote_create_note` | Create new notes | Adding new knowledge, ideas, references |
| `remnote_search` | Search knowledge base | Finding existing notes, exploring topics |
| `remnote_read_note` | Read note content | Retrieving details, reading hierarchies |
| `remnote_update_note` | Modify existing notes | Appending content, adding tags, renaming |
| `remnote_append_journal` | Add to daily document | Journaling, logging, daily notes |
| `remnote_status` | Check connection health | Verifying setup, debugging |

## remnote_create_note

Create a new note in RemNote with optional parent hierarchy and tags.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title/name of the note |
| `content` | string | No | Child content as bullet points (newline-separated) |
| `parentId` | string | No | Parent Rem ID to nest this note under |
| `tags` | string[] | No | Array of tag names to apply |

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

### Response

Returns the created note's Rem ID and confirmation:

```json
{
  "remId": "abc123xyz",
  "title": "Project Ideas",
  "created": true
}
```

### Tips

- Use descriptive titles for better searchability
- Structure content with bullets (`-` or `•`) for RemNote hierarchy
- Use `parentId` to organize notes within existing hierarchies
- Tags can be existing or new - new tags are created automatically

## remnote_search

Search your RemNote knowledge base with full-text search.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query text |
| `limit` | number | No | Maximum results to return (1-100, default: 20) |
| `includeContent` | boolean | No | Include child content in results (default: false) |

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
      "score": 0.95
    },
    {
      "remId": "def456",
      "title": "Deep Learning Overview",
      "score": 0.87
    }
  ],
  "count": 2
}
```

**With content included:**
```json
{
  "results": [
    {
      "remId": "abc123",
      "title": "Machine Learning Basics",
      "score": 0.95,
      "content": [
        "Supervised learning",
        "Unsupervised learning"
      ]
    }
  ],
  "count": 1
}
```

### Tips

- Use specific terms for better results
- Increase `limit` for comprehensive searches
- Use `includeContent: false` (default) for faster searches when you only need titles
- Use `includeContent: true` when you need to analyze note content

## remnote_read_note

Read a specific note by its Rem ID, including child content.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | The Rem ID to read |
| `depth` | number | No | Depth of children to include (0-10, default: 3) |

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

Returns the note with hierarchical content:

```json
{
  "remId": "abc123",
  "title": "Project Overview",
  "children": [
    {
      "remId": "child1",
      "text": "Goals",
      "children": [
        {
          "remId": "child1a",
          "text": "Improve performance"
        }
      ]
    },
    {
      "remId": "child2",
      "text": "Timeline"
    }
  ]
}
```

### Tips

- Use `depth: 0` for just the note title (no children)
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
| `addTags` | string[] | No | Tags to add |
| `removeTags` | string[] | No | Tags to remove |

**Note:** At least one of `title`, `appendContent`, `addTags`, or `removeTags` must be provided.

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
- `appendContent` adds to the end - doesn't replace existing content
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

## remnote_status

Check the connection status and statistics of the RemNote MCP bridge.

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

Returns connection health and statistics:

```json
{
  "connected": true,
  "pluginVersion": "0.3.2",
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
- Check after configuration changes
- Useful for debugging connection issues
- See [Troubleshooting Guide](troubleshooting.md) if status shows disconnected

## Conversational Usage

AI agents automatically select the appropriate tool based on natural language commands. You don't need to specify tool
names.

### Examples

**Natural command → Tool used**

| User says | AI uses |
|-----------|---------|
| "Create a note about X" | `remnote_create_note` |
| "Search for Y" | `remnote_search` |
| "Show me note abc123" | `remnote_read_note` |
| "Add Z to note def456" | `remnote_update_note` |
| "Log today's progress" | `remnote_append_journal` |
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
- [GitHub Discussions](https://github.com/robert7/remnote-mcp-server/discussions) - Community support
