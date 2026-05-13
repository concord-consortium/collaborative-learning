# SharedDataSet — Test Scripts

Scripts exercising concurrent-edit cases involving the SharedDataSet shared model. Tiles that use SharedDataSet: table, graph, data card, geometry, bar graph, dataflow.

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## ✅🧟 1. Cross-scope reference drift (graph → dataset attribute)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: in the graph tile, assign a different attribute to the Y axis.
3. User B: in the table tile (or via the dataset), delete the attribute user A is about to target.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change and shared dataset change are on disjoint scopes (`tile:<graph>` vs `shared:<dataset>`). Merge proceeds.

**Bad-state signal:** Graph throws an exception rendering an axis bound to a missing attribute id, or silently draws nothing.

**Observed results (2026-04-24):**

No visible error. The graph's Y series goes blank and the points disappear. No console messages. The saved document still contains the deleted attribute id in the graph's `_yAttributeDescriptions`.

The silent blanking is intentional tolerance built into the graph tile:

- `AttributeDescription.attributeID` is declared as a plain `types.string` at [src/plugins/graph/models/data-configuration-model.ts:20-30](../../../src/plugins/graph/models/data-configuration-model.ts#L20-L30) — not a `types.reference`, so MST never attempts resolution and cannot throw an unresolved-reference error (contrast with the diagram tile in [shared-variables.md script 2](shared-variables.md)).
- Rendering goes through `DataSet.getNumeric()`, which returns `undefined` when the attribute id is missing from `attrIDMap`. At [src/plugins/graph/components/scatterdots.tsx:128](../../../src/plugins/graph/components/scatterdots.tsx#L128), `undefined ?? NaN` feeds `yScale(NaN)` → invisible points, no error.

A pruning handler exists but does not fire for this merge case:

- [src/plugins/graph/models/data-configuration-model.ts:921-935](../../../src/plugins/graph/models/data-configuration-model.ts#L921-L935) — `handleDatasetRemoveAttributeAction` removes the stale entry from `_yAttributeDescriptions` when it sees a `removeAttribute` action.
- It is registered via `onAnyAction(self.dataset, self.handleAction)` at [src/plugins/graph/models/data-configuration-model.ts:765](../../../src/plugins/graph/models/data-configuration-model.ts#L765), which only observes MST action calls on this client's dataset instance. Remote attribute deletes arrive as applied patches through the tree-patch manager, not as action calls, so the handler never runs and the stale id persists in the saved document.

**Tracked in:** [CLUE-514](https://concord-consortium.atlassian.net/browse/CLUE-514) (nice to have).

## 📈 2. Schema-assumption drift (table column type)

**Status (2026-04-24): not reproducible in CLUE today — no user-facing path to change an attribute's type on the shared dataset.**

CLUE's `Attribute` model infers its `type` from its values; the `userType` override that CODAP uses is commented out ([src/models/data/attribute.ts:28](../../../src/models/data/attribute.ts#L28), type getter at [lines 73–77](../../../src/models/data/attribute.ts#L73-L77)). The table tile's column-header menu only offers sort and remove — no "set type" option ([src/components/tiles/table/column-header-cell.tsx](../../../src/components/tiles/table/column-header-cell.tsx)). The graph tile's "Treat as Numeric/Categorical" menu ([axis-or-legend-attribute-menu.tsx:155–158](../../../src/plugins/graph/imports/components/axis/components/axis-or-legend-attribute-menu.tsx#L155-L158)) writes to the graph's own `_yAttributeDescriptions[n].type` ([data-configuration-model.ts:880](../../../src/plugins/graph/models/data-configuration-model.ts#L880)), which is graph-local state, not a shared-dataset mutation.

Leaving this case in the script as a placeholder: if CLUE later exposes an attribute-level type override (or we simulate one via a test hook), the intended merge scenario is:

**Script (hypothetical):**
1. Pause user A's uploads.
2. User A: set a cell-level formatting or tile-level setting that assumes the numeric type.
3. User B: change the column's type to string in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Tile formatting change (`tile:<table>`) and dataset type change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Table renders cells with the numeric formatting applied to string values, or throws when formatting.

## 🐛 3. Computed-state drift (graph axis bounds vs dataset rows)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: adjust the graph's axis bounds to fit the current dataset.
3. User B: add rows to the dataset that fall well outside those bounds.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change (`tile:<graph>`) and dataset row change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Graph axis bounds clip new data points silently; this is more of a "stale state" than a crash — note whether it confuses users rather than breaks the app.

**Observed results (2026-04-26):**

Bad-state signal no longer reproduces. The second batch's `{ shared:<dataset>, tile:<graph> }` scope is now correctly checked against user A's pending axis entries; those entries are reverted, and user B's auto-expanded bounds survive on user A's screen. Both the drag case and the edit-max case behave the same way.

This script is what originally surfaced the subsequent-batch fork-detection bug — the scope check was correct, but it wasn't running on batch 2. Mechanism and fix: [docs/superpowers/specs/2026-04-24-fork-detection-rollback-recording-design.md](../../superpowers/specs/2026-04-24-fork-detection-rollback-recording-design.md).

Entry-shape details (still accurate; preserved as reference):

- **Row add (user B):** adding a new row is a two-step interaction — first the row is added (`Table.addCanonicalCases` entry, scope `{ shared:<dataset> }`), then a cell is filled in which completes the datapoint and triggers the graph's autoscale in the same action (`Table.setCanonicalCaseValues` entry, scope `{ shared:<dataset>, tile:<graph> }`). These two entries arrive on user A as **separate batches** — confirmed by watching the history view, where `addCanonicalCases` shows up first and `setCanonicalCaseValues` arrives later when the second cell is filled in.
- **Manual axis, drag (user A):** dragging emits multiple `NumericAxis.setDomain` entries, each with scope `{ tile:<graph> }`.
- **Manual axis, edit max label (user A):** clicking the max label and typing a new value emits one `NumericAxis.setMax` entry, same scope `{ tile:<graph> }`.

Relevant code:

- Scope computation: [src/models/history/entry-scopes.ts:10-35](../../../src/models/history/entry-scopes.ts#L10-L35) (tile and shared scope keys derived from patch paths).
- Axis actions: [src/plugins/graph/imports/components/axis/models/axis-model.ts:82-107](../../../src/plugins/graph/imports/components/axis/models/axis-model.ts#L82-L107) (`setMin`, `setMax`, `setDomain` all mutate the same numeric axis model — patch paths land under the graph tile, not the shared dataset).

## ✅ 4. Stale shared-model snapshot in tile state (data card selection)

**Setup:** Group document with a data-card tile.

**Script:**
1. Pause user A's uploads.
2. User A: interact with the data card to change its selected case / pagination state (anything cached on the tile model, not in the shared dataset).
3. User B: delete or reorder cases in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Disjoint scopes, merge proceeds.

**Bad-state signal:** Data card shows a case that no longer exists, jumps to an unexpected case, or throws when rendering the selection.

**Observed results (2026-04-26):**

No bad-state signal. The data card tracks the selected case by index, not by reference, and tolerates an out-of-range index gracefully. After user B deletes the underlying case, user A's card simply renders whatever case now occupies that index — the same behavior a single user sees when deleting a case in a non-collaborative document.
