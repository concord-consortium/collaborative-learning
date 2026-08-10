# Highlights

Highlights let one part of a CLUE document point at objects inside another tile and make them
visually prominent. Hovering a variable chip in a Text tile previews the Dataflow nodes bound
to that variable; clicking pins the highlight, clicking again unpins it.

Highlights are **ephemeral**: per-user, per-session, never persisted, never synced to Firebase,
and never visible to anyone else viewing the same document. This is the single most important
property of the system — see [Highlight state](#highlight-state).

Compare [annotations.md](annotations.md), which covers sparrows. Sparrows solve a related
problem (addressing objects inside tiles) and highlights reuse that *concept*, but not its
implementation: a sparrow is persisted document content describing an arrow between two
objects, where a highlight is ephemeral emphasis on a set of objects.

## References

A `HighlightReference` (`src/models/highlights/highlight-reference.ts`) names what should be
highlighted. It is a discriminated union:

```ts
type HighlightReference =
  | { kind: "object";   tileId: string; objectId: string; objectType?: string }
  | { kind: "variable"; variableId: string };
```

- **`object`** is a direct pointer at one object in one tile.
- **`variable`** is a semantic query: "everything associated with this variable", which may
  resolve to objects across several tiles. Note it carries no `tileId` — that is why the type
  is not called `TileReference`.

A registry maps each `kind` to a resolver that turns a reference into `IHighlightTarget[]`
(`{tileId, objectId, objectType?}`). Resolvers register themselves as a module side effect.
`resolveHighlightReference` fails quiet: an unknown kind or an unresolvable reference yields
no targets and no error.

## Setting up a tile to be a highlight *target*

A target tile renders emphasis on its own objects. There is no overlay layer — see
[Why in-tile rendering](#why-in-tile-rendering).

1. **Read the state.** Call `documentContent.objectState(tileId, objectId)`, which returns
   `"pinned" | "preview" | undefined`. Reach the document content with
   `getDocumentContentFromNode(someModelNode)` (`src/utilities/mst-utils.ts`); it returns
   `undefined` for detached trees, so null-check it.
2. **Render emphasis** in whatever idiom is native to the tile. Dataflow adds a CSS class to
   its node (`dataflow-node.tsx`, styles in `nodes/node-states.scss`).

**The call must happen inside a MobX `observer`'s render body.** `objectState` is backed by a
computed that MobX only caches while a reaction observes it. Read from outside one — a
`useMemo`, a callback, a non-observer component — every access re-resolves the reference,
sweeping every tile in the document. Since this is called once per object per render, hoisting
it turns a linear render into a quadratic one.

## Setting up a tile to be a highlight *source*

A source tile drives the state. The text-tile variable chip is the reference implementation
(`src/plugins/shared-variables/slate/variables-plugin.tsx`).

Actions on the document content model:

| Action | Use |
|---|---|
| `setHoveredRef(ref)` / `clearHoveredRef()` | Hover preview |
| `setPinnedRef(ref)` / `clearPinnedRef()` | Pin |
| `togglePinnedRef(ref)` | Click behavior — pins, or unpins if already pinned to the same ref |

Two rules a source must respect:

- **Clear only what you own.** Several sources share one document. Before clearing, confirm
  the active reference is yours — see `clearHoveredRefIfOwn`.
- **Release on unmount.** React does not fire `onMouseLeave` for an element that unmounts under
  the cursor, and a pinned highlight can normally only be dismissed by clicking its source
  again. A source that disappears while pinned would strand the highlight on screen for the
  rest of the session. See `releaseOwnHighlightRefs` and the unmount effect that calls it.

## Contributing objects for a variable

Core code must not know how a given tile associates its objects with a variable. Tiles opt in
by implementing an optional tile-content view (`src/models/tiles/tile-model-hooks.ts`):

```ts
getObjectsForVariable(variableId: string): IClueTileObject[]   // defaults to []
```

The tile receives the **id** and resolves it against its own shared model, because tiles bind
to variables in tile-specific ways.

Dataflow's implementation (`src/plugins/dataflow/model/dataflow-content.ts`) is instructive:
**Dataflow nodes never store a variable id.** Only 2 of its 11 node types bind to a variable,
and both do so through a derived string — Sensor matches `simulatedChannelId(variable)`
(`"SIM" + variable.name`), Live Output matches `simulatedHubName(variable)`
(`"Simulated " + variable.displayName`). Always go through those helpers rather than rebuilding
the strings; they are the single definition.

A consequence worth knowing: **renaming a variable silently breaks its association with the
nodes that use it.** That is pre-existing behavior of the binding, not of highlights, and it is
pinned down by a test so it cannot regress unnoticed.

Note that roughly half the registered tile content models do not route through
`tileContentAPIViews`, so `getObjectsForVariable` is genuinely `undefined` on them rather than
a no-op default. The variable resolver's optional call is load-bearing; do not "simplify" it.

## Highlight state

`DocumentContentModelWithHighlights` (`src/models/document/document-content-with-highlights.ts`)
is a composition layer on the document content model holding two **volatile** fields:
`hoveredRef` and `pinnedRef`. The pattern mirrors `DataSet`'s volatile `caseSelection`, which is
how table↔graph linked selection already works.

**Adding a `.props()` entry to that file would persist highlights to Firebase and make them
visible to everyone viewing the document** — the opposite of the design. A snapshot-invariance
test guards this.

**Precedence: hover replaces pin, it does not add to it.** Exactly one reference is active at a
time; while hovering, the pinned reference's targets are not highlighted, and mouse-out reverts
to the pin rather than clearing. The exception is hovering the reference that is already pinned,
which keeps reporting `"pinned"` so a user's own pinned source does not flicker on hover.

The resolved-target collection is deliberately a **closure local, not a `.views()` getter** —
MST publishes every view getter as public typed API. Only `isObjectActive` and `objectState`
are public, because a future text-range reference kind has no id and cannot be expressed as a
`tileId/objectId` pair.

## Why in-tile rendering

Each tile draws its own emphasis rather than a shared overlay layer resolving bounding boxes
(the way [sparrows](annotations.md) do). Two reasons:

- **No coordinate correction.** In-tile emphasis renders inside the tile's own transformed
  space, so it inherits pan/zoom for free, is clipped by the tile's overflow, and hidden objects
  simply show nothing. An overlay draws in document coordinates and needs an explicit transform
  per tile — the drawing-tile-specific path in `annotation-layer.tsx` exists for exactly that.
- **Cost.** In-tile emphasis is small per tile (Dataflow is one entry in an existing
  `classNames` call) and each tile can use an idiom native to it.

The state and reference types are deliberately pixel-free, so an overlay remains available.
**Revisit this decision if either happens:**

1. A target tile has no existing emphasis machinery and no natural coordinate space of its own.
2. Text-range highlighting is implemented. It is the first case where an overlay genuinely wins,
   because `Range.getClientRects()` returns one rect per visual line and handles wrapping
   natively.

## Authoring a document that exercises this

`src/public/demo/docs/emg-highlight-demo.json` is the worked example, and the fixture for
`cypress/e2e/functional/tile_tests/highlight_references_spec.js`.

**Three preconditions gate the variable-chip toolbar buttons.** None are obvious, and all three
must hold or the buttons are absent or disabled:

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

**Authored chips round-trip**, which is what makes a deterministic test fixture possible:

```html
<p>Watch this signal drive your program:
   <span data-slate-type="m2s-variable" data-slate-reference="c9561nuH0CdjytQd"></span></p>
```

The attribute names come from `src/components/tiles/text/plugins/chip-serialization.ts`.
Authored variable ids are **stable, not runtime-random**: `Variable.id` defaults to a nanoid,
but the simulator looks variables up by `name` first and only mints an id when none is found.
So a document shipping its own `SharedVariables` snapshot keeps the ids it declares, and a chip
can reference them by hand.

## Known limitations

- **Pinned and preview rings reuse the Dataflow input palette.** The pinned ring is currently
  the same color as the Sensor node's own border, so it reads as a thicker border rather than as
  emphasis. Choosing an emphasis color that works across every node family is a design decision.
  (The preview ring was moved off `$input-purple` because that color measured 2.02:1 against the
  white canvas, below WCAG 1.4.11's 3:1 minimum for a non-text indicator.)
- **Sources are mouse-only.** The variable chip has no `role`, `tabIndex`, or key handler, so
  keyboard and assistive-technology users cannot pin a highlight.
- **Dataflow exposes only nodes.** Connections and groups have stable ids but are not yet
  addressable, so nothing can point at a wire or a collapsed group.
- **Only whole objects can be highlighted.** There is no way to highlight a range of text; text
  highlight chips are inline void elements holding a copy of their text, so the model has no
  representation for a span of prose.
