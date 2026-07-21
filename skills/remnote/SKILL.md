---
name: remnote
description: Search, read, and write RemNote notes and personal knowledge base content via `remnote-cli`. Use for note-taking, journaling, tags, tables, and knowledge-base navigation; require `confirm write` before mutating commands.
homepage: https://github.com/robert7/remnote-mcp-server
metadata:
  {
    "openclaw":
      {
        "emoji": "🌀",
        "requires": { "bins": ["remnote-cli"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "remnote-mcp-server",
              "bins": ["remnote-cli"],
              "label": "Install remnote-mcp-server (npm)",
            },
          ],
      },
  }
---

# RemNote via remnote-cli

Use this skill when a user wants to read or manage RemNote content from the command line with `remnote-cli`.

If the user needs navigation across the whole knowledge base (for example: "where does this topic live in my notes?",
"start from top-level note tree", "map main note groups"), prefer `remnote-kb-navigation` when it is available and
customized for the current user, then return to this skill for general command policy and write gating. If
`remnote-kb-navigation` is not available (or still template/unconfigured), continue with this skill alone and ask for
skill customization when needed.

## Example Conversation Triggers

- "Check if RemNote bridge is connected."
- "Search my RemNote for sprint notes."
- "Find notes tagged with this exact tag Rem ID in RemNote."
- "Read this RemNote by ID: `<rem-id>`."
- "Map the top-level structure of my whole RemNote knowledge base."
- "Create a RemNote note titled X with this content." (requires `confirm write`)
- "Create a RemNote document note titled X with this content." (requires `confirm write`)
- "Mark this existing RemNote note as a document." (requires `confirm write`)
- "Append this to my journal in RemNote." (requires `confirm write`)

## Preconditions (required)

1. RemNote Automation Bridge plugin is installed in RemNote.
2. Plugin install path is one of:
   - Marketplace install guide:
     `https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/install-plugin-via-marketplace-beginner.md`
   - Local dev plugin guide:
     `https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/development-run-plugin-locally.md`
3. `remnote-mcp-server` is installed on the same machine where OpenClaw runs; it provides the `remnote-cli` command.
   - Preferred install: `npm install -g remnote-mcp-server`
4. `remnote-mcp-server` is running or reachable by `REMNOTE_MCP_URL`.
5. RemNote is open in browser/app (`https://www.remnote.com/`).
6. The right-sidebar `MCP` panel is available for status inspection and manual reconnect when needed, but it is not
   required to already be open before commands work.

If any precondition is missing, stop and fix setup first.

## Read-First Safety Policy

- Default to read-only flows: `status`, `search`, `search-by-tag`, `read`, `read-table`.
- Do not run mutating commands by default.
- For writes (`create`, `update`, `set-document-status`, `insert-children`, `replace-children`, `update-tags`,
  `set-property`, `journal`), require the exact phrase `confirm write` from the user in the same turn.
- If `confirm write` is not present, ask for confirmation and do not execute writes.

## Command Invocation Rule (critical)

- Run exactly one `remnote-cli` command per execution.
- Invoke `remnote-cli` directly; do not chain shell commands.
- Do not use `&&`, `|`, `;`, subshells (`(...)`), command substitution (`$()`), `xargs`, or `echo` pipelines.
- WRONG: `remnote-cli status --text && echo '---' && remnote-cli search "topic"`
- RIGHT: `remnote-cli status --text`
- Reason: command chaining can trigger exec approvals and break automation flow.

## Write Payload Rule (allowlist-friendly)

- For write commands, prefer file-based payload flags:
  - `--content-file <path|->` for `create`, `insert-children`, `replace-children`, and `journal`
- Keep executed command strings short and predictable for OpenClaw allowlisting.
- Inline `--content` / positional `journal [content]` / positional `create [title]` are discouraged except for very
  short single-line text.
- With markdown syntax input, all options must use flags to prevent misinterpretation of the content as command options.
- Use `[[id:<remId>]]` inside markdown-capable write text when an inline reference must target an exact existing Rem ID.
- `-` (stdin) is supported but discouraged by default in OpenClaw flows because command context can be less explicit.

## Compatibility Check (mandatory before real work)

1. Check MCP server and bridge connectivity:
   - `remnote-cli status --text`
2. Read versions from `remnote-cli status --text`:
   - active plugin version
   - CLI version
   - `version_warning` (if present)
   - write-policy flags: `acceptWriteOperations`, `acceptReplaceOperation`
3. RemNote-open-first / server-starts-later is supported:
   - the bridge should retry in the background
   - the sidebar panel is optional and mainly useful for monitoring, manual reconnect, and wake-up triggers
4. Enforce version rule: bridge plugin and `remnote-mcp-server` must be the same `0.x` minor line (prefer exact match).
5. If mismatch:
   - Install matching server package version:
     - Exact: `npm install -g remnote-mcp-server@<plugin-version>`
     - Or same minor line (`0.<minor>.x`) when exact is unavailable.
   - Re-run:
     - `remnote-cli --version`
     - `remnote-mcp-server --version`
     - `remnote-cli status --text`

## Core Commands

### Health and Connectivity

- `remnote-cli status --text`
- `remnote-cli --mcp-url http://127.0.0.1:3005/mcp status --text` for non-default MCP server URLs

### Read-Only Operations (default)

- Search notes: `remnote-cli search "query"` (use `--parent-id <parent-rem-id>` to scope search within a Rem's subtree)
- Search by exact tag Rem ID: `remnote-cli search-by-tag --tag-id <tag-rem-id>`
- Read note by Rem ID: `remnote-cli read <rem-id>`
- Discover embedded image IDs: `remnote-cli read <rem-id> --include-media-metadata`
- Save a managed image: `remnote-cli get-media <rem-id> --field <text|backText> --media-id <media-id> --output <path>`
- Read Advanced Table by title or Rem ID:
  - `remnote-cli read-table --title "Projects"`
  - `remnote-cli read-table --rem-id <table-rem-id>`
- Optional text mode: add `--text`

## Output Mode and Traversal Strategy

- Use JSON output (default) for navigation, multi-step retrieval, and any flow that needs IDs for follow-up reads.
- Use `--text` only for plain human summarization of exactly one note when no further navigation is needed.
- Exit code `2` means the MCP server is unreachable or not running.
- For structure traversal, start with shallow reads and high child limit:
  - `remnote-cli read <rem-id> --depth 1 --child-limit 500`
- Increase `--depth`, `--child-limit`, or `--max-content-length` only when the user actually needs more hierarchy or
  rendered content.

### `--include-content` modes

- `--include-content markdown`:
  - Returns readable rendered child content.
  - Best for summarization/presentation.
  - Markdown content does not provide child IDs required for further navigation.
- `--include-content structured`:
  - Returns hierarchical `contentStructured` data including child rem IDs.
  - Best for navigation and deterministic ID-first traversal.

### Mutating Operations (only after `confirm write`)

- Create (preferred): `remnote-cli create "Title" --content-file /tmp/body.md --text`
- Create under a parent or apply tags:
  - `remnote-cli create "Title" --parent-id <rem-id> --tag-ids <tag-rem-id> --text`
- Create the title/root Rem as a document:
  - `remnote-cli create "Title" --content-file /tmp/body.md --as-document --text`
  - `--as-document` requires an explicit title/root Rem and preserves any concept/card status created by markdown
    syntax.
- Create real aliases on the explicit title/root Rem:
  - `remnote-cli create "Title" --aliases "Original Title" "Alternate Title" --text`
- Update title: `remnote-cli update <rem-id> --title "New Title" --text`
  - Titles support `[[id:<remId>]]` for exact inline Rem references.
- Add or remove real aliases without replacing the alias set:
  - `remnote-cli update <rem-id> --add-aliases "New Alias" --remove-aliases "Old Alias" --text`
  - Alias comparison is whitespace-normalized and case-sensitive; additions and removals are idempotent.
- Set document status on an existing Rem (dry-run first):
  - `remnote-cli set-document-status <rem-id> --document --text`
  - Apply after preview:
    `remnote-cli set-document-status <rem-id> --document --expected-old-rem-type concept --apply --text`
  - Use `--no-document` to remove document status; concept/card status is preserved.
- Insert children (preferred for append-like child writes):
  - `remnote-cli insert-children <parent-rem-id> --content-file /tmp/children.md --position last --text`
  - `remnote-cli insert-children <parent-rem-id> --content-file /tmp/children.md --position before --sibling-rem-id <rem-id> --text`
- Update tags by exact tag Rem ID:
  - `remnote-cli update-tags <rem-id> --add-tag-ids <tag-rem-id> --remove-tag-ids <tag-rem-id> --text`
- Set or clear a tag/table property value by exact IDs:
  - `remnote-cli set-property <rem-id> --tag-id <tag-rem-id> --property-id <property-rem-id> --value "People" --text`
  - `remnote-cli set-property <rem-id> --tag-id <tag-rem-id> --property-id <property-rem-id> --rem-reference-id <option-rem-id> --text`
  - `remnote-cli set-property <rem-id> --tag-id <tag-rem-id> --property-id <property-rem-id> --clear --text`
  - For select properties, pass the option Rem ID with `--rem-reference-id`.
  - For inline references inside text values, use `[[id:<remId>]]`.
- Replace direct children (destructive, only with explicit user intent):
  - `remnote-cli replace-children <parent-rem-id> --content-file /tmp/replacement.md --text`
  - Use an empty content file to clear all direct content children; parent metadata is preserved.
- Journal: `remnote-cli journal "Finished task" --text`
- Journal (from file): `remnote-cli journal --content-file /tmp/entry.md --text`
- Journal without timestamp:
  - `remnote-cli journal --content-file /tmp/entry.md --no-timestamp --text`
- Journal with exact-ID tags:
  - `remnote-cli journal --content-file /tmp/entry.md --tag-ids <tag-rem-id> --text`
- Fallbacks (discouraged): inline flags for short single-line text only.
- Safety:
  - Use `insert-children` for additive child writes and `replace-children` only for explicit replacement.
  - Run replace only when `acceptWriteOperations=true` and `acceptReplaceOperation=true` from `status`.
  - Treat replace as destructive for content-child Rem IDs and require the user to clearly request replace semantics;
    parent identity, title, aliases, document status, tags, and properties are preserved.
  - Quote text values with spaces or special characters, and use explicit empty-value syntax like `--title=""` to avoid
    argument shifting.
  - Use `set-document-status` dry-run first and include `--expected-old-rem-type` when applying from a prior read.

## Failure Handling

When a bridge-backed operation fails (`search`, `search-by-tag`, `read`, `read-table`, `create`, `update`,
`set-document-status`, `insert-children`, `replace-children`, `update-tags`, `set-property`, `journal`, `status`), run
this sequence in order:

1. Check bridge status first:
   - `remnote-cli status --text`
2. If `status --text` fails with exit code `2` or says the MCP server is unreachable:
   - start `remnote-mcp-server`
   - re-run `remnote-cli status --text`
3. If `status --text` shows `version_warning`:
   - align the `remnote-mcp-server` package version to the plugin `0.x` minor line
   - restart `remnote-mcp-server`
   - re-run `remnote-cli status --text`
4. If the bridge is disconnected:
   - use the browser tool to ensure `https://www.remnote.com/` is open and reachable
   - re-run `remnote-cli status --text`
   - if needed, wait and retry for up to 30 seconds because the bridge may still be in burst retry or standby retry
5. If the browser tool is unavailable during recovery:
   - do not stop
   - use the OpenClaw-managed browser CLI against profile `openclaw` to try browser-side recovery:
     - `openclaw browser --browser-profile openclaw status`
     - if the CLI is reachable, run:
       - `openclaw browser --browser-profile openclaw stop`
       - `openclaw browser --browser-profile openclaw start`
       - `openclaw browser --browser-profile openclaw open https://www.remnote.com/`
   - after CLI-based browser recovery, re-run `remnote-cli status --text`
   - then retry the original RemNote command if bridge connectivity is restored
   - if the CLI reports browser disabled, bundled browser plugin missing/disabled, or another gateway-level browser
     unavailability state, report that specific browser/runtime condition instead of describing RemNote itself as broken
6. If it is still disconnected:
   - use the browser tool to open the right sidebar and click the `MCP` icon if present
   - opening the panel is itself a wake-up trigger and may restart faster retries
7. Inspect the plugin panel state:
   - `Connected` means retry the CLI command
   - `Connecting` means a connection attempt is in progress; wait briefly, then re-run `remnote-cli status --text`
   - `Retrying` means the burst retry window is active; wait briefly or use `Reconnect Now`
   - `Waiting for server` means standby mode is active; use `Reconnect Now` or another wake-up trigger
8. If the `MCP` icon is missing, report that the plugin UI is not available in RemNote.
9. If the panel is visible but still not connected:
   - capture the visible panel state, disconnect reason, and whether `Reconnect Now` helped
   - report that context to the user before stopping
10. Only after the sequence above fails should you report the command failure as unresolved.

## Operational Notes

- JSON output is default and preferred for automation.
- `--text` is useful for quick human checks.
- Reference command docs when unsure:
  `https://github.com/robert7/remnote-mcp-server/blob/main/docs/guides/remnote-cli-command-reference.md`
