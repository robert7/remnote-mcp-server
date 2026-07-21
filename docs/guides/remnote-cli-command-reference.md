# remnote-cli Command Reference

`remnote-cli` is automation-first: JSON is the default output mode. Use `--text` for human-readable output.

## Invocation

```bash
remnote-cli [global-options] <command> [command-options]
```

Most commands require a running `remnote-mcp-server`:

```bash
remnote-mcp-server
```

Bridge actions (`create`, `search`, `search-by-tag`, `read`, `get-media`, `list-children`, `move-note`, `update`,
`set-document-status`, `insert-children`, `replace-children`, `update-tags`, `set-property`, `journal`, `read-table`,
`status`) also require RemNote with the RemNote Automation Bridge plugin connected to that MCP server.

## Global Options

| Flag              | Default                         | Description                         |
| ----------------- | ------------------------------- | ----------------------------------- |
| `--json`          | enabled                         | JSON output mode                    |
| `--text`          | off                             | Human-readable output mode          |
| `--mcp-url <url>` | `http://127.0.0.1:3001/mcp`     | MCP server URL                      |
| `--verbose`       | off                             | Reserved for verbose stderr logging |
| `--version`       | n/a                             | Show CLI version                    |
| `--help`          | n/a                             | Show help                           |

### Output mode rules

- JSON is the default when no output flag is provided.
- If both `--json` and `--text` are passed, `--text` wins.

### Argument Quoting and Shifting

CLI environments (especially Windows shells) can sometimes "swallow" empty strings or misinterpret arguments if quoting is missing. This can lead to **argument shifting**, where a flag (like `--content`) is incorrectly interpreted as the _value_ for a preceding option (like `--title`).

To prevent this:

1. **Always quote** text values that contain spaces or special characters.
2. **Use explicit equality** for potentially empty values: `--title=""`.
3. `remnote-cli` includes **shifting detection**: if an option value matches a registered global or local flag, the command will fail early with an error message to prevent accidental mis-execution.

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | Generic command/action error            |
| `2`  | MCP server not running / unreachable    |
| `3`  | Reserved for bridge-not-connected flows |

## create

Create a new RemNote note or a hierarchical tree.

```bash
remnote-cli create [title] [options]
```

| Option                  | Default | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| `--title <text>`        | none    | Note title                                           |
| `-c, --content <text>`  | none    | Initial content (markdown supported)                 |
| `--content-file <path>` | none    | Read initial content from UTF-8 file (`-` for stdin) |
| `--parent-id <id>`      | none    | Parent Rem ID                                        |
| `--tag-ids <id...>`     | none    | Exact tag Rem IDs to add                             |
| `--as-document`         | false   | Mark the created title/root Rem as a document        |
| `--aliases <text...>`   | none    | Real aliases to add to the explicit title/root Rem   |

Behavior rules:

- `title` and `content` are both optional, but **at least one must be provided**.
- Title input support positional `[title]` (backward-compatible) and `--title <text>`.
- Title and content input support `[[id:<remId>]]` for exact inline references to existing Rems.
- Content input from `-c`/`--content`/`--content-file` supports RemNote's native markdown syntax for creating nested hierarchies and flashcards inline.
- `--content` and `--content-file` are mutually exclusive.
- Content loaded from file/stdin is passed verbatim (no templating/interpolation).
- Write content from `--content-file` and stdin is capped at 100 KB.
- If `parent-id` is not provided, the note will be created under the default root rem in the setting.
- Tag Rem IDs are applied only to the top-level Rems created. Tag names are not accepted.
- `--as-document` requires a title/root Rem and preserves any flashcard/concept status created by markdown syntax.
- `--aliases` requires a title. Values are whitespace-normalized and deduplicated; matches to the primary title are
  ignored while Unicode and case are preserved.

Examples:

```bash
# Simple note with title only, either by positional argument or --title option, create under default root rem
remnote-cli create "Meeting Notes"
remnote-cli create --title "Meeting Notes"

# Create a new note under a specific parent rem id
remnote-cli create --title "Meeting Notes" --parent-id <parent-rem-id>

# Create a new note with title, content, and exact tag Rem IDs
remnote-cli create --title "Project Plan" --content "Phase 1" --tag-ids <tag-rem-id>

# Create content that links to an existing Rem by exact ID
remnote-cli create --title "Compound" --content "Component [[id:<component-rem-id>]]"

# Create a title/root Rem as a document
remnote-cli create --title "Project Plan" --content "Phase 1" --as-document

# Create real aliases on the title/root Rem
remnote-cli create --title "The Shop on Main Street" --aliases "Obchod na korze"

# Create a new note with markdown content directly under parent rem id
# Note: if the content is in markdown format, --content/--content-file must be used to avoid misinterpretation of the content as command options
remnote-cli create --content "- Item 1\n  - Item 2" --parent-id <parent-rem-id>

# Flashcards
remnote-cli create --title "Photosynthesis" --content "Front :: Back"

# Hierarchical tree from file or from parsed markdown
remnote-cli create --title "Biology Terms" --content-file /tmp/biology.md
remnote-cli create --title "Biology Terms" --content "# Terms 1\n- Item 1\n  - Item 2"
```

## search

Search notes by text query.

```bash
remnote-cli search <query> [options]
```

Shared options for `search` and `search-by-tag`:

| Option                     | Default | Description                          |
| -------------------------- | ------- | ------------------------------------ |
| `-l, --limit <n>`          | `50`    | Maximum number of results            |
| `--content-mode <mode>`    | `none`  | `none`, `markdown`, or `structured`  |
| `--view <view>`            | default | `compact`, `standard`, or `full`     |
| `--ancestor-depth <n>`     | `0`     | Parent Rems to include, parent-first |
| `--depth <n>`              | `1`     | Child depth for rendered content     |
| `--child-limit <n>`        | `20`    | Max children per hierarchy level     |
| `--max-content-length <n>` | `3000`  | Max rendered content character count |

`search` also supports:

| Option              | Default | Description                                      |
| ------------------- | ------- | ------------------------------------------------ |
| `--parent-id <id>`  | none    | Non-empty parent Rem ID to scope search within its subtree |
| `--cursor <cursor>` | n/a     | Opaque cursor from a previous `search` response  |

Behavior rules:

- In `--text` mode, each line includes headline/title and Rem ID.
- JSON output preserves paging metadata (`hasMore`, `nextCursor`, `truncated`, and `truncationReason`).
- In `--text` mode, `nextCursor` is printed after results when another page is available.
- Tags are shown in `--text` mode when the bridge returns them as `[tags: tag1 [tagRemId1], tag2 [tagRemId2]]`.
- Parent context is appended in text output when available as `<- Parent Title [parentRemId]`.
- Ancestors are appended when `--ancestor-depth` is used.
- `--depth`, `--child-limit`, and `--max-content-length` are most relevant when content rendering is enabled.
- `tags` is optional and present when the matched Rem has readable tag identity metadata. JSON output preserves
  `{ tagRemId, name }` objects.
- `--cursor` is bound to the specific search `query` and `--parent-id`. A cursor must be reused with the exact same query and parameters, and cannot be reused across different queries or scopes.

Examples:

```bash
remnote-cli search "meeting"
remnote-cli search "weekly" --limit 10 --content-mode structured --depth 2 --child-limit 10 --text
remnote-cli search "weekly" --limit 10 --cursor "search:v1:..."
remnote-cli search "meeting" --limit 10 --parent-id <parent-rem-id>
remnote-cli search "meeting" --limit 10 --parent-id <parent-rem-id> --cursor "search:v1:..."
```

## search-by-tag

Search notes by exact tag Rem ID (ancestor-context aware).

```bash
remnote-cli search-by-tag --tag-id <tag-rem-id> [options]
```

Options and output/content controls are identical to `search`
(`-l/--limit`, `--content-mode`, `--view`, `--ancestor-depth`, `--depth`, `--child-limit`,
`--max-content-length`).
Use `--result-mode tagged` to return directly tagged Rems instead of the default ancestor-context results.
Use `--cursor <cursor>` to continue a previous search-by-tag page. Use `--timeout-ms <ms>` to extend the bridge wait
timeout for a slow tag call (max 60000 ms); this does not cancel plugin-side work.

`--tag-id` is the exact Rem ID of the tag Rem. Tag names, `#name` inputs, and aliases are not accepted; exact IDs avoid
ambiguity from duplicate names, renamed tags, and aliases.

Examples:

```bash
remnote-cli search-by-tag --tag-id <tag-rem-id>
remnote-cli search-by-tag --tag-id <tag-rem-id> --result-mode tagged
remnote-cli search-by-tag --tag-id <tag-rem-id> --limit 10 --cursor "search_by_tag:v1:..."
remnote-cli search-by-tag --tag-id <tag-rem-id> --content-mode markdown --depth 2 --text
```

## read

Read one note by Rem ID.

```bash
remnote-cli read <rem-id> [options]
```

| Option                     | Default    | Description                          |
| -------------------------- | ---------- | ------------------------------------ |
| `-d, --depth <n>`          | `5`        | Child depth to render                |
| `--content-mode <mode>`    | `markdown` | `markdown`, `structured`, or `none`  |
| `--view <view>`            | default    | `compact`, `standard`, or `full`     |
| `--ancestor-depth <n>`     | `0`        | Parent Rems to include, parent-first |
| `--child-limit <n>`        | `100`      | Max children per hierarchy level     |
| `--max-content-length <n>` | `100000`   | Max rendered content character count |
| `--include-media-metadata` | false      | Include root image IDs for get-media |

Behavior rules:

- `--text` mode prints metadata when present: title/headline, ID, type, parent, aliases, tags, card direction, and content
  stats.
- If `content` exists, it is printed after a blank line.
- In structured mode, use JSON output (default) to preserve `contentStructured` rem IDs and child hierarchy.
- `--content-mode none` suppresses rendered content.
- `tags` is optional and present when the returned Rem has readable tag identity metadata. JSON output preserves
  `{ tagRemId, name }` objects.

Examples:

```bash
remnote-cli read abc123def
remnote-cli read abc123def --content-mode none --depth 2 --child-limit 30 --max-content-length 5000 --text
remnote-cli read abc123def --content-mode structured --depth 2 --child-limit 30
```

## get-media

Save one RemNote-managed image to a local file:

```bash
remnote-cli get-media <rem-id> --field <text|backText> --media-id <id> --output <path>
```

Discover the required IDs with `remnote-cli read <rem-id> --include-media-metadata`. Existing destinations are
protected; pass `--force` only when overwriting is intentional. `--max-inline-bytes` can lower or raise the per-call
limit up to the server's 10 MiB hard maximum. JSON/text output reports metadata and the absolute saved path, never the
base64 payload.

## read-table

Read one Advanced Table by exact title or Rem ID.

```bash
remnote-cli read-table (--title <title> | --rem-id <id>) [options]
```

| Option                     | Default | Description                               |
| -------------------------- | ------- | ----------------------------------------- |
| `--title <title>`          | none    | Exact Advanced Table title                |
| `--rem-id <id>`            | none    | Table Rem ID                              |
| `-l, --limit <n>`          | `50`    | Maximum rows to return                    |
| `--offset <n>`             | `0`     | Zero-based row offset                     |
| `-p, --properties <names>` | none    | Comma-separated property names to include |

Behavior rules:

- Provide exactly one of `--title` or `--rem-id`.
- JSON output includes `tableId`, `tableName`, `columns`, `rows`, `totalRows`, and `rowsReturned`.
- In `--text` mode, output prints table identity, column schema, and a simple row grid.
- `--properties` filters returned columns by property name before rows are formatted.
- Use `--limit` and `--offset` together for incremental reads of large tables.

Examples:

```bash
remnote-cli read-table --title "Projects"
remnote-cli read-table --rem-id abc123def --limit 10
remnote-cli read-table --title "Projects" --properties "Status,Owner" --text
```

## update

Update note metadata.

```bash
remnote-cli update <rem-id> [options]
```

| Option                       | Default | Description                                                  |
| ---------------------------- | ------- | ------------------------------------------------------------ |
| `--title <text>`             | none    | Replace title/headline; supports `[[id:<remId>]]`             |
| `--add-aliases <text...>`    | none    | Add real aliases if not already present                       |
| `--remove-aliases <text...>` | none    | Remove aliases by exact whitespace-normalized, case-sensitive match |

At least one update option is required. Alias additions/removals are idempotent, and the same normalized alias cannot
be requested in both operations.

Use the dedicated commands below for child content and tag writes.

Examples:

```bash
remnote-cli update abc123def --title "Updated Title"
remnote-cli update abc123def --title "See also [[id:<target-rem-id>]]"
remnote-cli update abc123def --add-aliases "Original Title" --remove-aliases "Old Title"
```

## set-document-status

Preview or set document status on an existing Rem. The command is a dry-run unless `--apply` is provided. Concept/card
status is preserved.

```bash
remnote-cli set-document-status <rem-id> --document
remnote-cli set-document-status <rem-id> --document --expected-old-rem-type concept --apply
remnote-cli set-document-status <rem-id> --no-document --apply
```

| Option                          | Default | Description                                                   |
| ------------------------------- | ------- | ------------------------------------------------------------- |
| `--document`                    | none    | Mark the Rem as a document                                    |
| `--no-document`                 | none    | Remove document status from the Rem                           |
| `--apply`                       | false   | Perform the change instead of dry-run preview                 |
| `--expected-old-rem-type <type>` | none    | Reject stale context before changing document status          |

Accepted `--expected-old-rem-type` values: `document`, `dailyDocument`, `concept`, `descriptor`, `portal`, `text`.

## list-children

List direct children under a parent without rendering a whole subtree.

```bash
remnote-cli list-children <parent-rem-id> --limit 50 --ancestor-depth 1
```

| Option                 | Default | Description                                  |
| ---------------------- | ------- | -------------------------------------------- |
| `--limit <n>`          | `50`    | Maximum direct children                      |
| `--cursor <cursor>`    | none    | Continue a previous page                     |
| `--view <view>`        | compact | `compact`, `standard`, or `full`             |
| `--ancestor-depth <n>` | `0`     | Parent Rems to include for each child        |

## insert-children

Insert child Rems under a parent at an explicit position.

```bash
remnote-cli insert-children <parent-rem-id> --content <text> --position <first|last|before|after>
```

| Option                    | Default | Description                                      |
| ------------------------- | ------- | ------------------------------------------------ |
| `--content <text>`        | none    | Content to insert                                |
| `--content-file <path>`   | none    | Read inserted content from UTF-8 file (`-` stdin) |
| `--position <position>`   | none    | `first`, `last`, `before`, or `after`             |
| `--sibling-rem-id <id>`   | none    | Required for `before` and `after`                 |

Examples:

```bash
remnote-cli insert-children cEZH8DJYED3RQIB7k --content "description: Use for Codex app/CLI/skills/ExecPlans notes." --position first
remnote-cli insert-children cEZH8DJYED3RQIB7k --content "Related [[id:<target-rem-id>]]" --position last
remnote-cli insert-children cEZH8DJYED3RQIB7k --content-file /tmp/child.md --position before --sibling-rem-id abc123def
```

## move-note

Move an existing Rem and its subtree under a new parent. The command is a dry-run unless `--apply` is provided.

```bash
remnote-cli move-note <rem-id> --new-parent-rem-id <parent-rem-id>
remnote-cli move-note <rem-id> --new-parent-rem-id <parent-rem-id> --expected-old-parent-rem-id <old-parent-rem-id> --apply
```

| Option                         | Default | Description                                  |
| ------------------------------ | ------- | -------------------------------------------- |
| `--new-parent-rem-id <id>`     | none    | New parent Rem ID                            |
| `--position <position>`        | `last`  | `first`, `last`, `before`, or `after`        |
| `--sibling-rem-id <id>`        | none    | Required for `before` and `after`            |
| `--apply`                      | false   | Perform the move instead of dry-run preview  |
| `--expected-old-parent-rem-id` | none    | Reject stale parent context before moving    |
| `--ancestor-depth <n>`         | `0`     | Parent Rems to include before/after the move |

## replace-children

Replace all direct content child Rems under a parent while preserving parent identity, title, aliases, document status,
tags, and properties. This is destructive for existing content-child Rem IDs and can be blocked by bridge policy.

```bash
remnote-cli replace-children <parent-rem-id> --content-file <path>
```

| Option                  | Default | Description                                                                      |
| ----------------------- | ------- | -------------------------------------------------------------------------------- |
| `--content <text>`      | none    | Replacement content                                                              |
| `--content-file <path>` | none    | Read replacement content from UTF-8 file (`-` stdin; empty file clears content children) |

Replacement content supports `[[id:<remId>]]` for exact inline references to existing Rems.

## update-tags

Add or remove tags by exact tag Rem ID.

```bash
remnote-cli update-tags <rem-id> --add-tag-ids <tag-rem-id...>
```

| Option                          | Default | Description              |
| ------------------------------- | ------- | ------------------------ |
| `--add-tag-ids <tag-rem-id...>`    | none    | Exact tag Rem IDs to add |
| `--remove-tag-ids <tag-rem-id...>` | none    | Exact tag Rem IDs to remove |

Use exact IDs for production tagging workflows. Name-based tag mutation is intentionally not exposed.

## set-property

Set or clear a tag/table property value by exact IDs.

```bash
remnote-cli set-property <rem-id> --tag-id <tag-rem-id> --property-id <property-rem-id> (--value <text> | --rem-reference-id <id> | --clear)
```

| Option                    | Default | Description                                           |
| ------------------------- | ------- | ----------------------------------------------------- |
| `--tag-id <id>`           | none    | Exact tag/table Rem ID that owns the property         |
| `--property-id <id>`      | none    | Exact property Rem ID under the tag/table Rem         |
| `--value <text>`          | none    | Set a plain text or markdown property value           |
| `--rem-reference-id <id>` | none    | Set a Rem reference value; use select option IDs here |
| `--clear`                 | false   | Clear the property value                              |

Examples:

```bash
remnote-cli set-property abc123def --tag-id tag123 --property-id prop123 --value "People" --text
remnote-cli set-property abc123def --tag-id tag123 --property-id prop123 --value "See [[id:<target-rem-id>]]" --text
remnote-cli set-property abc123def --tag-id tag123 --property-id prop123 --rem-reference-id option123 --text
remnote-cli set-property abc123def --tag-id tag123 --property-id prop123 --clear --text
```

## journal

Append to today's daily document.

```bash
remnote-cli journal [content] [options]
```

| Option                  | Default           | Description                                        |
| ----------------------- | ----------------- | -------------------------------------------------- |
| `--content <text>`      | none              | Journal entry content                              |
| `--content-file <path>` | none              | Read journal entry from UTF-8 file (`-` for stdin) |
| `--tag-ids <id...>`     | none              | Exact tag Rem IDs to add                           |
| `--no-timestamp`        | timestamp enabled | Disable `[HH:MM:SS]` prefix                        |

Behavior rules:

- Provide exactly one content source:
  - positional `[content]` (backward-compatible)
  - `--content <text>`
  - `--content-file <path|->`
- Content input from `--content`/`--content-file` supports RemNote's native markdown syntax for creating nested hierarchies and flashcards inline.
- Journal content supports `[[id:<remId>]]` for exact inline references to existing Rems.
- `--tag-ids` applies exact tag Rem IDs to the created journal entry root/top-level Rems. Tag names are not accepted.

Examples:

```bash
remnote-cli journal "Finished sprint review"
remnote-cli journal --content "Quick thought" --no-timestamp --tag-ids <tag-rem-id> --text
remnote-cli journal --content-file /tmp/entry.md --text
cat /tmp/entry.md | remnote-cli journal --content-file - --text
```

## status

Check bridge connection state.

```bash
remnote-cli status
```

Behavior rules:

- Calls the MCP server `remnote_status` tool and reports bridge connectivity.
- JSON output includes bridge write-policy flags when available:
  - `acceptWriteOperations`
  - `acceptReplaceOperation`
- In text mode, output includes:
  - bridge connection status
  - plugin version when provided
  - CLI version when provided
  - compatibility warning (`version_warning`) when provided
- Returns exit code `2` when the MCP server is unreachable.

Examples:

```bash
remnote-cli status
remnote-cli --mcp-url http://127.0.0.1:3005/mcp status --text
```
