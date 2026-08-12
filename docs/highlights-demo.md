# Authoring a document that demonstrates highlights

This is the *demo* side of the highlight system: how to build a document in which a user can
drive a highlight by hand. For the contract a tile implements to become a highlight source or
target, see [highlights.md](highlights.md) — nothing here is needed to add a new tile.

Everything below is about the **variable chip**, which is currently the only way a *user* can
author a reference to an object in another tile. That makes it the only way to demonstrate the
feature before AI-emitted references exist, and it is scaffolding rather than the destination —
see the note on reference kinds in [highlights.md](highlights.md).

`src/public/demo/docs/emg-highlight-demo.json` is the worked example, and the fixture for
`cypress/e2e/functional/tile_tests/highlight_references_spec.js`.

It carries a Sketch tile holding two variable chips — one for EMG, one for Gripper. The second is
load-bearing rather than decorative: the feature exists to direct attention to one specific thing,
so a reference that lit *every* variable chip would be a failure rather than an enhancement, and
asserting the Gripper chip stays dark is what proves it discriminates.

## Three preconditions gate the variable-chip toolbar buttons

None are obvious, and all three must hold or the buttons are absent or disabled:

1. **The plugin must be loaded.** `shared-variables-registration.ts` is only imported when a
   **Dataflow, Diagram, or Simulator** tile type is registered (`src/register-tile-types.ts`).
   Registering `Text` alone does not pull it in.
2. **The unit must enable the buttons.** `new-variable` / `insert-variable` / `edit-variable`
   appear only if the unit lists them in `settings.text.tools`; the app default in
   `src/clue/app-config.json` does not. Units that do: `demo/units/qa`, `qa-variables`,
   `qa-no-group-share`, `qa-no-nav-panel`, and `curriculum/dataflow/dataflow-example.json`.
3. **A SharedVariables must already exist.** The text tile never creates one — it auto-attaches
   to whatever the document has. So the document needs a Simulator (or Diagram/Drawing) tile as
   the variable source.

`insert-variable` is a picker over the document's existing variables, so a student can point a
chip at a simulation variable without authoring anything.

## Authored chips round-trip

Which is what makes a deterministic test fixture possible:

```html
<p>Watch this signal drive your program:
   <span data-slate-type="m2s-variable" data-slate-reference="c9561nuH0CdjytQd"></span></p>
```

The attribute names come from `src/components/tiles/text/plugins/chip-serialization.ts`.
Authored variable ids are **stable, not runtime-random**: `Variable.id` defaults to a nanoid,
but the simulator looks variables up by `name` first and only mints an id when none is found.
So a document shipping its own `SharedVariables` snapshot keeps the ids it declares, and a chip
can reference them by hand.
