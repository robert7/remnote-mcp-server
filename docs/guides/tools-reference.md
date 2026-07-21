# MCP Tools Reference

Complete reference for all RemNote MCP tools available through the server.

## Overview

The RemNote MCP Server exposes tools that allow AI agents to interact with your RemNote knowledge base. Tools are
automatically available in any connected MCP client.

Tools with an `outputSchema` return machine-readable data in MCP `structuredContent` and also include the serialized
JSON in a top-level `content` text block for compatibility with older clients and transcripts. This follows the
[MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Tool Summary

| Tool | Description | Use Case |
|------|-------------|----------|
| `remnote_create_note` | Create new notes or flashcards | Adding new knowledge, ideas, references, or flashcards. Supports hierarchical markdown, real aliases, exact tag Rem IDs, and optional root document status. |
| `remnote_search` | Search knowledge base | Finding existing notes, exploring topics |
| `remnote_search_by_tag` | Search by exact tag Rem ID | Finding ancestor context for tagged notes |
| `remnote_read_note` | Read note content | Retrieving details, reading hierarchies |
| `remnote_get_media` | Retrieve managed image content | Fetching an embedded RemNote image by stable metadata ID |
| `remnote_list_children` | List direct child Rems | Cheap branch traversal without subtree rendering |
| `remnote_update_note` | Update note metadata | Renaming and additive/removal alias changes |
| `remnote_set_document_status` | Set document status | Dry-run-first document marking without removing concept/card status |
| `remnote_move_note` | Move a Rem safely | Dry-run-first hierarchy reorganization |
| `remnote_insert_children` | Insert child Rems | Ordered hierarchy maintenance, tag descriptions |
| `remnote_replace_children` | Replace direct child Rems | Explicitly approved destructive rewrites |
| `remnote_update_tags` | Mutate tags by exact Rem ID | Production tagging workflows |
| `remnote_set_property` | Set tag/table property values | Exact-ID property writes for property-bearing tags and tables |
| `remnote_append_journal` | Add to daily document | Journaling, logging, daily notes, optional exact tag Rem IDs |
| `remnote_read_table` | Read Advanced Tables | Fetching tabular rows, schema metadata, and filtered columns |
| `remnote_get_playbook` | Get operating playbook | Session preflight, traversal defaults, write safety guidance |
| `remnote_status` | Check connection health | Verifying setup, debugging |

## remnote_create_note

Create a new note/flashcard in RemNote with optional parent hierarchy, exact tag Rem IDs, and real aliases.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | No | The title of the note (optional if content is provided); supports `[[id:<remId>]]` |
| `content` | string | No | Child content as bullet points or hierarchical markdown; supports `[[id:<remId>]]` |
| `parentId` | string | No | Parent Rem ID to nest this note under |
| `tagRemIds` | string[] | No | Exact tag Rem IDs to apply |
| `asDocument` | boolean | No | Mark the created title/root Rem as a document while preserving flashcard/concept status |
| `aliases` | string[] | No | Alternate names on the explicit title/root Rem; requires `title` |

Aliases are trimmed, internal whitespace runs collapse to one space, and normalized duplicates or aliases equal to the
primary title are ignored. Comparison is case-sensitive and Unicode is preserved.

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

**Create with tag Rem IDs:**
```
Create a note "Important Meeting" with tagRemIds ["workTagRemId", "urgentTagRemId"]
```

**Create with aliases:**
```
Create a note "The Shop on Main Street" with aliases ["Obchod na korze"]
```

**Create with an exact inline Rem reference:**
```
Create a note "Compound" with content "Component [[id:componentRemId]]"
```

**Create the root Rem as a document:**
```
Create a note "Project Brief" with asDocument true and content:
- Scope
- Decisions
```

**Create a flashcard:**
```
Create a Concept card titled "Photosynthesis" with content "Photosynthesis :: Process by which plants make food"
```

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

Returns an array of remIds containing the title (if provided) and each generated markdown line:

```json
{
  "remIds": ["abc123xyz", "def456xyz"],
  "titles": ["Project Ideas", "Child 1"]
}
```

### Tips

- Use descriptive titles for better searchability
- Structure content with bullets (`-` or `•`) for RemNote hierarchy
- Use `parentId` to organize notes within existing hierarchies
- Use `tagRemIds` for production tagging workflows. Create or resolve the tag Rem first, then pass its exact Rem ID.
- Use `[[id:<remId>]]` in markdown-capable title/content fields when a link must target an exact existing Rem.
- Flashcards are created via markdown syntax in `content`, not separate create-note fields
- Tag Rem IDs apply to the created root Rem when `title` is provided, or to top-level created Rems when `title` is omitted


## remnote_search

Search your RemNote knowledge base with full-text search.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query text |
| `limit` | number | No | Maximum results to return (1-150, default: 50) |
| `cursor` | string | No | Opaque cursor from a previous `remnote_search` response |
| `contentMode` | string | No | Content mode: `none` (default), `markdown`, or `structured` |
| `view` | string | No | Output detail level: `compact`, `standard` (default), or `full` |
| `ancestorDepth` | number | No | Number of parent Rems to include, direct parent first |
| `includeMediaMetadata` | boolean | No | Include ordered root image metadata for follow-up retrieval |
| `depth` | number | No | Max child depth for rendered content (0-10, default: 1) |
| `parentRemId` | string | No | Non-empty Rem ID to scope search within this Rem's subtree |

### Usage

**Basic search:**
```
Search my RemNote for "machine learning"
```

**Search with more results:**
```
Search for "project management" and show up to 50 results
```

**Continue a paged search:**
```
Search again with the nextCursor from the previous remnote_search response
```

**Search with content:**
```
Search for "AI ethics" and include the note content
```

### Response

Returns matching notes plus paging metadata:

```json
{
  "results": [
    {
      "remId": "abc123",
      "title": "Machine Learning Basics and [[Neural Networks]]",
      "headline": "Machine Learning Basics and [[Neural Networks]]",
      "inlineRefs": [
        { "text": "Neural Networks", "targetRemId": "neuralNetworksRemId789", "kind": "rem" }
      ],
      "parentRemId": "parent987",
      "parentTitle": "AI Notes",
      "tags": [
        { "tagRemId": "mlTagRemId123", "name": "ml" },
        { "tagRemId": "referenceTagRemId456", "name": "reference" }
      ],
      "remType": "document"
    },
    {
      "remId": "def456",
      "title": "Deep Learning Overview",
      "headline": "Deep Learning Overview",
      "remType": "text"
    }
  ],
  "hasMore": true,
  "nextCursor": "search:v1:...",
  "truncated": false
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
      "tags": [
        { "tagRemId": "mlTagRemId123", "name": "ml" },
        { "tagRemId": "referenceTagRemId456", "name": "reference" }
      ],
      "remType": "document",
      "content": "- Supervised learning\n- Unsupervised learning\n"
    }
  ]
}
```

### Tips

- Use specific terms for better results
- Use `parentRemId` to scope your search within a specific Rem's subtree (e.g. search within a specific folder or document)
- Increase `limit` for comprehensive searches
- Use `contentMode: "none"` (default) for faster searches when you only need titles
- Use `contentMode: "markdown"` when you need rendered child context
- Use `contentMode: "structured"` when you need nested child `remId`s for follow-up reads/navigation
- Use `nextCursor` while `hasMore` is true to continue a stable ordered search snapshot.
- Use `inlineRefs` when rendered titles/headlines contain `[[...]]` references and you need exact graph targets.
- For whole-KB orientation, start with `contentMode: "structured"`, `view: "compact"`, `depth: 1`, `childLimit: 500`
- Use `parentRemId` and `parentTitle` to show the direct parent.
- Use `ancestorDepth` when you need nearby hierarchy context. `ancestors` is parent-first and may include
  `ancestorsTruncated`.
- `tags` is optional and present when the matched Rem has readable tag identity metadata. Each tag includes
  `tagRemId` and `name`.

## remnote_search_by_tag

Search by exact tag Rem ID. By default, returns resolved ancestor context targets and exposes direct matched Rems.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagRemId` | string | Yes | Exact tag Rem ID to search |
| `resultMode` | string | No | `context` (default) returns resolved context targets with `matchedRems`; `tagged` returns direct tagged Rems with context metadata |
| `limit` | number | No | Maximum results to return (1-150, default: 50) |
| `cursor` | string | No | Opaque cursor from a previous `remnote_search_by_tag` response |
| `timeoutMs` | number | No | Per-call bridge wait timeout in milliseconds (1-60000, default: 15000); does not cancel plugin-side work |
| `contentMode` | string | No | Content mode: `none` (default), `markdown`, or `structured` |
| `view` | string | No | Output detail level: `compact`, `standard` (default), or `full` |
| `ancestorDepth` | number | No | Number of parent Rems to include on results and `matchedRems`, direct parent first |
| `depth` | number | No | Max child depth for rendered content (0-10, default: 1) |

### Behavior

- For each tagged match, the bridge resolves the returned target to:
  1) nearest ancestor document/daily document,
  2) otherwise nearest non-document ancestor,
  3) otherwise the tagged note itself.
- `resultMode: "context"` preserves the navigation workflow and includes `matchedRems` for direct tag verification.
- `resultMode: "tagged"` returns the directly tagged Rems as top-level results and includes `contextRemId`,
  `contextTitle`, and `contextReason`.
- Tag names, `#name` inputs, and aliases are intentionally not resolved. Use the exact tag Rem ID to avoid ambiguity
  from duplicate names, renamed tags, or aliases.
- If `tagRemId` is valid input but does not resolve to a Rem, results are empty.
- Top-level output fields, content rendering, and cursor paging metadata are aligned with `remnote_search`.
- `cursor` is bound to `tagRemId` and `resultMode`; `context` and `tagged` cursors are not interchangeable.

### Usage

**Find notes by exact tag Rem ID:**
```text
Search by tagRemId "dailyTagRemId123"
```

**Find tagged results with content:**
```text
Search by tagRemId "projectReviewTagRemId123" and include structured content
```

## remnote_read_note

Read a specific note by its Rem ID, including child content.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | The Rem ID to read |
| `depth` | number | No | Depth of children to include in rendered content (0-10, default: 5) |
| `contentMode` | string | No | Content mode: `markdown` (default), `structured`, or `none` |
| `view` | string | No | Output detail level: `compact`, `standard` (default), or `full` |
| `ancestorDepth` | number | No | Number of parent Rems to include, direct parent first |

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
  "title": "Project Overview for [[Launch Plan]]",
  "headline": "Project Overview for [[Launch Plan]]",
  "inlineRefs": [
    { "text": "Launch Plan", "targetRemId": "launchPlanRemId789", "kind": "rem" }
  ],
  "parentRemId": "folder001",
  "parentTitle": "Work Projects",
  "tags": [
    { "tagRemId": "workTagRemId123", "name": "work" },
    { "tagRemId": "activeTagRemId456", "name": "active" }
  ],
  "remType": "document",
  "content": "- Goals\n  - Improve performance\n- Timeline\n",
  "contentProperties": {
    "childrenRendered": 3,
    "childrenTotal": 3,
    "contentTruncated": false
  }
}
```

In `contentMode: "structured"` mode, the response includes `contentStructured` (nested child nodes with `remId`s)
instead of markdown `content`. Leaf nodes omit `children` rather than returning an empty array.

### Tips

- Use `depth: 0` for just the note title (no children)
- Use `contentMode: "none"` when you only need metadata and parent context.
- Use `contentMode: "structured"` when you need nested child `remId`s for deterministic follow-up navigation.
- Use `inlineRefs` to follow inline Rem references without parsing `[[...]]` markdown text.
- `tags` is optional and present when the returned Rem has readable tag identity metadata. Each tag includes
  `tagRemId` and `name`.
- Start traversal with `contentMode: "structured"`, `depth: 1`, `childLimit: 500`, then deepen selected branches.
- Use `depth: 1-3` for common hierarchies
- Use `depth: 4-10` for deep nested structures
- Higher depth may be slower for large hierarchies

## remnote_get_media

Retrieve one RemNote-managed PNG, JPEG, GIF, or WebP image as MCP-native image content. External URLs are deliberately
excluded. First call `remnote_read_note` with `includeMediaMetadata: true`, then pass the returned `remId`, `field`, and
`mediaId`. Media support is part of the complete matching bridge/server minor-version contract.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | Rem containing the image |
| `field` | string | Yes | `text` or `backText` |
| `mediaId` | string | Yes | Stable ID returned by `remnote_read_note` |
| `maxInlineBytes` | number | No | Per-call byte limit; defaults to 5 MiB and cannot exceed 10 MiB |

The result includes one MCP `image` content block and structured metadata without duplicating base64 in text. Stale
IDs, ambiguous files, unsafe paths, unsupported formats, and files that change during retrieval fail closed.

## remnote_update_note

Update note metadata through title and exact additive/removal alias operations.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | The Rem ID to update |
| `title` | string | No | New title for the note |
| `addAliases` | string[] | No | Aliases to add if not already present after whitespace normalization |
| `removeAliases` | string[] | No | Aliases to remove by exact normalized, case-sensitive match |

At least one of `title`, `addAliases`, or `removeAliases` is required. Adding an existing alias and removing a missing
alias are idempotent. The same normalized alias cannot appear in both operations.

**Notes:**

- Use `remnote_insert_children` for ordered child creation.
- Use `remnote_replace_children` for explicitly approved direct-child replacement.
- Use `remnote_update_tags` for exact-ID tag mutation.
- Use `remnote_move_note` for dry-run-first hierarchy reparenting.
- Use `remnote_set_document_status` to mark or unmark an existing Rem as a document.

### Usage

**Rename a note:**
```
Rename note abc123 to "Updated Project Name"
```

**Update aliases without renaming:**
```
Add alias "Original Title" and remove alias "Old Title" from note abc123
```

## remnote_set_document_status

Preview or set whether an existing Rem is marked as a document. This preserves the Rem ID, parent, children, tags, and
concept/card status. A Rem can be both a concept/card and a document; this tool changes only document status.

Dry-run is enabled by default. Use a dry run first, inspect `oldRemType`, `newRemType`, `wouldChange`, and `warnings`,
then call again with `dryRun: false` and `expectedOldRemType` when the preview matches your intent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | Rem ID to update |
| `isDocument` | boolean | Yes | Desired document status |
| `dryRun` | boolean | No | Preview without mutation (default: `true`) |
| `expectedOldRemType` | string | No | Stale-context guard: `document`, `dailyDocument`, `concept`, `descriptor`, `portal`, or `text` |

**Preview marking a concept as a document:**
```
remnote_set_document_status({ "remId": "abc123", "isDocument": true })
```

**Apply after preview:**
```
remnote_set_document_status({
  "remId": "abc123",
  "isDocument": true,
  "dryRun": false,
  "expectedOldRemType": "concept"
})
```

After a successful write, `remnote_read_note` should report `remType: "document"` for the same Rem ID. Existing card
metadata may still appear through fields such as `cardDirection`.

## remnote_list_children

List direct children under a parent without rendering a whole subtree. Use this for cheap hierarchy traversal before
deepening selected branches with `remnote_read_note`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentRemId` | string | Yes | Parent Rem ID |
| `limit` | number | No | Maximum direct children (1-150, default: 50) |
| `cursor` | string | No | Opaque cursor from a previous page |
| `view` | string | No | `compact` (default), `standard`, or `full` |
| `ancestorDepth` | number | No | Number of parent Rems to include for each child, direct parent first |

## remnote_move_note

Move an existing Rem and its whole subtree under a new parent. The tool defaults to `dryRun: true`; rerun with
`dryRun: false` only after the proposed move is approved. Pass `expectedOldParentRemId` when the move was proposed from
a previous read so stale hierarchy context is rejected.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | Rem ID to move |
| `newParentRemId` | string | Yes | New parent Rem ID |
| `position` | `"first" \| "last" \| "before" \| "after"` | No | Placement under the new parent (default: `last`) |
| `siblingRemId` | string | For `before`/`after` | Sibling Rem ID used for relative placement |
| `dryRun` | boolean | No | Preview only by default |
| `expectedOldParentRemId` | string | No | Reject if the current direct parent differs |
| `ancestorDepth` | number | No | Number of parent Rems to include before/after the move |

## remnote_insert_children

Insert new child Rems under a parent without replacing existing children.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentRemId` | string | Yes | Parent Rem ID |
| `content` | string | Yes | Markdown content to insert as child Rems; supports `[[id:<remId>]]` |
| `position` | `"first" \| "last" \| "before" \| "after"` | Yes | Insert position |
| `siblingRemId` | string | For `before`/`after` | Sibling Rem ID to insert before or after |

Use this for tag description nodes, for example:

```
Insert under tag cEZH8DJYED3RQIB7k at first:
description: Use for Codex app/CLI/skills/ExecPlans notes.
```

Use `[[id:<remId>]]` inside inserted markdown to create exact inline references without name lookup.

## remnote_replace_children

Replace all direct children under a parent Rem. This is destructive because existing child Rem IDs are removed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentRemId` | string | Yes | Parent Rem ID whose direct children will be replaced |
| `content` | string | Yes | Markdown replacement content; empty string clears direct children; supports `[[id:<remId>]]` |

Bridge policy can reject this tool when `acceptReplaceOperation=false`.

## remnote_update_tags

Add or remove tags using exact tag Rem IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | Rem ID whose tags should change |
| `addTagRemIds` | string[] | No | Exact tag Rem IDs to add |
| `removeTagRemIds` | string[] | No | Exact tag Rem IDs to remove |

Use this for production tagging workflows. Name-based tag mutation is intentionally absent from the write tool surface
because same-name Rems can exist in different branches.

## remnote_set_property

Set or clear a tag/table property value on a Rem using exact IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `remId` | string | Yes | Rem ID whose property value should change |
| `tagRemId` | string | Yes | Exact tag/table Rem ID that owns the property |
| `propertyRemId` | string | Yes | Exact property Rem ID under the tag/table Rem |
| `value` | object | Yes | `{ kind: "text", text }`, `{ kind: "rem_reference", remId }`, or `{ kind: "clear" }` |

The bridge verifies that `propertyRemId` is a property child of `tagRemId`, adds the tag idempotently to `remId`, and
then writes the property value. For single-select and multi-select properties, pass the option Rem ID through
`value.kind: "rem_reference"`. Text values also support `[[id:<remId>]]` for exact inline references.

Examples:

```json
{
  "remId": "targetRemId",
  "tagRemId": "nounTypeTagRemId",
  "propertyRemId": "nounUseContextPropertyRemId",
  "value": { "kind": "rem_reference", "remId": "peopleOptionRemId" }
}
```

```json
{
  "remId": "targetRemId",
  "tagRemId": "tagRemId",
  "propertyRemId": "propertyRemId",
  "value": { "kind": "clear" }
}
```

## remnote_append_journal

Append content to today's daily document in RemNote with optional exact tag Rem IDs.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Content to append to today's daily document; supports `[[id:<remId>]]` |
| `timestamp` | boolean | No | Include timestamp (default: true) |
| `tagRemIds` | string[] | No | Exact tag Rem IDs to apply |

### Usage

**Add journal entry:**
```
Add to my journal: "Completed the MCP integration today"
```

**Add without timestamp:**
```
Add to my journal without timestamp: "Project milestone reached"
```

**Add with tag Rem IDs:**
```
Add to my journal with tagRemIds ["dailyLogTagRemId"]: "Completed the MCP integration today"
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
- Use `[[id:<remId>]]` for exact inline references to existing Rems.
- Great for logging daily activities, thoughts, or progress notes

## remnote_read_table

Read an Advanced Table by exact title or Rem ID and return structured column and row data.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tableTitle` | string | Conditionally | Exact Advanced Table title |
| `tableRemId` | string | Conditionally | Table Rem ID |
| `limit` | number | No | Maximum rows to return (1-150, default: 50) |
| `offset` | number | No | Zero-based row offset for pagination (default: 0) |
| `propertyFilter` | string[] | No | Only include these property/column names |

Provide exactly one of `tableTitle` or `tableRemId`.

### Usage

**Read a table by name:**
```
Read the RemNote table "Projects"
```

**Read a table by Rem ID:**
```
Use remnote_read_table with tableRemId "abc123def"
```

**Limit rows for a large table:**
```
Read the first 10 rows from table "Projects"
```

**Filter to selected columns:**
```
Read table "Projects" but only return the columns "Status" and "Owner"
```

Returns the table identity, column schema, row values keyed by `propertyId`, and pagination metadata:

```json
{
  "tableId": "abc123def",
  "tableName": "Projects",
  "columns": [
    { "propertyId": "prop1", "name": "Status", "type": "single_select" }
  ],
  "rows": [
    {
      "remId": "row1",
      "name": "Project Alpha",
      "values": { "prop1": "In Progress" }
    }
  ],
  "totalRows": 12,
  "rowsReturned": 1
}
```

### Tips

- Prefer table Rem IDs when you need deterministic lookup across renamed tables.
- Use `propertyFilter` to reduce payload size for wide tables.
- Use `limit` and `offset` together for incremental reads of large tables.

## remnote_get_playbook

Return a compact operational playbook for MCP agents.

Use this tool when an agent needs built-in guidance for:

- status-first session preflight recommendations,
- hierarchy traversal presets for whole-KB navigation,
- tag navigation vs strict direct-tag verification guidance,
- scoped branch search with `remnote_search.parentRemId`,
- `markdown` vs `structured` content-mode decisions,
- write/replace/document-status safety checks.
- exact inline Rem reference writes with `[[id:<remId>]]`.

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
- Search paging guidance - continue `remnote_search` / `remnote_search_by_tag` with `nextCursor` while `hasMore` is
  true.
- Scoped search guidance - pass `parentRemId` to `remnote_search` when searching inside a known branch; reuse the same
  `parentRemId` with `nextCursor`.
- `remnote_search_by_tag` guidance - when to use default context results, `matchedRems`, `resultMode: "tagged"`, or a
  bounded `timeoutMs` fallback.
- `writePolicy` - how to interpret `acceptWriteOperations` / `acceptReplaceOperation`, document-status writes,
  exact-ID tag writes, exact inline references, and property writes.
- `currentStatus` - live `remnote_status` snapshot when available.

### Tips

- Treat this as guidance, not rigid policy.
- Use the playbook's write guidance to choose between metadata updates, ordered child insertion, destructive replacement,
  document-status writes, exact-ID tag writes, exact inline references, and property writes without overloading
  `remnote_update_note`.
- Call `remnote_status` once per session (recommended) and before high-risk writes.
- For whole-KB orientation, start shallow and ID-first:
  - `structured` mode, `depth: 1`, `childLimit: 500`.

## remnote_status

Check connection status, compatibility warnings, and write-policy settings.

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

Returns connection health and write-policy settings:

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
- Check before write operations when safety settings matter
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
| "Search for Y" | `remnote_search` |
| "Show me note abc123" | `remnote_read_note` |
| "Add Z to note def456" | `remnote_insert_children` |
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
3. `remnote_insert_children` - Insert completed items

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
- Use `tagRemIds` for exact tag assignment; name-based tag mutation is intentionally avoided in production writes
- Set parent relationships to maintain organization

### Searching

- Start with broad searches, then refine
- Use `contentMode: "none"` for title-only searches (faster)
- Use `contentMode: "markdown"` or `"structured"` when you need content analysis
- Increase `limit` for comprehensive searches

### Reading Notes

- Use appropriate `depth` based on hierarchy complexity
- Lower depths are faster for shallow structures
- Higher depths capture more context for nested content

### Updating Notes

- Use descriptive titles after renaming
- Use `remnote_update_tags` with exact tag Rem IDs for tag changes
- Use `remnote_insert_children` for additive content and `remnote_replace_children` only when destructive replacement is explicitly intended

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
