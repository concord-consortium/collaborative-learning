# Future Dev Tooling Notes

Early notes about larger investments in developer tooling that came up during GD-6 testing. At this point these feel necessary to complete robust group document support — without them it will be too hard to track progress and to create reproducible cases for the issues we're finding. More progress on the plan may prove that wrong. The same tooling is also useful for CLUE work beyond group documents.

The items below are not scoped. They're meant as reference material when discussing this with other developers, and as a bookmark if this work is paused and picked up later.

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

## Deterministic Cypress/Playwright tests for collaborative editing

Without automated tests for the collaborative scenarios we're fixing, regressions are almost certain. We need a deterministic pattern for driving two (or more) simulated clients through the scenarios described in `group-docs-potential-ui-issues.md` and `group-docs-current-state.md`.

Ideally the test system also tracks progress through the work:
- The **default/automated build** runs only tests for scenarios we've actually implemented fixes for, so it stays green.
- A **separate status build** runs all tests — including ones for scenarios not yet addressed — to show progress toward full coverage.

Tests would be labeled so results can be sliced by dimension. Labels are not yet decided but possibilities include:
- Category: "component state sync", "unhandled conflict", etc.
- Tile affected: table, text, drawing, etc.

This infrastructure is needed beyond group-docs work — collaborative editing is one of the harder things to test by hand, and the same multi-client determinism helps elsewhere in CLUE.
