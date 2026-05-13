# Future Dev Tooling Notes

Early notes about larger investments in developer tooling that came up during GD-6 testing. At this point these feel necessary to complete robust group document support — without them it will be too hard to track progress and to create reproducible cases for the issues we're finding. More progress on the plan may prove that wrong. The same tooling is also useful for CLUE work beyond group documents.

Most of the work below is not in the plan document. They're meant as reference material when discussing this with other developers, and as a bookmark for when the work is picked up later.

## Fork the standalone editor into dev and end-user builds

People have started demoing with the current standalone editor. For demos, the default with both side views visible is unnecessary, and the editor is picking up dev-only features that will make a clean end-user editor harder to maintain over time.

The proposal is to split the `doc-editor` build target into two:
- **Dev editor** — optimized for development and debugging. Includes the features listed in the next section.
- **End-user editor** — stripped down, suitable for demos and whatever end-user authoring use cases emerge.

**Concern**: another webpack entry point slows the build. Before committing, profile the build with and without the split to confirm the cost is acceptable.

## Dev editor feature set

The dev editor should support at least:
- History view
- History replay
- Auto-revert mode (GD-13)
- Side-by-side history debugging (the mode already in use for debugging group docs)
- Rearrangeable panel layout, like VSCode — so a developer can arrange the workspace to match the task

Rearrangeable layout is ambitious, but becomes more valuable as more dev views are added.

## Deterministic Playwright tests for collaborative editing

Without automated tests for the collaborative scenarios we're fixing, regressions are almost certain. The framework itself is tracked as [GD-16: E2E Test Framework](group-docs-plan.md#gd-16-e2e-test-framework) — Playwright supports multiple browser contexts in a single test, each with its own focus state, so tests can drive two (or more) simulated clients through the same scenarios.

The manual counterpart already exists: [test-scripts/](test-scripts/) is a folder of by-hand reproduction scripts for these scenarios, organized per tile and per shared model. As GD-16 lands we should replace as many of those scripts as possible with automated Playwright tests; the manual scripts remain useful for cases the automation can't cover yet (or for one-off debugging).

The test-scripts folder also gives us a first pass at useful tagging and labeling of cases:
- **Status emoji** — confirmed-bug-severe (❌), confirmed-bug-minor (🐛), inconclusive (🤷), visually OK (✅), not yet tested (🚧), CODAP-only (📈). Modifiers cover console warnings (⚠️), unverified console behavior (💻), zombie references (🧟), and multi-user undo (👥↩️). See [test-scripts/README.md § Status emoji](test-scripts/README.md#status-emoji).
- **Interaction requirement** — `[requires active interaction]` vs `[undo-testable]`, indicating whether the case can only be triggered while the user is actively interacting with the tile.
- **File organization** — by tile (text, table, drawing, …) and by shared model (SharedDataSet, SharedVariables), with cross-cutting cases (tile lifecycle, sparrows) in their own files.

Ideally the automated test system also tracks progress through the work:
- The **default/automated build** runs only tests for scenarios we've actually implemented fixes for, so it stays green.
- A **separate status build** runs all tests — including ones for scenarios not yet addressed — to show progress toward full coverage.

Tests would carry the same kind of labels as the manual scripts so results can be sliced by dimension (category like "component state sync" or "unhandled conflict"; tile affected; interaction requirement). Final label set is not yet decided.

This infrastructure is needed beyond group-docs work — collaborative editing is one of the harder things to test by hand, and the same multi-client determinism helps elsewhere in CLUE.
