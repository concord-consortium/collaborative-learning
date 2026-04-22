# CLUE-316 Manual Test Scripts

Pause/resume scripts to exercise the inconsistency-risk cases documented in
`docs/superpowers/specs/2026-04-22-merge-independent-forks-design.md`. All scripts
use two CLUE clients (two browser profiles or two incognito windows) opened to the
same group document, and the pause/resume upload controls in the history-view debug
panel (GD-3).

For each script, "expected outcome" describes what the scope-based merge *should*
produce. "Bad-state signal" describes what misbehavior would look like if the
merged state is inconsistent — this is what we're watching for.

## 1. Cross-scope reference drift (drawing → variable)

**Setup:** Group document with a drawing tile and a text tile that share variables
(shared variables shared model). Text tile has a variable V1. Drawing tile is empty.

**Script:**
1. Pause user A's uploads.
2. User A: in the drawing tile, insert a reference to variable V1.
3. User B: in the text tile, delete variable V1.
4. Resume user A's uploads.

**Expected outcome (merge):** Drawing tile's reference addition is preserved (it
touches `tile:<drawing>`), text tile's variable deletion is preserved (it touches
`shared:<SharedVariables>` and `tile:<text>`). Scopes are disjoint.

**Bad-state signal:** Drawing tile throws when rendering (unresolved reference),
or shows an empty/placeholder variable that should not exist.

## 2. Cross-scope reference drift (graph → dataset attribute)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: in the graph tile, assign a different attribute to the Y axis.
3. User B: in the table tile (or via the dataset), delete the attribute user A
   is about to target.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change and shared dataset change are on
disjoint scopes (`tile:<graph>` vs `shared:<dataset>`). Merge proceeds.

**Bad-state signal:** Graph throws an exception rendering an axis bound to a
missing attribute id, or silently draws nothing.

## 3. Schema-assumption drift (table column type)

**Setup:** Group document with a table tile; one column currently typed as number.

**Script:**
1. Pause user A's uploads.
2. User A: set a cell-level formatting or tile-level setting that assumes the
   numeric type.
3. User B: change the column's type to string in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Tile formatting change (`tile:<table>`) and dataset
type change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Table renders cells with the numeric formatting applied to
string values, or throws when formatting.

## 4. Computed-state drift (graph axis bounds vs dataset rows)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: adjust the graph's axis bounds to fit the current dataset.
3. User B: add rows to the dataset that fall well outside those bounds.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change (`tile:<graph>`) and dataset row
change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Graph axis bounds clip new data points silently; this is
more of a "stale state" than a crash — note whether it confuses users rather than
breaks the app.

## 5. Stale shared-model snapshot in tile state (data card selection)

**Setup:** Group document with a data-card tile.

**Script:**
1. Pause user A's uploads.
2. User A: interact with the data card to change its selected case / pagination
   state (anything cached on the tile model, not in the shared dataset).
3. User B: delete or reorder cases in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Disjoint scopes, merge proceeds.

**Bad-state signal:** Data card shows a case that no longer exists, jumps to an
unexpected case, or throws when rendering the selection.

## Reporting

For each script, record in the PR or follow-up ticket:
- Did the bad-state signal appear?
- Is the resulting document recoverable by refreshing / reopening?
- Does the browser console show an exception?

Scripts where the bad-state signal appears are candidates for GD-10 or GD-11
follow-up work. Scripts where nothing bad happens in practice validate that the
scope-based merge is safe enough for this feature.
