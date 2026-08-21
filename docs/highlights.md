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
`resolveHighlightReference` fails quiet in the sense that nothing throws, but "unresolvable"
does not mean the same thing for both kinds, and the difference matters to anyone reading a
target list. An unknown kind yields no targets. A `variable` reference nothing binds yields no
targets. An `object` reference is returned **unchanged, without checking that the object
exists** — so a reference to a deleted node yields one target that no tile will render. The
visible result is the same either way (no ring appears), but do not assume every entry in a
resolved list corresponds to something present in the document.

**Why a reference carries an id and not a readable name.** The workspace summary an AI reads is
full of readable names — `Tile 3`, `Dataflow:Sensor 1` — and pointing with one of those looks like
an obvious simplification. It is not, because the failure modes are asymmetric. The summary an AI
was given is routinely one edit behind the document by the time its reply arrives. A stale **id**
resolves to nothing renderable and the ring silently does not appear. A stale **name or index**
resolves to the *wrong* object, and rings it confidently.

Both naming schemes are also unstable under ordinary use. `Tile N` is positional, assigned by
walking row order, so inserting a tile above renumbers everything below it. `type:name#N` derives
from a Dataflow node's `orderedDisplayName`, which is **student-editable** — renaming a node breaks
a name-based reference through the most ordinary action available to them.

The distinction to hold onto: every other use of names in the summary is *descriptive*, where being
slightly stale costs a little accuracy. A highlight reference is *operative* — it moves a ring on a
student's screen. So the summary carries both: readable names for the model to reason with, and ids
for it to cite. `src/models/highlights/highlight-reference-from-summary.test.ts` holds that line:
it summarizes the demo document, asserts the summary names every tile id and Dataflow node id, and
resolves a reference built from those ids.

**Which kind matters, and why the multi-tile behavior is not the feature.** `object` is the kind
the system exists for: an AI saying "click that button in the Dataflow tile" should light that
button and nothing else. `variable` fans out across tiles, and that fan-out is a property of the
*kind*, not of highlighting — it exists because a variable chip is currently the only way a user
can name something in another tile. Treat the variable kind as scaffolding: useful, worth keeping,
but do not derive the system's semantics from how it behaves. The chat tutor sidebar
(`src/components/chat-tutor/chat-sidebar.tsx`) is the first producer of an `object` reference:
each highlighted chat turn names one tile object directly, with no fan-out.

## Setting up a tile to be a highlight *target*

A target tile renders emphasis on its own objects. There is no overlay layer — see
[Why in-tile rendering](#why-in-tile-rendering).

1. **Read the state.** Call `documentContent.objectHighlightState(tileId, objectId)`, which returns
   `"pinned" | "preview" | undefined`. Reach the document content with
   `getDocumentContentFromNode(someModelNode)` (`src/utilities/mst-utils.ts`); it returns
   `undefined` for detached trees, so null-check it.
2. **Render emphasis** in whatever idiom is native to the tile. Dataflow adds a CSS class to its
   node (`dataflow-node.tsx`, styles in `nodes/node-states.scss`); the text tile's variable chip
   does the same (`variables-plugin.tsx`, styles in `text-tile.scss`). The sketch tile draws an
   SVG ring at layer level instead (`renderHighlightBorders` in `drawing-layer.tsx`).

Use `highlightClassesFor` (`src/models/highlights/highlight-classes.ts`) for the class names, and
the ring colors in `src/components/highlight-vars.scss`, rather than defining either locally. One
reference should read the same way wherever it lands; a tile whose emphasis is not CSS-driven —
the sketch ring is an SVG rect — can still use the shared colors. Geometry stays local: that ring
divides its stroke width and dash length by the current zoom, which CSS cannot do.

Note what the sketch tile does *not* reuse: `renderSelectionBorders` reads `object.boundingBox`,
the object's box in its own coordinate space. An object inside a `GroupObject` renders within the
group's `scale()` transform, so a layer-level ring drawn from the raw box lands in the wrong
place. Highlights go through `getObjectBoundingBox` (`drawing-content.ts`), which walks the
enclosing groups.

Note the text chip renders its highlight **separately from its Slate selection style**. That is
the concrete form of the rule above: the two states must be able to disagree, so a tile that
already has a selection appearance needs a second, distinct one for highlights.

**The call must happen inside a MobX `observer`'s render body.** `objectHighlightState` is backed
by a computed that MobX only caches while a reaction observes it. Read from outside one — a
`useMemo`, a callback, a non-observer component — every access re-resolves the reference,
sweeping every tile in the document. Since this is called once per object per render, hoisting
it turns a linear render into a quadratic one.

## Setting up a highlight *source*

A source drives the state. The text-tile variable chip is the reference implementation
(`src/plugins/shared-variables/slate/variables-plugin.tsx`), but a source need not be a tile —
anything that can reach the document content qualifies. The chat tutor sidebar is the first
source that isn't one (see below).

Actions on the document content model:

| Action | Use |
|---|---|
| `setHoveredHighlightRef(ref, source?)` / `clearHoveredHighlightRef()` | Hover preview |
| `setPinnedHighlightRef(ref, source?)` / `clearPinnedHighlightRef()` | Pin |
| `togglePinnedHighlightRef(ref, source?)` | Click behavior |
| `clearHoveredHighlightRefIfOwn(source)` / `clearPinnedHighlightRefIfOwn(source)` | Release on unmount |

**`source` identifies the source instance, and a reference cannot stand in for it.** Two sources
can cite the same object, and a variable reference names no source at all — so ownership has to be
tracked separately or a source will release a highlight it never set. That was a real bug: with two
chips for one variable, deleting the tile containing either one cleared the highlight everywhere,
including on the chip the user had actually clicked.

Pass a per-instance id (the chip uses a `useRef` id, not the variable id; the chat tutor sidebar
does the same). Leaving the token unset means nothing own-releases the highlight, so reserve that
for a source that genuinely has no owning component to attach a release effect to — every source
described here has one, and should carry a token.

The chat tutor sidebar (`src/components/chat-tutor/chat-sidebar.tsx`) is the source to copy for
anything that isn't a tile. It holds the workspace document's content model as a prop, wraps in
`observer` so it re-renders when another source takes over its pin, and mints a per-instance token
with `useRef` rather than `useMemo` — a discarded-and-recomputed memo would mint a new token
mid-life and strand the sidebar's own pinned highlight. It releases its own highlights on unmount
and again whenever the conversation swaps out from under it, so a closed drawer or a
document/problem change never strands a ring.

Two rules a source must respect:

- **Clear only what you own.** Several sources share one document, so clear through the
  `…IfOwn` actions rather than unconditionally.
- **Release on unmount.** React does not fire `onMouseLeave` for an element that unmounts under
  the cursor, and a pinned highlight can normally only be dismissed by clicking its source
  again. A source that disappears while pinned would strand the highlight on screen for the
  rest of the session. See `releaseOwnHighlightRefs` and the unmount effect that calls it.

Clicking a source that already owns the pin releases it; clicking a *different* source takes the
pin over rather than releasing it, even when both cite the same thing — otherwise asking to see
something a second control already points at would turn it off.

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

The sketch tile is the contrasting case, and the better model to copy. `VariableChipObject`
stores `variableId` outright, so `getObjectsForVariable` (`drawing-content.ts`) is a filter over
`objectMap` and renaming cannot break it. Two details of that implementation are deliberate:

- It matches `object.type === "variable"` as a **string** rather than importing
  `VariableChipObject`. That model is registered *into* the drawing tile by the shared-variables
  plugin, so importing it would invert the dependency.
- It reads `objectMap`, not `objects`. `objects` holds only top-level objects, while `objectMap`
  recurses into groups — so a chip nested in a group is still found. Whatever a tile reports here
  must be the same set its renderer walks, or a target resolves but never draws.

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
- **The variable chip still fans out, even though `object` now has a producer.** The chat tutor
  sidebar emits `object` references that point at one thing directly — see
  [References](#references) — but the variable chip, still the only way a user hand-authors a
  reference, resolves to everything associated with a variable, which is the opposite of what
  "look at this one thing" needs.
- **The variable chip is mouse-only.** It has no `role`, `tabIndex`, or key handler, so keyboard
  and assistive-technology users cannot pin a highlight from it. The chat tutor sidebar's
  highlight buttons are real `<button>` elements whose `onFocus` mirrors `onMouseEnter`, so pinning
  from that source works from the keyboard.
- **Dataflow exposes only nodes.** Connections and groups have stable ids but are not yet
  addressable, so nothing can point at a wire or a collapsed group.
- **Non-variable-bound objects are no longer categorically unreachable — the chat tutor sidebar's
  `object` references prove it for Dataflow nodes.** A Dataflow Math node has no variable to bind
  to, so the variable chip could never reach it; the chat tutor sidebar points at it directly by
  tileId/objectId, with no change to the Dataflow target tile. The general shape of the limitation
  still holds for hand-authored references, since a variable chip remains the only way a *user*
  constructs a cross-tile reference — so do not design around the variable kind as though it were
  the only one just because one producer of `object` references now exists.
- **Sketch variable chips cannot be grouped.** `VariableChipObject` extends `DrawingObject` rather
  than `SizedObject`, so it never implements `setUnrotatedDragBounds`, which `createGroup` calls,
  and grouping one throws. Pre-existing and unrelated to highlights, tracked separately as a
  drawing-tile bug — but it does mean the highlight ring's use of the group-adjusted bounding box
  is correct by construction rather than exercised.
- **Only whole objects can be highlighted.** There is no way to highlight a range of text; text
  highlight chips are inline void elements holding a copy of their text, so the model has no
  representation for a span of prose.
