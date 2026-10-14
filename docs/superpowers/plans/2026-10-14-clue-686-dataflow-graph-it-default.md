# CLUE-686 Graph It on the Default Dataflow Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Dataflow tile's default toolbar offers "Graph It!" beside "Table It!", so a unit wanting both export buttons no longer needs a custom toolbar.

**Architecture:** One entry in the app config changes from `data-set-link` to `data-set-view`, so the Graph button creates a graph immediately instead of opening a link dialog. `data-set-link` stays registered and documented, so a unit can still configure the dialog; only the default moves. The authoring doc and the one Cypress test that drives the dialog off the toolbar move with it.

**Tech Stack:** JSON app config, Cypress.

**Spec:** `docs/superpowers/specs/2026-10-14-clue-686-dataflow-graph-it-default-design.md`

---

## What this does and does not touch

No TypeScript changes. `DataSetViewButton`, `DataSetLinkButton` and
`dataflow-toolbar-registration.tsx` are all unchanged — the button being swapped is already
registered and already used by other tiles' defaults.

The Cypress spec runs against `src/public/demo/units/qa-config-subtabs/content.json`, which has no
`dataflow` config of its own, so it picks up the app-config default. That is why changing the
default breaks it, and why the test is part of this change rather than incidental to it.

## File Structure

**Modify**
- `src/clue/app-config.json` — the one default-toolbar entry.
- `docs/unit-configuration.md` — the Dataflow "Defaults" list.
- `cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js` — the graph
  half of the first test, rewritten to the new flow.

---

## Task 1: Swap the default Graph button

**Files:**
- Modify: `src/clue/app-config.json`

- [ ] **Step 1: See what the default is now**

Run:
```bash
python3 -c "import json; print(json.load(open('src/clue/app-config.json'))['config']['settings']['dataflow']['tools'])"
```
Expected, exactly:
```
[['data-set-view', 'Table'], ['data-set-link', 'Graph'], 'delete', 'group', 'ungroup', '|', 'zoom-in', 'zoom-out', 'fit-all', 'pan']
```

If it differs, stop: master has moved under this plan and the spec needs rechecking.

- [ ] **Step 2: Change the entry**

In `src/clue/app-config.json`, inside `config.settings.dataflow.tools`, change:

```json
          ["data-set-link", "Graph"],
```

to:

```json
          ["data-set-view", "Graph"],
```

Change nothing else. Do not reformat the file — it is hand-maintained JSON and a reformat would
bury a one-line change in hundreds.

- [ ] **Step 3: Confirm the diff is one line**

Run: `git diff --stat src/clue/app-config.json`
Expected: `1 file changed, 1 insertion(+), 1 deletion(-)`

Run: `python3 -c "import json; json.load(open('src/clue/app-config.json')); print('valid JSON')"`
Expected: `valid JSON`

- [ ] **Step 4: Commit**

```bash
git add src/clue/app-config.json
git commit -m "Put Graph It on the default Dataflow toolbar [CLUE-686]"
```

---

## Task 2: Update the authoring doc

**Files:**
- Modify: `docs/unit-configuration.md`

CLAUDE.md requires this doc to move in the same change as the setting it documents.

- [ ] **Step 1: Update the Defaults list**

In the `#### Dataflow` section, under `Defaults:`, change the line:

```markdown
- `["data-set-link", "Graph"]`
```

to:

```markdown
- `["data-set-view", "Graph"]`
```

- [ ] **Step 2: Note that the dialog is still available**

In the same section's `Supports:` list, leave both bullets in place and extend the `data-set-link`
one so an author can tell why they might still want it:

```markdown
- `data-set-link`: Bring up a dialog to choose a tile to link to (or create a new one). Not in the
  default toolbar; configure it explicitly for a unit where students need to link data into a tile
  that already exists.
```

- [ ] **Step 3: Check the two lists now agree with the config**

Run:
```bash
grep -A 14 "^Defaults:" docs/unit-configuration.md | head -14
python3 -c "import json; print(json.load(open('src/clue/app-config.json'))['config']['settings']['dataflow']['tools'])"
```
Expected: the doc's Defaults list names the same buttons, in the same order, as the config.

Note `grep -A 14 "^Defaults:"` matches the first `Defaults:` in the file, which may belong to
another tile. If so, open the file and read the `#### Dataflow` section directly instead.

- [ ] **Step 4: Commit**

```bash
git add docs/unit-configuration.md
git commit -m "Document the Dataflow toolbar default [CLUE-686]"
```

---

## Task 3: Rewrite the graph half of the Cypress test

**Files:**
- Modify: `cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js`

The first test, "Data is shared properly with tables and graphs", drives the link dialog from the
toolbar three times: create a graph, clear the link, relink to the existing graph. The button it
clicks is no longer on the default toolbar.

The table half of the same test clicks `data-set-view` and is unaffected. Leave it alone.

- [ ] **Step 1: Watch it fail against the new default**

Start the dev server if it is not already running, and wait for a clean build:

```bash
npm start
```

Wait for `webpack ... compiled successfully` and confirm no `ERROR in` lines. A stale bundle makes
every Cypress spec fail misleadingly.

Run:
```bash
env -u ELECTRON_RUN_AS_NODE npx cypress run \
  --spec "cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js" \
  --config "video=false"
```
Expected: the first test FAILS, unable to find the `data-set-link` toolbar button. The second test
("verify the effect of page reload...") passes — it only uses `data-set-view`.

- [ ] **Step 2: Replace the three dialog blocks**

In the first test, replace the block that begins with this line:

```js
    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select("New Graph");
```

and runs to the end of the `it` block, whose last statements are:

```js
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Graph It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

  });
```

That whole span — three toolbar clicks and their dialog interactions — becomes:

```js
    clueCanvas.clickToolbarButton("dataflow", "data-set-view");
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

    cy.log("unlink the program from the graph");

    // The dialog's "Clear It!" is no longer on the Dataflow toolbar; the graph carries its own
    // unlink button on the layer legend, which is the path a student now has.
    graphTile.getLayerDeleteButton().click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("not.exist");
    graphTile.getGraphDot().should("not.exist");
  });
```

Keep the two lines above it exactly as they are — the FIXME and the `hideReadOnlyPanes()` call work
around a graph bug that appears when a read-only view of the same document is open, and have
nothing to do with which button opens the graph:

```js
    // FIXME: there is a bug in the graph that shows up when a readOnly view of the same document
    // is open. For now we close the readOnly views first.
    docEditor.hideReadOnlyPanes();
```

The relink-to-existing step goes with the rest: that path is no longer reachable from the default
toolbar.

- [ ] **Step 3: Drop the now-unused import**

`tableTile` is still used by the table half of both tests (`checkEmptyLinkedTable` and
`checkLinkedTableRecordedData` take it as an argument), so leave its import and `let` alone.

Confirm nothing became unused:

Run: `npm run lint:build 2>&1 | grep -E "dataflow_table_graph"`
Expected: no output. If an unused-variable warning names this file, remove what it names.

- [ ] **Step 4: Run the spec**

Run:
```bash
env -u ELECTRON_RUN_AS_NODE npx cypress run \
  --spec "cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js" \
  --config "video=false"
```
Expected: both tests PASS.

- [ ] **Step 5: Prove the test still covers the link, not just the button**

Temporarily comment out the `clickToolbarButton("dataflow", "data-set-view")` line added in Step 2
and re-run. The test must fail on the graph assertions that follow it. Restore the line afterwards.

Comment the line out rather than pointing it at another button: clicking a disabled or unrelated
button fails for its own reasons, which would look like a pass of this check without being one.

This guards against a rewrite that only proves a button exists. The assertions have to depend on the
graph actually receiving the program's data.

- [ ] **Step 6: Commit**

```bash
git add cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js
git commit -m "Exercise the Dataflow graph button students now have [CLUE-686]"
```

---

## Task 4: Verify the branch

- [ ] **Step 1: Run the unit tests**

Run: `npx jest --silent 2>&1 | tail -5`
Expected: 0 failures. Nothing in this change touches code under test, so a failure here means
something unexpected.

- [ ] **Step 2: Type-check**

Run: `npm run check:types`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npm run lint:build 2>&1 | grep -E "^✖"`
Expected: `0 errors` on every line. Warnings already in the tree are fine.

- [ ] **Step 4: Run the Dataflow Cypress specs**

The toolbar default affects every Dataflow spec, not only the one rewritten above.

Run:
```bash
env -u ELECTRON_RUN_AS_NODE npx cypress run \
  --spec "cypress/e2e/functional/tile_tests/dataflow_tool_spec.js,cypress/e2e/functional/tile_tests/dataflow_tile_keyboard_spec.js,cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js" \
  --config "video=false"
```
Expected: all PASS. If a spec counts toolbar buttons or indexes into them, the swap keeps the count
the same, so a failure there means it asserted on the button's identity and needs the same
treatment as Task 3.

- [ ] **Step 5: Self-review the diff**

Use the `code-self-review` skill over `git diff master...HEAD`.

- [ ] **Step 6: Check it by hand on localhost**

The point of the story is what a student sees, and no test asserts on a tooltip.

Open a unit with a Dataflow tile, add one, and confirm:

- The toolbar shows two export buttons, reading "Table It!" and "Graph It!".
- "Graph It!" creates a graph immediately, with no dialog.
- The new graph carries the program's data, and its legend shows an unlink button.

Run: `npm start`, and confirm the dev server reports 0 compile errors before judging anything.

- [ ] **Step 7: Push and open the PR**

Do not push until the hand-check passes and the user has confirmed.

---

## Notes carried from the spec

- **`data-set-link` is not removed**, only demoted. It stays registered in
  `dataflow-toolbar-registration.tsx` and documented, so a unit can configure the dialog.
- **Unlinking survives** on the Graph tile's own layer legend; only "link into a graph that already
  exists" leaves the Dataflow toolbar.
- **The link dialog stays tested** through the Table tile's `link-graph` button in
  `table_tool_spec.js`, so dropping Dataflow's dialog coverage does not leave it untested.
- **`vibe`'s custom Dataflow toolbar** in the clue-curriculum repo becomes unnecessary once this
  lands. Different repository, separate change — flag it, do not make it here.
