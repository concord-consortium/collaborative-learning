# CLUE-603 — Linked Representation References and Highlighting

**Date:** 2026-08-04
**Jira:** [CLUE-603](https://concord-consortium.atlassian.net/browse/CLUE-603) — "Linked Representation Coachmarks in CLUE/Dataflow"
**Epic:** CLUE-291 (DataFlow Vibe Coding) · **Grant:** GRANT-34 (402 FlowAI)
**Follow-on:** [CLUE-598](https://concord-consortium.atlassian.net/browse/CLUE-598) — "AdaChat can return buttons that highlight Dataflow"

## Summary

Build a reference system that lets one part of a CLUE document point at objects inside
another tile, plus an ephemeral highlight mechanism that makes those objects visually
prominent when a reference is hovered or clicked.

This story delivers the *mechanism* and demonstrates it with non-AI drivers. Teaching the
AI to emit references, and rendering them as clickable buttons in an AI response, is
CLUE-598.

## Goals

1. A serializable, extensible reference type that can name either a specific object in a
   tile or a semantic query resolving to a set of objects.
2. An ephemeral, per-user, document-scoped highlight state driven by those references.
3. Dataflow nodes render emphasis when targeted.
4. A text-tile variable chip drives the highlight: hover previews, click pins.

## Non-goals

Explicitly out of scope, with the story that owns each:

| Deferred | Owner |
|---|---|
| AI emitting references; citation syntax; ids in the AI summary | CLUE-598 |
| Rendering AI responses as clickable reference buttons | CLUE-598 |
| Reverse direction (click a node → light up its references) | CLUE-598 |
| Wires/connections and groups (supernodes) as targets | CLUE-598 |
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
// src/models/highlights/tile-reference.ts
export type TileReference =
  | { kind: "object";   tileId: string; objectId: string; objectType?: string }
  | { kind: "variable"; variableId: string };
```

The `variable` kind carries the **id** rather than the name: it is the stable MST
identifier (`Variable.id` is `types.identifier` defaulting to `nanoid(16)`) and it is what
the text chip already stores. Resolution bridges from id to the derived binding strings.

Both resolvers ship in this story. The `object` resolver is an identity function of a few
lines, but shipping it is the point — an extension point with a single implementation is an
unproven extension point.

### 2. Resolver registry and the tile hook

```ts
export interface IHighlightTarget { tileId: string; objectId: string; objectType?: string }
type ReferenceResolver = (ref: TileReference, content: DocumentContentModelType) => IHighlightTarget[];
```

(`DocumentContentModelType` is the existing exported instance type at
`document-content.ts:607`. If importing it into `src/models/highlights/` creates a circular
import, the resolver signature takes a narrow structural interface declaring only the
members it uses — `tileMap` and the shared-model accessor.)

A `Map<TileReference["kind"], ReferenceResolver>` in `tile-reference.ts`.

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

Core stays generic, plugin knowledge stays in the plugin, and CLUE-598 inherits the hook
for any other tile that needs it.

### 3. Highlight state

A new composition layer `DocumentContentModelWithHighlights` in
`src/models/document/document-content-with-highlights.ts`, extending
`DocumentContentModelWithTileDragging`. `DocumentContentModel`
(`document-content.ts:77`) then extends it instead. This is the lowest-touch insertion into
the existing linear chain (`Base → WithAnnotations → WithTileDragging → DocumentContent`):
one changed line plus one new file. Update the chain comment at `document-content.ts:55-76`.

```
volatile:  hoveredRef?: TileReference
           pinnedRef?:  TileReference

actions:   setHoveredRef(ref) / clearHoveredRef()
           setPinnedRef(ref) / togglePinnedRef(ref) / clearPinnedRef()

views:     activeRef      = hoveredRef ?? pinnedRef
           activeSource   : "preview" | "pinned" | undefined
           activeTargets  : Set<string>            // keys of `${tileId}/${objectId}`
           isTargetActive(tileId, objectId): boolean
           targetState(tileId, objectId): "preview" | "pinned" | undefined
```

`activeTargets` is a MobX computed so the resolver scan runs once per reference change, not
once per node per render — `isTargetActive` is called from inside every Dataflow node's
render, so it must be an O(1) `Set` lookup.

**Precedence: hover replaces pin, it does not add to it.** Exactly one reference is active
at a time. While `hoveredRef` is set it is the active reference and the pinned reference's
targets are *not* highlighted; on mouse-out the active reference reverts to `pinnedRef`
rather than clearing.

It follows that every active target shares a single state — `activeSource` is a property of
the active reference, not of the individual target. `targetState(tileId, objectId)` is a
convenience that returns `activeSource` when the target is active and `undefined` otherwise;
it can never return `"pinned"` for one node while returning `"preview"` for another in the
same render. The two values exist so a preview can be styled more lightly than a
commitment.

Target keys are `` `${tileId}/${objectId}` ``. Dataflow node ids are `nanoid(16)`, whose
alphabet excludes `/`, so the separator is unambiguous for the ids this story handles. Any
future kind whose object ids may contain `/` must use a structural key instead.

### 4. Rendering — in-tile

Highlights are drawn by the tile itself, not by a document-level overlay.

`DataflowNode` (`src/plugins/dataflow/nodes/dataflow-node.tsx:184-190`) is already a MobX
`observer`, already has `id` in scope, already builds `dynamicClasses` with `classNames`,
and already reads observables mid-render specifically to stay reactive — the comment at
`:179-182` documents that exact pattern for `inCollapsedGroup`. The change is one more
entry in that object:

```ts
const dynamicClasses = classNames({
  selected: data.selected,
  // ...existing entries...
  "highlight-pinned":  highlightState === "pinned",
  "highlight-preview": highlightState === "preview",
});
```

Distinct classes for pinned and preview so a preview reads as lighter than a commitment.
Styles go in `node-states.scss`, which already owns node state visuals.

The document content is reached via `getDocumentContentFromNode(node.model)`
(`src/utilities/mst-utils.ts:35-37`), which is already used from plugin code
(`graph-model.ts:36,379`) and has precedent for walking up from this exact node model
(`base-node.ts:96-102`). It returns `undefined` for detached trees, so the call site
null-checks.

In-tile rendering was chosen over a document-level overlay for this story because it gets
two behaviors right by construction that an overlay would have to solve explicitly: the
ring is clipped by the rete canvas's own overflow when a node is panned partly out of the
tile viewport, and members of a collapsed group (which get `.collapsed-hidden` at
`dataflow-node.tsx:189` rather than unmounting) simply show no ring. It also inherits rete's
pan/zoom for free.

The store and reference types are deliberately pixel-free. If CLUE-598 needs uniform
emphasis across non-Dataflow tiles, a `HighlightLayer` can read the same state and resolve
through the existing `tileApi.getObjectBoundingBox` without changing anything specified
here. Dataflow already implements that method with live pan/zoom tracking
(`dataflow-program.tsx:292-337`), so an overlay remains available at any time.

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

## Error handling

The posture is **fail quiet**. A reference that does not resolve produces no highlight and
no user-facing error.

| Case | Behavior |
|---|---|
| Variable id does not resolve (deleted variable) | Resolver returns `[]`, no highlight. The chip already self-reports via `invalid reference:` (`variables-plugin.tsx:300`). |
| Variable renamed | Association breaks silently — the node still holds the old derived string. Resolver returns `[]`; dev-mode console warning only. Pre-existing, inherited. |
| `getDocumentContentFromNode` returns `undefined` | Guard and no-op. Occurs in detached trees and some tests. |
| Targeted node deleted while pinned | `activeTargets` recomputes and the stale id stops matching. Self-healing — unlike sparrows, which orphan because `deleteTile` never touches `annotations` (`base-document-content.ts:950-984`). |
| Targeted node is inside a collapsed group | `.collapsed-hidden` hides it, so no ring appears. Whether the group chip should signal a hidden match is deferred to CLUE-598 with groups. |
| Read-only documents and teacher views | Highlighting works. It mutates nothing persisted, and is arguably most valuable there. |
| Document switch | State dies with the content model. No cleanup code required. |
| Same document in 4-up or thumbnails | All views sharing the content model highlight together. Acceptable and arguably desirable. |

## Testing

**Unit — resolver registry** (`tile-reference.test.ts`): object-kind identity; variable-kind
happy path; unknown kind; unresolvable variable id.

**Unit — Dataflow `getObjectsForVariable`** (`dataflow-content.test.ts`): matches a Sensor
node via `simulatedChannel()`; matches a Live Output node via `simulatedHubName()`; excludes
the other nine node types; returns `[]` after a variable rename — encoding the known
fragility as a test rather than a comment.

**Unit — highlight state** (`document-content-with-highlights.test.ts`): hover-beats-pin
precedence; hovering reference B while reference A is pinned highlights only B's targets,
not A's; mouse-out reverts to pinned rather than clearing; toggle pins and unpins;
`activeTargets` recomputes when a targeted node is removed.

**Component — `DataflowNode`**: correct class for pinned, preview, and neither.

**Cypress — one spec**: hover a text variable chip → associated Dataflow nodes preview;
mouse-out → preview clears; click → pins; click again → unpins. Node selectors already exist
in `cypress/support/elements/tile/DataflowToolTile.js`.

No persistence tests, because nothing is persisted.

## Files touched

New:
- `src/models/highlights/tile-reference.ts` (+ test)
- `src/models/document/document-content-with-highlights.ts` (+ test)
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
