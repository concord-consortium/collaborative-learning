# Highlights

Highlights let one part of a CLUE document point at objects inside another tile and make them
visually prominent. Hovering a variable chip in a Text tile previews the Dataflow nodes bound
to that variable; clicking pins the highlight, clicking again unpins it.

Highlights are **ephemeral**: per-user, per-session, never persisted, never synced to Firebase,
and never visible to anyone else viewing the same document. This is the single most important
property of the system — see [Highlight state](#highlight-state).

**A highlight is not selection**, even though a user driving one by hand makes the two look
alike. Selection is *operational*: it is the implicit argument to the next action — delete, drag,
group, toolbar buttons — and it is suppressed in read-only views. A highlight is *informational*:
it says "look here" without arming anything, it must render in read-only documents, 4-up cells
and thumbnails, and it has to outlive the user's next click, or acting on the guidance would
destroy the guidance. Keep them separate, and give a tile its own highlight rendering rather than
reusing its selection style.

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

A registry maps each `kind` to a resolver that turns a reference into `IHighlightTarget[]` — an
alias of the annotation system's `IClueObjectSnapshot`, so the two addressing schemes cannot drift
apart. Resolvers register themselves as a module side effect, and a resolver belongs wherever its
kind's knowledge lives: the `object` resolver is here, but the `variable` one is registered by
`shared-variables-registration.ts`, so core never has to know what a variable is.
`resolveHighlightReference` fails quiet: an unknown kind or an unresolvable reference yields
no targets and no error.

**Which kind matters, and why the multi-tile behavior is not the feature.** `object` is the kind
the system exists for: an AI saying "click that button in the Dataflow tile" should light that
button and nothing else. `variable` fans out across tiles, and that fan-out is a property of the
*kind*, not of highlighting — it exists because a variable chip is currently the only way a user
can name something in another tile. Treat the variable kind as scaffolding: useful, worth keeping,
but do not derive the system's semantics from how it behaves. Nothing today produces an `object`
reference, which is a UI limitation rather than a design one, and it resolves when AI-emitted
references land.

## Setting up a tile to be a highlight *target*

A target tile renders emphasis on its own objects. There is no overlay layer — see
[Why in-tile rendering](#why-in-tile-rendering).

1. **Read the state.** Call `documentContent.objectHighlightState(tileId, objectId)`, which returns
   `"pinned" | "preview" | undefined`. Reach the document content with
   `getDocumentContentFromNode(someModelNode)` (`src/utilities/mst-utils.ts`); it returns
   `undefined` for detached trees, so null-check it.
2. **Render emphasis** in whatever idiom is native to the tile. Dataflow adds a CSS class to its
   node (`dataflow-node.tsx`, styles in `nodes/node-states.scss`); the text tile's variable chip
   does the same (`variables-plugin.tsx`, styles in `text-tile.scss`).

Use `highlightClassesFor` (`src/models/highlights/highlight-classes.ts`) for the class names, and
the ring colors in `src/components/highlight-vars.scss`, rather than defining either locally. One
reference should read the same way wherever it lands; a tile whose emphasis is not CSS-driven can
still use the shared colors.

Note the text chip renders its highlight **separately from its Slate selection style**. That is
the concrete form of the rule above: the two states must be able to disagree, so a tile that
already has a selection appearance needs a second, distinct one for highlights.

**The call must happen inside a MobX `observer`'s render body.** `objectHighlightState` is backed
by a computed that MobX only caches while a reaction observes it. Read from outside one — a
`useMemo`, a callback, a non-observer component — every access re-resolves the reference,
sweeping every tile in the document. Since this is called once per object per render, hoisting
it turns a linear render into a quadratic one.

## Setting up a tile to be a highlight *source*

A source tile drives the state. The text-tile variable chip is the reference implementation
(`src/plugins/shared-variables/slate/variables-plugin.tsx`).

Actions on the document content model:

| Action | Use |
|---|---|
| `setHoveredHighlightRef(ref)` / `clearHoveredHighlightRef()` | Hover preview |
| `setPinnedHighlightRef(ref)` / `clearPinnedHighlightRef()` | Pin |
| `togglePinnedHighlightRef(ref)` | Click behavior — pins, or unpins if already pinned to the same ref |

Two rules a source must respect:

- **Clear only what you own.** Several sources share one document. Before clearing, confirm
  the active reference is yours — see `clearHoveredHighlightRefIfOwn`.
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

A tile that never implements this still answers it. `TileContentModel` itself calls
`tileContentAPIViews({})` (`tile-content.ts`, "add empty apis so they are available on the generic
type"), and every registered content model extends it, so the default returning `[]` is always
present. The resolver can therefore call the hook directly — no optional call, no cast.

## Highlight state

`DocumentContentModelWithHighlights` (`src/models/document/document-content-with-highlights.ts`)
is a composition layer on the document content model holding two **volatile** fields:
`hoveredHighlightRef` and `pinnedHighlightRef`. The pattern mirrors `DataSet`'s volatile `caseSelection`, which is
how table↔graph linked selection already works.

**Adding a `.props()` entry to that file would persist highlights to Firebase and make them
visible to everyone viewing the document** — the opposite of the design. A snapshot-invariance
test guards this.

**Precedence: hover replaces pin, it does not add to it.** Exactly one reference is active at a
time; while hovering, the pinned reference's targets are not highlighted, and mouse-out reverts
to the pin rather than clearing. The exception is hovering the reference that is already pinned,
which keeps reporting `"pinned"` so a user's own pinned source does not flicker on hover.

The resolved-target collection is deliberately a **closure local, not a `.views()` getter** —
MST publishes every view getter as public typed API. Only `isObjectHighlighted` and `objectHighlightState`
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

## Trying it by hand

See [highlights-demo.md](highlights-demo.md) for how to author a document a user can drive the
highlight from. That is entirely about the variable chip and is not needed to add a new tile.

## Known limitations

- **The pinned ring collides with the Dataflow input palette.** `$highlight-pinned-ring` is the
  same value as the Sensor node's own border color, so on that one node it reads as a thicker
  border rather than as emphasis. Choosing an emphasis color that works across every node family
  is a design decision. (The preview ring was moved off `$input-purple` because that color
  measured 2.02:1 against the white canvas, below WCAG 1.4.11's 3:1 minimum for a non-text
  indicator.) Both values live in `src/components/highlight-vars.scss`.
- **Only variable references exist today, so nothing can point at one specific object.** The
  `object` kind is fully resolved but has no producer — see [References](#references). Until
  AI-emitted references land, every highlight fans out to everything associated with a variable,
  which is the opposite of what "look at this one thing" needs.
- **Sources are mouse-only.** The variable chip has no `role`, `tabIndex`, or key handler, so
  keyboard and assistive-technology users cannot pin a highlight.
- **Dataflow exposes only nodes.** Connections and groups have stable ids but are not yet
  addressable, so nothing can point at a wire or a collapsed group.
- **Only whole objects can be highlighted.** There is no way to highlight a range of text; text
  highlight chips are inline void elements holding a copy of their text, so the model has no
  representation for a span of prose.
