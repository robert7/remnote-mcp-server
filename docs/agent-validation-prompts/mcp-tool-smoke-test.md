# MCP Tool Smoke Test

I want to validate my installed RemNote MCP setup through this AI agent.

Use only the RemNote MCP tools exposed by this agent or MCP client. Tool names may include client-specific prefixes or
namespace wrappers; map them to the canonical RemNote MCP tool names below.

Do not use `remnote-cli`, shell commands, direct HTTP calls, browser automation, or any workaround outside the MCP tools.

## Required MCP Tools

This smoke test requires:

- `remnote_status`
- `remnote_get_playbook`
- `remnote_search`
- `remnote_create_note`
- `remnote_read_note`
- `remnote_get_media`
- `remnote_list_children`
- `remnote_update_note`
- `remnote_set_document_status`
- `remnote_move_note`
- `remnote_insert_children`
- `remnote_update_tags`
- `remnote_search_by_tag`
- `remnote_append_journal`
- `remnote_read_table`
- `remnote_set_property`

Optional/report-only tools:

- `remnote_replace_children`

If your client can inspect the available tool list, check it first. If not, continue and report any missing tool when a
required call fails.

## Required Persistent Fixtures

- Exactly one property-bearing table/tag titled `Automation Bridge Advanced Table`, with a numeric property named
  `Salary` and at least two named rows containing finite numeric `Salary` values. Empty or unrelated extra rows are
  allowed. A document titled `Automation Bridge Test Advanced Table` may wrap or display this table but is optional and
  is not the fixture.
- Exactly one property-bearing tag titled `Automation Bridge Test Tag`, with a text-compatible property named
  `automation-level`.
- Exactly one flashcard with the plain-text front `Automation Bridge Test Media` and at least one locally imported
  RemNote-managed image on its back. The front must remain text-only for stable exact-title lookup.

Resolve all three by exact title and derive all Rem, property, field, and media IDs. Do not ask the user to provide IDs.

## Test Flow

1. Call `remnote_status`.
   - If the RemNote MCP namespace is unavailable, stop and report that the MCP tools are missing.
   - If `connected` is not `true`, stop and report the status result.
   - If `acceptWriteOperations` is not `true`, stop and report that write tools are disabled.

2. Call `remnote_get_playbook` and briefly confirm that it returned guidance.
   - Confirm the playbook mentions tag navigation or strict tag verification through `resultMode` or `matchedRems`.
   - Confirm the playbook mentions scoped branch search through `parentRemId`.
   - Confirm the playbook mentions `ancestorDepth`, `remnote_list_children`, and dry-run-first `remnote_move_note`.
   - Confirm the playbook mentions dry-run-first `remnote_set_document_status`.
   - Confirm the playbook mentions setting tag/table property values with `remnote_set_property`.
   - Confirm the playbook mentions exact inline Rem references with `[[id:<remId>]]`.
   - Confirm the playbook describes managed-image retrieval and real alias writes.

3. Resolve the shared temporary integration-test root.
   - Search for the exact title `RemNote Automation Bridge [temporary integration test data]`.
   - Search for the exact title `remnote-integration-root-anchor`.
   - If multiple exact root-title matches exist, stop and report the duplicate root Rem IDs.
   - If multiple exact root-anchor tag matches exist, stop and report the duplicate tag Rem IDs.
   - If the root-anchor tag does not exist, create a note titled `remnote-integration-root-anchor` and keep its Rem ID.
   - If the root note does not exist, create a note titled `RemNote Automation Bridge [temporary integration test data]`
     with `tagRemIds` containing the root-anchor tag Rem ID.
   - Keep the root note Rem ID for the remaining steps.

4. Create a test run note under the root note.
   - Title: `[MCP-AGENT-TEST] Tool smoke test <current ISO timestamp>`
   - Content: short text stating the agent/client name if known and the timestamp
   - Aliases: one whitespace-padded Latin alias and one Unicode alias
   - Keep the created run note Rem ID.

5. Search for the exact run-note title with `remnote_search`, scoped with `parentRemId` set to the root note Rem ID,
   and confirm the created run note appears.

6. Read the run note with `remnote_read_note`.
   - Use `contentMode="structured"` when available.
   - Use `ancestorDepth=5` on at least one read or search and confirm `ancestors` is parent-first when present.
   - Confirm the title and parent context are consistent with the root note.
   - Confirm `aliases` contains normalized values and preserves the Unicode alias.
   - If `inlineRefs` appears on the note or structured children, confirm each item includes `text`, `targetRemId`, and
     `kind: "rem"`.
   - Dry-run `remnote_set_document_status` on the run note with `isDocument: true` and `expectedOldRemType` set to the
     current `remType`; confirm `dryRun` is true and the same Rem ID is returned.

7. Rename the run note with `remnote_update_note`.
   - New title: `[MCP-AGENT-TEST] Tool smoke test updated <current ISO timestamp> [[id:<root note Rem ID>]]`
   - Read it again with `contentMode="structured"` and `view="full"`.
   - Confirm the updated title.
   - Confirm `inlineRefs` includes an item with `targetRemId` equal to the root note Rem ID and `kind: "rem"`.
   - Add a new alias and remove the original Latin alias without changing the Unicode alias.
   - Repeat the addition, read again, and confirm it remains idempotent with no duplicate alias.

8. Insert children under the run note with `remnote_insert_children`.
   - Insert at least two children, for example:
     - `status: created by MCP agent validation [[id:<root note Rem ID>]]`
     - `timestamp: <current ISO timestamp>`
   - Keep one inserted direct-child Rem ID from the response as `moveCandidateRemId`.
   - Read the run note again with structured content and `view="full"`.
   - Confirm the inserted children are present.
   - Confirm a structured child has `inlineRefs` containing `targetRemId` equal to the root note Rem ID.

9. List direct children of the run note with `remnote_list_children`.
   - Confirm only direct children are returned.
   - Confirm `moveCandidateRemId` appears as a direct child.
   - If `hasMore` is true, report the `nextCursor`.

10. Dry-run a move with `remnote_move_note`.
   - Use `remId: moveCandidateRemId`, `newParentRemId: <root note Rem ID>`, `dryRun: true`, and
     `expectedOldParentRemId: <run note Rem ID>`.
   - Confirm the response previews old/new parent data.
   - Read or list the run note again and confirm `moveCandidateRemId` is still a direct child, proving dry-run did not
     change the Rem parent.

Search for the normalized exact title `Automation Bridge Advanced Table`. Ignore the optional
`Automation Bridge Test Advanced Table` wrapper/document and stop only for missing or duplicate exact table fixtures.
Read the single table match with `remnote_read_table` first by `tableTitle` and then by its derived `tableRemId`. Confirm
it has a numeric `Salary` column and at least two named rows with finite numeric values, tolerating unrelated or empty
extra rows. Use `propertyFilter: ["Salary"]`, `limit`, and `offset` to verify filtering and pagination without relying on
a configured Rem ID.

Search for the exact title `Automation Bridge Test Media`. Stop and report missing or duplicate fixtures. Read the
single match with `includeMediaMetadata=true`, select its first ordered RemNote-managed local image, and call
`remnote_get_media` with the derived `remId`, `field`, and `mediaId`. Confirm the result contains MCP-native image
content and matching structured metadata.

11. Create a test tag note under the same root note.
   - Title: `[MCP-AGENT-TEST] tag <current ISO timestamp>`
   - Keep its Rem ID as `testTagRemId`.

12. Add the test tag to the run note with `remnote_update_tags`.
    - Use `addTagRemIds: [testTagRemId]`.
    - Read the run note and confirm the tag appears if tag metadata is returned.

13. Search by the test tag with `remnote_search_by_tag` in navigation mode.
    - Use `tagRemId: testTagRemId`.
    - Omit `resultMode` or use `resultMode: "context"`.
    - Confirm a result appears for the run note or its resolved ancestor context.
    - Confirm that at least one result has `matchedRems` containing the exact run note Rem ID.

14. Search by the test tag with `remnote_search_by_tag` in strict verification mode.
    - Use `tagRemId: testTagRemId`.
    - Use `resultMode: "tagged"`.
    - Confirm the exact run note Rem ID appears as a top-level result.
    - Confirm the result includes context metadata (`contextRemId`, `contextTitle`, and `contextReason`) when returned
      by the server.

15. Remove the test tag from the run note with `remnote_update_tags`.
    - Use `removeTagRemIds: [testTagRemId]`.
    - Search by the test tag again in context mode and confirm `matchedRems` no longer contains the run note Rem ID.
    - Search by the test tag again with `resultMode: "tagged"` and confirm the run note Rem ID is no longer returned as
      a top-level result.

16. Append a journal entry with `remnote_append_journal`.
    - Content: `[MCP-AGENT-TEST] Journal smoke test <current ISO timestamp> [[id:<run note Rem ID>]]`
    - Use the test tag Rem ID as `tagRemIds` if the tool supports journal tag IDs in this client.
    - Read the created journal Rem with `contentMode="structured"` and `view="full"`.
    - Confirm `inlineRefs` includes an item with `targetRemId` equal to the run note Rem ID.

17. Validate property writes with `remnote_set_property`.
    - Search for the exact title `Automation Bridge Test Tag`.
    - If multiple exact matches exist, stop and report the duplicate tag Rem IDs.
    - If no exact match exists, report FAIL for property-write validation because the fixture tag is missing.
    - Keep the exact tag Rem ID as `propertyFixtureTagRemId`.
    - Read the fixture tag/table schema with `remnote_read_table`, using `tableRemId: propertyFixtureTagRemId`.
    - Find a column whose exact name is `automation-level`.
    - If the property is missing, report FAIL for property-write validation because the fixture property is missing.
    - Keep that column's `propertyId` as `automationLevelPropertyRemId`.
    - Generate a unique random text prefix such as `mcp-smoke-<current ISO timestamp>-<short random suffix>`.
    - Set `automationLevelValue` to `<that prefix> [[id:<root note Rem ID>]]`.
    - Call `remnote_set_property`:
      - `remId: <run note Rem ID>`
      - `tagRemId: propertyFixtureTagRemId`
      - `propertyRemId: automationLevelPropertyRemId`
      - `value: { "kind": "text", "text": automationLevelValue }`
    - Confirm the response returns the same `remId`, `tagRemId`, and `propertyRemId`, plus `valueKind: "text"`.
    - Read the fixture tag/table again with `remnote_read_table`, using:
      - `tableRemId: propertyFixtureTagRemId`
      - `propertyFilter: ["automation-level"]`
    - If needed, page with `offset`/`limit` until all returned rows have been checked.
    - Confirm a row with the exact run note Rem ID appears and that its `automation-level` value equals the generated
      prefix followed by the rendered root-note reference, for example
      `<prefix> [[RemNote Automation Bridge [temporary integration test data]]]`.
    - Do not clear the property. The kept value is part of the validation artifact.

18. Optional/report-only checks:
    - If `remnote_replace_children` is available and `remnote_status.acceptReplaceOperation` is `true`, report that
      destructive replacement is enabled.
    - If destructive validation is explicitly approved, call `remnote_replace_children` on the run note with content
      containing `[[id:<root note Rem ID>]]`, then read the replacement child with `contentMode="structured"` and
      `view="full"` and confirm `inlineRefs.targetRemId` equals the root note Rem ID.
    - Read the run note with `view="full"` immediately before and after replacement and confirm its Rem ID, title,
      aliases, Rem type, tags, and parent are unchanged.
    - Do not call `remnote_replace_children` unless destructive validation is explicitly approved.

19. Final response:
    - Report PASS or FAIL.
    - Include the root note Rem ID, run note Rem ID, and test tag Rem ID if created.
    - Include the Advanced Table Rem ID, `propertyFixtureTagRemId`, `automationLevelPropertyRemId`, and the kept
      `automationLevelValue`.
    - List every required tool and whether it was used successfully.
    - List optional/report-only tools and why they were skipped or not available.
    - Mention that artifacts, including the note carrying the kept `automation-level` value, can be cleaned up by
      searching RemNote for `[MCP-AGENT-TEST]`.
