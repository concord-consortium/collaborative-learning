# CLUE-686: Graph It on the default Dataflow toolbar

**Status:** approved for planning
**Jira:** CLUE-686, in epic CLUE-544 (Pedagogical AI)

## Goal

A Dataflow tile's default toolbar offers "Graph It!" beside "Table It!", so a unit that wants both
export buttons no longer needs a custom toolbar to get them.

## What is there now

Most of this story is already done. The default in `src/clue/app-config.json` reads:

```json
[["data-set-view", "Table"], ["data-set-link", "Graph"], "delete", "group", "ungroup",
 "|", "zoom-in", "zoom-out", "fit-all", "pan"]
```

`["data-set-view", "Table"]` is "Table It!" and has been the default since before this story was
filed. The gap is the Graph entry, which is `data-set-link` rather than `data-set-view`:

- **`DataSetViewButton`** creates the tile immediately and links the data to it.
- **`DataSetLinkButton`** opens a dialog, from which a student can make a new graph, clear the link,
  or link to a graph that already exists.

They are drawn with the same icon and the same `ViewBadgeIcon`, and both take their tooltip from
`getTileCreateActionName`, so both read "… It!". A student therefore sees two buttons that look
alike, one of which acts and one of which opens a dialog. Dataflow is the only tile whose default
uses `data-set-link` at all.

**The evidence for what was wanted is in the curriculum.** The `vibe` unit overrides the Dataflow
toolbar with exactly `[["data-set-view", "Table"], ["data-set-view", "Graph"], "delete"]` — a custom
toolbar whose purpose is the immediate Graph button the default lacks. That is the override this
story exists to make unnecessary.

## The change

One entry in `src/clue/app-config.json`:

```json
["data-set-view", "Graph"]
```

in place of `["data-set-link", "Graph"]`.

`data-set-link` stays registered in `dataflow-toolbar-registration.tsx` and stays documented, so a
unit that wants the dialog can still configure it. Only the default moves.

## What is lost, and what is not

The dialog did three things. What happens to each:

- **Creating a new graph** — unchanged in substance; the new button does it in one click instead of
  through a menu.
- **Unlinking** — the Graph tile's own layer legend carries an unlink button
  (`handleRemoveIconClick` in `layer-legend.tsx` removes the shared dataset layer), so a student can
  still undo the link from the graph.
- **Linking into a graph that already exists** — this one genuinely goes. Accepted: it is the
  uncommon case, and a unit that needs it can still configure `data-set-link`.

## Two buttons of the same kind have to be tellable apart

`TileToolbarButton` builds its class as `classNames("toolbar-button", name, ...)`, and `name` is
`desc[0]` from the toolbar config — so an entry's tile-type argument never reaches the DOM. Both of
Dataflow's export buttons would render as `.toolbar-button.data-set-view`, and Cypress's
`clickToolbarButton` asserts exactly one match:

```js
cy.get(`... .toolbar-button.${buttonName}`).should('have.length', 1)
```

That breaks the *table* half of the existing spec as well as the graph half, and Timeline — which
already ships three `data-set-view` buttons — has the same latent problem.

`TileToolbarButton` cannot fix this itself: it never sees the args. So it gains an optional
`extraClass`, and `DataSetViewButton`, which does know its tile type, passes
`` `${name}-${newTileType}` ``. A button then carries both classes:

```
toolbar-button  data-set-view  data-set-view-Graph
```

Existing selectors matching `.data-set-view` keep working — `TableToolTile.js` and
`shared_dataset_spec.js` both rely on that — and each button becomes individually addressable. No
stylesheet keys on these classes, so nothing visual moves.

`DataSetLinkButton` is deliberately left alone: nothing needs to address it individually today, and
it is no longer on any default toolbar.

## Documentation

`docs/unit-configuration.md` lists Dataflow's defaults explicitly and names
`["data-set-link", "Graph"]` among them; that list changes. Its "Supports" list keeps both buttons,
because both remain configurable. CLAUDE.md requires this doc to move in the same change as the
setting it describes.

## Testing

The Dataflow specs address the two export buttons by their qualified classes, `data-set-view-Table`
and `data-set-view-Graph`, so each click names the button it means.

`cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js` drives the whole
dialog flow from the toolbar: create through "New Graph", unlink through "Clear It!", then relink to
the existing graph. With the default changed, that button is not on the toolbar, so the test is
rewritten rather than repointed — to the flow a student will actually have:

- Create the graph with the new immediate button, and keep the existing assertions that the graph
  appears, carries the program as its layer name, takes the right axis attributes and draws a dot.
  Keep the `docEditor.hideReadOnlyPanes()` call and the FIXME above it: it works around a graph bug
  that appears when a read-only view of the same document is open, and has nothing to do with which
  button opened the graph.
- Unlink from the graph's own legend button, keeping the assertions that the layer name and the dot
  go away.
- Drop the relink-to-existing step, because that path is no longer in the default toolbar.

That removes Dataflow's coverage of the link dialog. The dialog itself stays covered through the
Table tile, whose `link-graph` button drives the same machinery in `table_tool_spec.js`, so it is
not left untested.

The table half of the same spec is untouched: it already clicks `data-set-view`, which does not
change.

## Out of scope

- **`vibe`'s custom Dataflow toolbar** in the clue-curriculum repo becomes unnecessary once this
  lands. That is a different repository and a separate change; it is flagged, not made here.
- **Giving `data-set-link` its own badge** so it reads as "link to an existing one" rather than
  "make one". The two buttons being indistinguishable is a real confusion, but fixing it is an icon
  design change that needs the designer, and a larger story than this.
