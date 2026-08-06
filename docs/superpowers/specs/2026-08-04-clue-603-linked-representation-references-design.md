# CLUE-603 — Linked Representation References and Highlighting

**Date:** 2026-08-04 · **Revised:** 2026-08-06
**Jira:** [CLUE-603](https://concord-consortium.atlassian.net/browse/CLUE-603) — "Linked Representation Coachmarks in CLUE/Dataflow"
**Epic:** CLUE-291 (DataFlow Vibe Coding) · **Grant:** GRANT-34 (402 FlowAI)
**Follow-on:** [CLUE-598](https://concord-consortium.atlassian.net/browse/CLUE-598) — "AdaChat can return buttons that highlight Dataflow"

## Summary

Build a reference system that lets one part of a CLUE document point at objects inside
another tile, plus an ephemeral highlight mechanism that makes those objects visually
prominent when a reference is hovered or clicked.

This story is **increment 1 of a planned sequence** (see "Planned increments" below). It
delivers the smallest thing that works end to end: the reference and highlight machinery,
Dataflow nodes as targets, and a text-tile variable chip as the driver. Everything else —
additional target tiles, AI-emitted references, bidirectional highlighting — ships as
separate stories and PRs.

Leslie confirmed on 2026-08-06 that the stories may be reshaped freely, that the shortest
path to something working is preferred over a complete first delivery, and that **extending
the feature to another tile ranks above fleshing out Dataflow's object vocabulary**. The
decomposition below reflects that priority.

## Goals

1. A serializable, extensible reference type that can name either a specific object in a
   tile or a semantic query resolving to a set of objects.
2. An ephemeral, per-user, document-scoped highlight state driven by those references.
3. Dataflow nodes render emphasis when targeted.
4. A text-tile variable chip drives the highlight: hover previews, click pins.

## Non-goals

Explicitly out of scope, with the increment that owns each (numbers refer to "Planned
increments"):

| Deferred | Owner |
|---|---|
| Bidirectional highlighting (target → light up its references) | 2 |
| Text tile as a *target* (both chip kinds) | 2 |
| AI emitting references; citation syntax; ids in the AI summary | 3 (CLUE-598) |
| Rendering AI responses as clickable reference elements | 3 (CLUE-598) |
| Sketch/drawing tile as a target | 4 |
| Wires/connections and groups (supernodes) as Dataflow targets | 5 |
| Highlighting an arbitrary *range* of text | 6 |
| Recasting the EMG Sensor as a purple chip | Leslie / design |
| Any persistence of highlights | never — highlights are ephemeral by design |

Nothing in this design touches document snapshots, import/export, the Firebase sync path,
or the group-docs sync buckets.

## Background: what already exists

**Sparrows** (`docs/annotations.md`) already solve *addressing*: `ClueObject =
{ tileId, objectId, objectType }`, with a tile-side contract of `annotatableObjects`
(`src/models/tiles/tile-model-hooks.ts:86`) and `tileApi.getObjectBoundingBox`
(`src/components/tiles/tile-api.tsx:66-72`). Nine tile types implement it, Dataflow among
them (`src/plugins/dataflow/model/dataflow-content.ts:236`).

Sparrows are the wrong vehicle for *this* feature, though, for three reasons:

- They are persisted document content (`document-content-with-annotations.ts:22`) synced to
  Firebase and visible to everyone who opens the document. AI-driven highlights must be
  ephemeral and per-user.
- `ArrowAnnotation` has no provenance field — no `createdBy`, no `source`, no read-only
  flag — so a machine-authored sparrow is indistinguishable from a student's.
- Semantically a sparrow is *an arrow between two objects*. This feature needs *spotlight
  these N objects*, which is a different primitive.

**Coachmarks** (`@concord-consortium/coachmarks`) was evaluated and rejected for v1. It
targets DOM elements by live reference or CSS selector, so it solves none of the addressing
problem — the logical-reference → DOM bridge would still have to be built. Its interaction
model is tour-shaped (one step at a time, a primary popover owning Next/Prev/Done) rather
than "N objects lit simultaneously". It also peers on `@floating-ui/react ^0.27` where CLUE
has `^0.25.4`, and is early (`0.0.1-pre.*`, `main` stale relative to what is published, one
consumer). It remains a good candidate if this work later grows a guided-tour or
anchored-explanation-bubble experience.

**Linked selection precedent.** The pattern this design follows already exists: `DataSet`
holds `caseSelection` / `attributeSelection` / `cellSelection` as `observable.set` inside a
`.volatile(...)` block (`src/models/data/data-set.ts:55-64`). That *is* how table↔graph
linked selection works — shared model instance, volatile selection, MobX propagation. No
store, no event bus.

### The variable↔node binding is by derived string, not by id

This constrains the design and must not be assumed away. There is **no variable id stored
anywhere in a Dataflow node**:

| Consumer | Field | Value |
|---|---|---|
| Text-tile chip | `reference` | the variable **`id`** (`variables-plugin.tsx:245-248, 292`) |
| Sensor node | `sensor` | `"SIM" + variable.name` (`sensor-node.ts:18-23`; `simulated-channel.ts:9,12-14`) |
| Live Output node | `hubSelect` | `"Simulated " + variable.displayName` (`live-output-node.ts:30-31, 209-217`; `simulated-output.ts:8-10`) |

Only **2 of the 11** node types (`dataflow-program-model.ts:91-103`) bind to a variable at
all. No reverse lookup exists: `variableBuckets`
(`src/plugins/shared-variables/shared-variables-utils.ts:13-33`) handles Diagram, Drawing
and Text, and returns `[]` for Dataflow.

All three consumers do resolve against the same document-level `SharedVariables` instance
(`simulator-content.ts:151-167`, `dataflow-content.ts:261-263, 290-293`,
`variables-plugin.tsx:192`), so the shared model itself is not in question — only the
binding key.

**Consequence:** renaming a variable silently breaks its association with the nodes that
use it. This is pre-existing behavior that this feature inherits, not a regression it
introduces. It is covered by a test (below) so the constraint is documented in code.

## Design

### 1. Reference type

```ts
// src/models/highlights/highlight-reference.ts
export type HighlightReference =
  | { kind: "object";   tileId: string; objectId: string; objectType?: string }
  | { kind: "variable"; variableId: string };
```

The `variable` kind carries the **id** rather than the name: it is the stable MST
identifier (`Variable.id` is `types.identifier` defaulting to `nanoid(16)`) and it is what
the text chip already stores. Resolution bridges from id to the derived binding strings.

Both resolvers ship in this story. The `object` resolver is an identity function of a few
lines, but shipping it is the point — an extension point with a single implementation is an
unproven extension point.

**On the name.** Not `TileReference` or `TileObjectReference`: the `variable` kind carries no
`tileId` at all and deliberately resolves across multiple tiles, so any `Tile*` prefix
misdescribes half the union shipping in increment 1. "Object" is also wrong going forward —
in CLUE's vocabulary (`ClueObject`, `annotatableObjects`, `getObjectBoundingBox`) an object
is a discrete addressable thing with an id, which increment 6's `{ kind: "textRange" }` is
not. `HighlightReference` claims nothing false about tile-ness, granularity or multiplicity,
and pairs cleanly with the resolved side: reference in, `IHighlightTarget` out.

### 2. Resolver registry and the tile hook

```ts
export interface IHighlightTarget { tileId: string; objectId: string; objectType?: string }
type ReferenceResolver = (ref: HighlightReference, content: DocumentContentModelType) => IHighlightTarget[];
```

(`DocumentContentModelType` is the existing exported instance type at
`document-content.ts:607`. If importing it into `src/models/highlights/` creates a circular
import, the resolver signature takes a narrow structural interface declaring only the
members it uses — `tileMap` and the shared-model accessor.)

A `Map<HighlightReference["kind"], ReferenceResolver>` in `highlight-reference.ts`.

- **`object` resolver** — returns `[{ tileId, objectId, objectType }]`.
- **`variable` resolver** — looks the variable up via `sharedVariables.getVariableById(id)`,
  then asks every tile content in the document which of its objects are associated with it.

Resolving a variable requires Dataflow-specific knowledge, which must not leak into core.
The seam is a new optional tile-content hook, mirroring the existing `annotatableObjects`
contract in `src/models/tiles/tile-model-hooks.ts`:

```ts
getObjectsForVariable?(variable: VariableType): IClueTileObject[];   // default: []
```

Dataflow implements it in `dataflow-content.ts` by scanning `program.nodes`:

- Sensor: `node.data.type === "Sensor" && node.data.sensor === simulatedChannel(variable)`
- Live Output: `node.data.type === "Live Output" && node.data.hubSelect === simulatedHubName(variable)`

It reuses the existing module-level pure helpers `simulatedChannel()` and
`simulatedHubName()` so the string derivation has exactly one definition in the codebase.
The scan mirrors the shape of `annotatableObjects` at `dataflow-content.ts:237-240`.

Core stays generic, plugin knowledge stays in the plugin, and later increments inherit the hook
for any other tile that needs it.

### 3. Highlight state

A new composition layer `DocumentContentModelWithHighlights` in
`src/models/document/document-content-with-highlights.ts`, extending
`DocumentContentModelWithTileDragging`. `DocumentContentModel`
(`document-content.ts:77`) then extends it instead. This is the lowest-touch insertion into
the existing linear chain (`Base → WithAnnotations → WithTileDragging → DocumentContent`):
one changed line plus one new file. Update the chain comment at `document-content.ts:55-76`.

```
volatile:  hoveredRef?: HighlightReference
           pinnedRef?:  HighlightReference

actions:   setHoveredRef(ref) / clearHoveredRef()
           setPinnedRef(ref) / togglePinnedRef(ref) / clearPinnedRef()

views:     activeRef      = hoveredRef ?? pinnedRef
           activeSource   : "preview" | "pinned" | undefined
           isObjectActive(tileId, objectId): boolean
           objectState(tileId, objectId): "preview" | "pinned" | undefined
```

**The public surface is deliberately tile-facing queries, not an exposed target
collection.** Internally `isObjectActive` is backed by a MobX computed `Set<string>` keyed
`` `${tileId}/${objectId}` `` so the resolver scan runs once per reference change rather
than once per node per render — it is called from inside every Dataflow node's render and
must be an O(1) lookup. But that `Set` is an implementation detail and must not leak into
the API.

The reason is increment 6. A text *range* has no id and does not exist until it is resolved,
so it cannot be represented as a `tileId/objectId` pair. Keeping the collection private
means a later `activeRangesForTile(tileId): TextRange[]` can be added alongside
`isObjectActive` without touching a single existing call site. Exposing the `Set` now would
make that a breaking refactor across every consumer.

Name the query `isObjectActive` rather than `isTargetActive` for the same reason: "target"
will eventually cover more than objects.

**Precedence: hover replaces pin, it does not add to it.** Exactly one reference is active
at a time. While `hoveredRef` is set it is the active reference and the pinned reference's
targets are *not* highlighted; on mouse-out the active reference reverts to `pinnedRef`
rather than clearing.

It follows that every active target shares a single state — `activeSource` is a property of
the active reference, not of the individual target. `objectState(tileId, objectId)` is a
convenience that returns `activeSource` when the object is active and `undefined` otherwise;
it can never return `"pinned"` for one node while returning `"preview"` for another in the
same render. The two values exist so a preview can be styled more lightly than a
commitment.

The internal key is `` `${tileId}/${objectId}` ``. Dataflow node ids are `nanoid(16)`, whose
alphabet excludes `/`, so the separator is unambiguous for the ids this story handles. Any
future kind whose object ids may contain `/` must use a structural key instead — which the
private-collection rule above makes a local change.

### 4. Rendering — in-tile

Highlights are drawn by the tile itself, not by a document-level overlay.

`DataflowNode` (`src/plugins/dataflow/nodes/dataflow-node.tsx:184-190`) is already a MobX
`observer`, already has `id` in scope, already builds `dynamicClasses` with `classNames`,
and already reads observables mid-render specifically to stay reactive — the comment at
`:179-182` documents that exact pattern for `inCollapsedGroup`. The change is one more
entry in that object:

```ts
const emphasis = documentContent?.objectState(tileId, id);   // "pinned" | "preview" | undefined

const dynamicClasses = classNames({
  selected: data.selected,
  // ...existing entries...
  "highlight-pinned":  emphasis === "pinned",
  "highlight-preview": emphasis === "preview",
});
```

Distinct classes for pinned and preview so a preview reads as lighter than a commitment.
Styles go in `node-states.scss`, which already owns node state visuals.

The document content is reached via `getDocumentContentFromNode(node.model)`
(`src/utilities/mst-utils.ts:35-37`), which is already used from plugin code
(`graph-model.ts:36,379`) and has precedent for walking up from this exact node model
(`base-node.ts:96-102`). It returns `undefined` for detached trees, so the call site
null-checks.

#### Why in-tile rather than a document-level overlay

The original draft of this spec justified in-tile partly on "Dataflow is the only tile that
needs emphasis." That premise died when the increment sequence put two more target tiles
ahead of Dataflow's object vocabulary, so the decision was re-tested against all three. It
holds, on cost and on fidelity:

| Tile | In-tile emphasis cost | Mechanism |
|---|---|---|
| Dataflow | ~1 line | One entry in the existing `classNames` at `dataflow-node.tsx:184` |
| Text | ~10–15 lines / 3 files | Class on each chip component; `VariableComponent` is already an `observer` (`variables-plugin.tsx:254`), `HighlightComponent` needs `observer` added (`highlights-plugin.tsx:57`) |
| Drawing | ~20–40 lines / 2–3 files | Generalize `highlightObject: string \| null` to a `Set` and reuse `renderSelectionBorders` (`drawing-layer.tsx:500-545`) with a distinct color |

Roughly 35–55 lines across three tiles, against ~150–250 for a general overlay plus its
measurement and invalidation machinery.

Two further points favor in-tile:

- **No coordinate correction is needed.** The drawing-tile-specific view transform at
  `annotation-layer.tsx:456-491` exists *because* the overlay draws outside the tile:
  read-only drawing tiles auto fit-to-view (`drawing-tile.tsx:90-102`) while read-only
  `getObjectBoundingBox` returns untransformed content coordinates, so the overlay must
  re-apply the transform itself. In-tile highlights render inside the tile's own transformed
  space (`object-canvas` for drawing, the rete canvas for Dataflow) and sidestep that
  entire class of problem — which would otherwise have to be generalized per tile.
- **Clipping and hidden objects come free.** A Dataflow node panned partly out of the tile
  viewport is clipped by the tile's own overflow, and members of a collapsed group (which
  get `.collapsed-hidden` at `dataflow-node.tsx:189` rather than unmounting) simply show no
  emphasis. An overlay needs explicit clipping and an is-it-laid-out check.

This is one mental model, not two: **the tile owns its emphasis**, expressed in whatever
idiom is native to it. Drawing's existing `renderSelectionBorders` is already a
bounding-box rect drawn at layer level inside the tile's coordinate space — the same shape
of solution as a class on a Dataflow node.

**When to revisit.** The store and reference types are deliberately pixel-free, so a
`HighlightLayer` can read the same state and resolve through `tileApi.getObjectBoundingBox`
without changing anything specified here. All three tiles above already implement that
method. Two triggers should prompt a re-evaluation: a target tile with no existing emphasis
machinery and no natural coordinate space of its own, or increment 6 — text range
highlighting is the first case where the overlay has a real advantage, because
`Range.getClientRects()` returns one rect per visual line and handles wrapping natively
(see increment 6).

Incidental cleanup while in this file: `dataflow-node.tsx:194` builds `className` with a
template literal, which `CLAUDE.md` requires be `classNames`.

### 5. Sources

**Text-tile variable chip** (`variables-plugin.tsx:281-300`) — the chip has no mouse
handlers today; its only interactivity is Slate's `useSelected()` styling. Add:

- `onMouseEnter` / `onMouseLeave` → `setHoveredRef` / `clearHoveredRef`
- `onClick` → `togglePinnedRef({ kind: "variable", variableId: element.reference })`

Hover cannot interfere with Slate. Click is the risk: in an editable text tile, clicking a
chip already means something to Slate. The click handler must **not** call
`preventDefault()` or `stopPropagation()`, so pinning and Slate's own chip selection
coexist. Verify during implementation that text editing is undisturbed. If they do conflict,
the fallback is hover-only while editable and click-to-pin when read-only.

**Simulator (EMG)** — `brainwavesGripperSimulation` (key `"EMG_and_claw"`) is the default
simulation, and its `EMG` variable is defined at
`src/plugins/simulator/simulations/brainwaves-gripper/brainwaves-gripper.tsx:217-225`
(name `emg_key`, labels including `input` and `sensor:emg-reading`).

CLUE-603 phrases the sim demo as one sentence — the EMG Sensor "should be cast as a chip
with a purple chip color... Clicking on [it] should highlight" — and the chip half is
deferred. The **text chip is therefore the primary demo** for this story: it has a
well-defined target and exercises the full path end to end. The sim side attaches
opportunistically to whatever discrete element exists today; if none does, that half lands
with the purple-chip work rather than blocking this story. The implementation plan resolves
which.

### 6. Demo setup — how the chip gets into the document

No new authoring UI is required, but the demo only works in a document that satisfies
several preconditions. They are recorded here because none of them are obvious and all of
them are load-bearing.

**Insertion UI already exists.** `src/plugins/shared-variables/slate/text-tile-buttons.tsx`
registers three text-toolbar buttons:

| Button | Toolbar name | Behavior |
|---|---|---|
| `NewVariableTextButton` (`:113`) | `new-variable` | Creates a brand-new variable and inserts a chip |
| `InsertVariableTextButton` (`:147`) | `insert-variable` | **Picker** over existing SharedVariables; inserts chips referencing them |
| `EditVariableTextButton` (`:181`) | `edit-variable` | Edits the variable behind the selected chip |

`insert-variable` is the one that matters: it enumerates `variableBuckets(textContent,
sharedModel)` over `sharedVariables.variables` and inserts `{ type: kVariableFormat,
reference: variable.id }` (`:46-48`). Those are the same `Variable` instances the simulator
created (`simulator-content.ts:188-194`), so a chip inserted this way points at variables
Dataflow nodes are bound to. The chip binds by **id** and the node by **name**, but both
resolve to the same MST node.

**Three preconditions, all easy to get wrong:**

1. **The plugin must be loaded.** `shared-variables-registration.ts` is only imported when a
   **Dataflow, Diagram, or Simulator** tile type is registered (`register-tile-types.ts:32,
   38, 70`). Registering `Text` alone does not pull it in.
2. **The unit must enable the buttons.** They appear only if `settings.text.tools` lists
   them; the app default in `src/clue/app-config.json` does **not**. Units that do:
   `demo/units/qa`, `qa-variables`, `qa-no-group-share`, `qa-no-nav-panel`, and
   `curriculum/dataflow/dataflow-example.json`.
3. **A SharedVariables must exist.** All three buttons are disabled when
   `variablesPlugin.sharedModel` is undefined (`text-tile-buttons.tsx:123, 157`). The text
   tile never creates one — it auto-attaches to whatever the document already has
   (`variables-plugin.tsx:173-212`), so the document needs a simulator (or diagram/drawing)
   tile as the variable source.

**A near-ready fixture exists.** `src/public/demo/docs/chipsimsetup.json` already contains a
text tile, a Dataflow tile with a Sensor bound to `SIMresist_reading_key` and a Live Output
on `Simulated Servo`, a Simulator tile (`potentiometer_chip_servo`), and a persisted
`SharedVariables` with **explicit** variable ids whose `tiles` array already includes the
text tile. The only missing piece is a chip in the text. Nothing in the repo currently
contains an `m2s-variable` chip — `grep -rl "m2s-variable" src/public` returns nothing.

**Authored chips round-trip**, which is what makes a deterministic test fixture possible:

```html
<p>The <span data-slate-type="m2s-variable" data-slate-reference="c9561nuH0CdjytQd"></span> signal…</p>
```

Emitted at `variables-plugin.tsx:282-288`, deserialized at `:315-322`, markers defined in
`chip-serialization.ts:9-11`. Ordering is safe: `createEditor` runs `withVariables` before
`asSlate()` (`text-tile.tsx:163, 166`).

Critically, **authored variable ids are stable, not runtime-random**. `Variable.id` defaults
to `nanoid(16)`, but `simulator-content.ts:190` looks variables up **by `name`** first and
only calls `createVariable` when none is found. So a document that ships its own
`SharedVariables` snapshot keeps its authored ids, and a chip can reference them by hand.

**Recommendation for this story:** add a demo document modeled on `chipsimsetup.json` but
using the EMG simulation (`EMG_and_claw`, whose `EMG` variable is `emg_key` with labels
`input` / `sensor:emg-reading`, `brainwaves-gripper.tsx:217-225`), with an authored variable
chip already in the text tile. That serves as both the manual demo and the Cypress fixture,
and it matches CLUE-603's EMG narrative. `old-format-test-document.json` already carries EMG
with fixed ids (`c9561nuH0CdjytQd`) and is the natural model for the shared-model block, but
it is used by an existing smoke test (`cypress/e2e/smoke/single_student_canvas_test.js:269`)
and should not be modified.

**Cosmetic wrinkle, not blocking:** simulation variables appear under the insert dialog's
"Unused variables" heading rather than "used by other tiles", because `getTileVariables`
(`shared-variables-utils.ts:13-32`) only understands Diagram, Drawing and Text tiles and
returns `[]` for Dataflow. Note that this is the *same* missing knowledge that
`getObjectsForVariable` supplies, so the hook could later fix `variableBuckets` as a
by-product. Out of scope here — recorded only so the misleading heading isn't mistaken for a
bug introduced by this work.

## Error handling

The posture is **fail quiet**. A reference that does not resolve produces no highlight and
no user-facing error.

| Case | Behavior |
|---|---|
| Variable id does not resolve (deleted variable) | Resolver returns `[]`, no highlight. The chip already self-reports via `invalid reference:` (`variables-plugin.tsx:300`). |
| Variable renamed | Association breaks silently — the node still holds the old derived string. Resolver returns `[]`; dev-mode console warning only. Pre-existing, inherited. |
| `getDocumentContentFromNode` returns `undefined` | Guard and no-op. Occurs in detached trees and some tests. |
| Targeted node deleted while pinned | The internal target set recomputes and the stale id stops matching. Self-healing — unlike sparrows, which orphan because `deleteTile` never touches `annotations` (`base-document-content.ts:950-984`). |
| Targeted node is inside a collapsed group | `.collapsed-hidden` hides it, so no ring appears. Whether the group chip should signal a hidden match is deferred to increment 5 with groups. |
| Read-only documents and teacher views | Highlighting works. It mutates nothing persisted, and is arguably most valuable there. |
| Document switch | State dies with the content model. No cleanup code required. |
| Same document in 4-up or thumbnails | All views sharing the content model highlight together. Acceptable and arguably desirable. |

## Testing

**Unit — resolver registry** (`highlight-reference.test.ts`): object-kind identity; variable-kind
happy path; unknown kind; unresolvable variable id.

**Unit — Dataflow `getObjectsForVariable`** (`dataflow-content.test.ts`): matches a Sensor
node via `simulatedChannel()`; matches a Live Output node via `simulatedHubName()`; excludes
the other nine node types; returns `[]` after a variable rename — encoding the known
fragility as a test rather than a comment.

**Unit — highlight state** (`document-content-with-highlights.test.ts`): hover-beats-pin
precedence; hovering reference B while reference A is pinned highlights only B's targets,
not A's; mouse-out reverts to pinned rather than clearing; toggle pins and unpins;
`isObjectActive` goes false when a targeted node is removed.

**Component — `DataflowNode`**: correct class for pinned, preview, and neither.

**Cypress — one spec**: load the EMG demo document from "Demo setup" (its authored chip makes
the run deterministic), then hover the text variable chip → associated Dataflow nodes
preview; mouse-out → preview clears; click → pins; click again → unpins. Node selectors
already exist in `cypress/support/elements/tile/DataflowToolTile.js`. Use the doc-editor
route pattern from `cypress/e2e/smoke/single_student_canvas_test.js:269`.

No persistence tests, because nothing is persisted.

## Files touched

New:
- `src/models/highlights/highlight-reference.ts` (+ test)
- `src/models/document/document-content-with-highlights.ts` (+ test)
- `src/public/demo/docs/<name>.json` — EMG demo document with an authored variable chip
  (see "Demo setup"); serves as both the manual demo and the Cypress fixture
- Cypress spec for the chip→node demo

Modified:
- `src/models/document/document-content.ts` — extend the new layer; update the chain comment
- `src/models/tiles/tile-model-hooks.ts` — optional `getObjectsForVariable` hook
- `src/plugins/dataflow/model/dataflow-content.ts` — implement the hook (+ test)
- `src/plugins/dataflow/nodes/dataflow-node.tsx` — highlight classes; `classNames` cleanup
- `src/plugins/dataflow/nodes/node-states.scss` — highlight styles
- `src/plugins/shared-variables/slate/variables-plugin.tsx` — chip hover/click handlers

## Open questions for implementation

1. Whether the text chip's click handler disturbs Slate editing. Fallback specified above.
2. Whether the EMG simulation has a discrete element suitable for hover/click handlers
   before the purple-chip work lands.
3. Visual treatment of pinned vs preview emphasis — a design question, not an architectural
   one. The two classes exist regardless.
4. Whether the demo document should be a new EMG-based file or an added chip in the existing
   `chipsimsetup.json` (which uses potentiometer/servo rather than EMG). A new file is
   recommended so the story's EMG narrative is preserved and no existing fixture is
   disturbed, but either works.

## Planned increments

Each row is a separate story and PR. Ordering is by Leslie's stated priority (another tile
outranks Dataflow's object vocabulary) and by **driver availability** — an increment that
adds a *target* is worthless until something can point at it.

The recurring lesson from scoping these: **target support and source support are
independent, and target support is uniformly cheap.** What actually constrains the sequence
is sources.

### 1 — This story (CLUE-603, reduced)

Reference union + resolver registry, highlight state, Dataflow nodes as targets, text
variable chip as source.

### 2 — Bidirectional highlighting; text tile as target

Add the inverse index (target → which references point at it) and make both text chip kinds
render emphasis: variable chips (`variables-plugin.tsx`, already an `observer`) and
highlight chips (`highlights-plugin.tsx:57`, needs `observer` added). Roughly 10–15 lines
across 3 files.

**Needs no new source.** Increment 1 already makes the variable chip a source; lighting it
up in reverse — hover a Dataflow node, see which chip references it — is the whole feature.
That makes this the cheapest route to "a second tile is a target," which is why it precedes
the AI work.

Note the two readings of "text tile as a target": the *narrow* one (the chip that is already
a source lights up in reverse) ships here as a proof of concept; the *broad* one (Ada says
"look at this") needs increment 3's driver. The target-side rendering is identical for both,
so land both chip kinds here regardless of which driver arrives first.

Read-only is not a concern: text chips render identically in read-only docs, 4-up cells and
thumbnails, with no gating (`text-tile.tsx:343` passes `readOnly` only to `SlateEditor` and
class names).

### 3 — AI emits references (CLUE-598)

The input-side work, which is most of the cost and is unrelated to anything in this spec.
Two known obstacles:

- **The AI cannot cite what it cannot name.** The DOT summary fed to the model deliberately
  replaces node ids with readable `type:name` labels, disambiguated with `#N` on collision
  (`dataflow-to-graphviz.ts:225-260`). Either emit real ids or build a label→id resolver.
- **No AI surface can render interactive content today.** There is no `AdaChat` in the repo.
  The AI tile renders via `markdown-to-jsx` (`ai-tile.tsx:154`), whose `options.overrides`
  hook is the natural injection point but is unconfigured. The Chat Tutor renders raw text
  with no markdown parser at all (`chat.tsx:222`). Which surface is meant changes the work
  materially and should be settled with Leslie before this is estimated.

### 4 — Sketch/drawing tile as target

Generalize `highlightObject: string | null` to a `Set<string>` and reuse
`renderSelectionBorders` (`drawing-layer.tsx:500-545`) with a distinct color — the smallest
diff, and it already handles zoom-compensated stroke widths and group-adjusted bounding
boxes. Roughly 20–40 lines across 2–3 files.

Two decisions this increment must make:

- **The read-only gate.** Drawing's existing highlight is hard-gated off by
  `if (!this.props.readOnly)` (`drawing-layer.tsx:634`). If highlights must show in
  read-only views, that gate changes.
- **Group members.** Objects inside a `GroupObject` render within `scale(width, height)`
  (`group.tsx:218-221`), so a stroke drawn on a child is non-uniformly distorted. This is
  precisely why the existing highlight draws at layer level using the group-adjusted box
  from `drawing-content.ts:158` — follow that, do not style the child.

Sequenced after increment 3 because nothing can point at a sketch object until the AI can
emit `object` references, or a new authored source is designed. Shipping it earlier would
be dead code.

### 5 — Dataflow wires and groups as targets

Connections (`ConnectionModel`) and groups (`GroupModel`) both already have persistent
`types.identifier` ids (`dataflow-program-model.ts:21-27, 33-62`) but appear in neither
`annotatableObjects` nor `getObjectBoundingBox`. Wires are the expensive half: highlighting
a bezier in the rete canvas is a different rendering problem from emphasizing a box.

Lowest priority per Leslie. Benefits sparrows too if the objects are added to
`annotatableObjects`.

### 6 — Text range highlighting

"Look at the first sentence of the second paragraph." **This cannot reuse any chip
machinery**: highlight chips are inline *void* elements holding a copy of the text
(`highlights-plugin.tsx:135-138`), so the model has no representation for a span of prose.

Two viable mechanisms, neither cheap:

- **Slate decorations** — the conceptually right tool, since decorations are ephemeral,
  range-based, and never touch the document. But `@concord-consortium/slate-editor@0.13.0-pre.0`
  does not expose `decorate` or `renderLeaf` in its public typings, and CLUE uses decorations
  nowhere. This is cross-repo work on a shared library.
- **Overlay using `Range.getClientRects()`** — returns one rect per visual line, so wrapping
  is handled natively. Stays entirely within CLUE, but requires the `HighlightLayer` this
  spec deferred. This is the first case where the overlay genuinely beats in-tile, so the
  rendering decision should be re-opened here rather than assumed.

The hard design problem is the **locator**: how to name a range durably. Slate paths and
character offsets break on any edit. Quoted-text matching is what an AI naturally emits and
degrades gracefully when the text changes. This wants its own design pass; it is recorded
here so it is not mistaken for a small addition.

Increment 1 accommodates this by keeping the resolved-target collection private (see
"Highlight state"), so `{ kind: "textRange", ... }` slots into the existing union and
`activeRangesForTile()` is added alongside `isObjectActive()` without breaking callers.
