# Group Documents: Manual Test Scripts

Manual reproduction scripts for group-document concurrent-editing cases. Each file groups scripts by the tile or shared model the case is primarily about. Cross-cutting cases (tile lifecycle, sparrows) have their own files.

## Important context

All CLUE tiles render model changes regardless of whether they are in edit or read-only mode, because tiles use MobX `observer()` and react to MST model changes in both modes. The `readOnly` prop only controls whether interactive controls (buttons, inputs, drag handles) are enabled — it does not stop the tile from rendering model updates.

So remote changes from other users **will generally be rendered** in edit mode. However, some tiles have bugs where certain model changes don't trigger UI updates in any mode — for example, the table's column header names are cached in a `useMemo` that doesn't invalidate when attribute names change (this particular example should be fixed now). These bugs affect group documents and single-user undo equally.

Most cases below are about transient UI state (focus, cursor, selection, drag) being disrupted by re-renders, but some are about changes not being rendered due to caching bugs.

Steps in scripts use "User A" and "User B" to describe two users editing the same group document. "Pause/resume" refers to using the pause/resume upload buttons in the history view panel (GD-3), which is enabled by adding "historyView" to the `debug` key in your browser.

Cases marked with **[undo-testable]** can be partially or fully tested with single-user undo, without needing a multi-user setup. Cases marked with **[requires active interaction]** can only be triggered when the user is actively interacting with the tile during the model change, which undo doesn't exercise.

## Related docs

- [group-docs-plan.md § GD-11: Tile Hardening](../group-docs-plan.md#gd-11-tile-hardening-as-needed) — the plan slot these scripts feed into. Findings here drive per-tile prioritization, and concrete bugs surfaced here become Jira stories under GD-11 (e.g., CLUE-512/513/514 for stale shared-model references).
- [group-docs-plan.md § GD-16: E2E Test Framework](../group-docs-plan.md#gd-16-e2e-test-framework) — when GD-16 lands, these manual scripts can be migrated to automated Playwright tests.
- [group-docs-future-dev-tooling.md § Deterministic Playwright tests](../group-docs-future-dev-tooling.md#deterministic-playwright-tests-for-collaborative-editing) — uses this folder as the manual counterpart to the planned automation, and treats the [status emoji](#status-emoji) and `[requires active interaction]` / `[undo-testable]` tags as a first pass at labels for the automated tests.
- [group-docs-completed-work.md § CLUE-483](../group-docs-completed-work.md#clue-483-ui-disruption-testing) — the UI disruption testing pass that produced these scripts.
- [group-docs-tile-resilience-research.md](../group-docs-tile-resilience-research.md) — per-tile risk analysis. The cases here either confirm or refute the predictions in that doc.

### Status emoji

Used in case headings to indicate test status at a glance:

- ❌ confirmed bug, severe / must fix
- 🐛 confirmed bug, but minor or non-blocking
- 🤷 weird but no clear failure / inconclusive
- ✅ visually OK (there still might be console warnings or errors)
- 🚧 not yet tested
- 📈 CODAP issue: issue is in code but the code is only reachable from CODAP UI

Modifier (combines with the status emoji):

- 👥↩️ case involves multi-user undo behavior; relates to [CLUE-517: Undo/Redo (deferred)](../group-docs-plan.md#clue-517-undoredo-deferred)
- ⚠️ console shows warnings or errors
- 💻 console behavior not yet verified
- 🧟 leaves zombie references

## Files

### Per-tile

- [text-tile.md](text-tile.md) — ❌, ❌, ❌
- [table-tile.md](table-tile.md) — ❌, ❌, ❌, ❌, 🐛, 🚧, ✅, ✅💻, ❌, ✅
- [drawing-tile.md](drawing-tile.md) — ✅💻, 🐛⚠️, ❌, 🚧
- [geometry-tile.md](geometry-tile.md) — ✅💻, ❌, 🐛, 🐛👥↩️
- [graph-tile.md](graph-tile.md) — no own cases; see shared-dataset.md
- [diagram-tile.md](diagram-tile.md) — no own cases; see shared-variables.md
- [expression-tile.md](expression-tile.md) — 🐛, 🐛
- [data-card-tile.md](data-card-tile.md) — 🚧, ✅, 🐛, ✅
- [dataflow-tile.md](dataflow-tile.md) — 🚧, ❌, 🚧
- [numberline-tile.md](numberline-tile.md) — 🤷, 🚧
- [simulator-tile.md](simulator-tile.md) — 🚧
- [ai-tile.md](ai-tile.md) — 🚧
- [iframe-tile.md](iframe-tile.md) — 🚧

### Per-shared-model

- [shared-dataset.md](shared-dataset.md) — ✅🧟, 📈, 🐛, ✅
- [shared-variables.md](shared-variables.md) — 🐛⚠️, ❌

### Cross-cutting

- [tile-lifecycle.md](tile-lifecycle.md) — tile add/delete cases — ✅, ❌👥↩️, 🚧
- [sparrows.md](sparrows.md) — annotation cases — 🚧

A related design proposal (not a test script) lives at [../group-docs-coupled-scopes.md](../group-docs-coupled-scopes.md), tracked as [GD-24](../group-docs-plan.md#gd-24-opt-in-coupled-scopes-held-in-reserve).

## Single-person testing of [requires active interaction] cases

The resume button has a 5-second delay before queued changes are actually uploaded, which lets one person run these tests using two browser sessions:

1. As User A: pause uploads.
2. As User A: perform the model change described in the test — it stays local.
3. As User A: click resume. A 5-second countdown starts before the change flushes to Firebase.
4. **Within the 5-second window**: switch to User B's session and start the interaction described (drag, typing, selection, dialog input, etc.).
5. Keep the interaction active past the 5-second mark. User A's change then arrives at User B's session and triggers a re-render while the interaction is in progress.

Steps within scripts say "Within the 5-second window" or "Before User A's change arrives" to refer to step 4.

## Reporting

For each script, record in the PR or follow-up ticket:
- Did the bad-state signal appear?
- Is the resulting document recoverable by refreshing / reopening?
- Does the browser console show any warnings or errors? (Even if the UI looked fine, console messages may indicate underlying problems.)

Scripts where the bad-state signal appears are candidates for [GD-10](../group-docs-plan.md#gd-10-shared-model-merging) or [GD-11](../group-docs-plan.md#gd-11-tile-hardening-as-needed) follow-up work. Scripts where nothing bad happens in practice validate that the scope-based merge is safe enough.
