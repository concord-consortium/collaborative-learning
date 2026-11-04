# CLUE-773: History playback across tile schema changes

Status: design, 2026-11-03.

## Why

When we change a tile's schema, we write a snapshot migration that converts old content as a
document loads (`tileSnapshotPreProcessor`, `DrawingMigrator`, `convertLegacyDataflowProgram`, ...).
Nothing records that conversion in the document's history. Entries written before the change keep
the paths and values of the old schema, entries written after it use the new one, and nothing in
between says the content changed format. Playback walks backward from the converted content, so the
first old entry that touches a changed part of a tile throws, and playback stops there with the
failure banner. Every schema change risks breaking playback of every older document that used that
tile, and nothing tells the developer.

The code already has one workaround: `DataflowContentModel` keeps a deprecated `programZoom`
property only so that old `/programZoom/...` patches still resolve.

The `clue-dataflow-behavior` study (cc-data-studies) measured the damage. Of 411 DataFlow documents
whose history starts in May 2024 or later, 174 stop on an entry in the legacy DataFlow format and
can't be scrubbed back to their start. Researchers want to see that early program history.

History has a second audience besides CLUE's playback. It is meant to let a "dumb" service, one
that doesn't load CLUE's code, rebuild the document at any entry by applying JSON patches. For
example, a service analyzing student work can look at log events, history entries and the document
state at any point. A keyframe service can store full document states so clients download one and
apply entries from there, rather than uploading full states themselves. Neither can do that across
a schema change today, because the conversion isn't in the history.

This story makes a schema change a recorded event in history, with real patches, and teaches CLUE's
playback to cross it. Legacy DataFlow, which was converted before any of this existed, is the first
customer.

## Goals

- **Stored history is a correct chain of JSON patches.** Old entries apply to old-format state, a
  conversion entry takes the content from the old format to the new, and new entries apply to the
  new format. Anything that can apply JSON patches can rebuild the document at any entry, in either
  direction, without CLUE's code.
- **A client that converts content records a conversion entry** with forward and inverse patches
  between the old and new forms of each converted tile.
- **A schema change needs little beyond what it needs today**: a version bump, a conversion function
  on plain JSON in place of a snapshot preprocessor, and a function that reads a tile's version from
  its JSON. A patch-level migration is an optional optimization a tile can add later.
- **CLUE's playback crosses conversions.** It keeps a JSON copy of the document, finds which tiles are
  in an old format at the position it is showing, converts their JSON, and loads it into those
  tiles.
- Shared models use the same mechanism.
- Legacy DataFlow documents in the study play back to their start (see the pass bar in section 6).
- A developer doc says what to do when changing a tile's or shared model's schema.
- A design, not yet built, for group documents: concurrent conversions and clients on different
  schema versions.

## Non-goals

- **Rewriting stored history entries.** This story doesn't rewrite them, but a later script may. If
  it rewrites the stored content too, old formats would disappear from storage and the runtime could
  drop their conversion code. Nothing here rules that out, and conversion functions on plain JSON
  (section 1) are what such a script would run. How it keeps the chain correct is that story's
  problem.
- **Writing conversion entries into stored legacy DataFlow histories.** CLUE builds them in memory
  at read time (section 6). A follow-up script can store them so dumb services can cross the legacy
  conversion too.
- **Patch-level migrations.** The design leaves room for them (section 3). No tile gets one in this
  story.
- **Removing DataFlow's `programZoom`.** No code change here. It is the worked example in the
  developer doc (section 8).
- **Requiring deterministic ids.** Each tile decides (section 1). No tile's conversion changes in
  this story.
- **The playback failures that aren't schema changes:** session-end gaps, missing tiles or nodes in
  2026 documents, failures when undoing the first entry, and content saved behind history. Each
  becomes its own story. The last one waits for CLUE-751.
- **Fixing past migrations in other tiles.** This story audits them (section 9); fixes are
  follow-ups.

## Anti-goals

- **CLUE's runtime never rewrites stored entries.** The only new thing it writes is the conversion
  entry, from the client that converted the content. (A separate script may, per Non-goals.)
- **Playback never shows a state it can't vouch for.** When an entry doesn't apply, or an old tile
  can't be loaded, playback stops there and says so (section 7). It doesn't guess.
- **Documents with no conversions must not get slower to play back.** CLUE-783 just made large
  histories fast. A document with no conversion entries and no legacy entries plays back exactly as
  it does today, after a scan of its entries.
- **The conversion entry must never be applied to a live document's MST tree.** Its inverse would
  put old-format content into a live document, which the next load converts again with new random
  ids.

## Lifecycle of a schema change

1. **Release N** ships the schema change: the version bump, the conversion function, and the version
   reader if the type doesn't have one. From then on, a client that converts content records a
   conversion entry, and playback crosses it.
2. Nothing else is required. The conversion function stays as long as old content or old history
   exists, as snapshot migrations do today.
3. **Optionally, later:** if playback across the conversion is too slow for a tile that writes many
   entries, the tile adds a patch-level migration (section 3). A rewrite script (Non-goals) could
   one day retire the conversion function.

For group documents, the client check in section 4 has to ship at least one release before the
first schema change that relies on it.

## Design

### 1. Versions

Each tile type and shared model type that has had a schema change has a version, stored in its
content. DataFlow already has one (`program.id`: `"dataflow@0.1.0"` → `"dataflow@1"`, in
[dataflow-state-versions.ts](../../../src/plugins/dataflow/model/dataflow-state-versions.ts)), and so
do Drawing (`version`) and Diagram (`version`). A type without one adds one with its first schema
change under this process.

The version lives wherever the type keeps it, so the system can't find it on its own. Each type with
a version registers, in `ITileContentInfo`
([tile-content-info.ts](../../../src/models/tiles/tile-content-info.ts)) or the shared model's
registration:

- **`getVersion(json)`**: reads the version from a tile (or shared model) snapshot as plain JSON. It
  must handle snapshots from before the type had a version field, for example by returning the
  oldest version.
- **`currentVersion`**: the version this release writes.
- **`convertSnapshot(json)`**: takes the whole tile's JSON (the `TileModel` snapshot, not only its
  content, since some conversions move fields between the two) at any older version and returns it
  at `currentVersion`. Current JSON comes back unchanged. For a shared model, it takes the shared
  model's JSON.

A tile is **old** when `getVersion` of its JSON differs from `currentVersion`. Types that don't
register a version are always current.

**Conversion is its own function, not an MST snapshot preprocessor.** Preprocessors run only inside
MST, and only at the level of the model that defines them, so playback and scripts can't call them
on JSON. `convertSnapshot` is the one place a type's migration lives. Section 2 calls it on load,
section 3 calls it during playback, and a future rewrite script could call it too. The type's MST
preprocessor, which still converts old content that enters through an action (pasting an old tile,
a legacy `setProgram` value), calls `convertSnapshot` rather than repeating it. Legacy DataFlow's
`convertLegacyDataflowProgram` is already a plain function on JSON, so its `convertSnapshot` wraps
it. Other tiles' existing preprocessors stay as they are until a tile registers a version under
this process.

`getVersion` and `convertSnapshot` are plain functions on JSON with no MST or store imports, so a
script can use them. A dumb service needs neither, because the conversion entry carries the change as
patches.

**Ids are the tile's choice.** Where a conversion has to make new ids, it may make them
deterministic, for example from the tile id and an old index the way legacy DataFlow node ids are
`<n>@<tileId>`. Then every conversion of the same JSON gives the same ids, and playback doesn't churn
(section 3). Where that isn't safe, because the ids could collide or keeping them stable would make
the conversion hard to maintain, it uses random ids, and playback pays the churn. The developer doc
(section 8) explains the tradeoff.

### 2. The conversion entry

**Why today's code records nothing.** `createDocumentModel` builds the document with
`DocumentModel.create(snapshot)` ([document.ts](../../../src/models/document/document.ts)), and the
preprocessors run inside that call, so the model starts out converted. The `TreeMonitor` is attached
afterward, in the document's `afterCreate`, and it records patches only from actions on an existing
tree. As far as MST is concerned nothing changed. Old content that enters through an action (pasting
an old tile, a legacy `setProgram` value) is converted as its node is created, so its recorded patch
carries the converted value and needs no conversion entry.

**What it holds.** One entry per load that converted anything. It has a record with ordinary forward
and inverse patches, so any JSON patch applier can cross it:

- For each converted tile, the patches take its JSON from the old form to the converted form, and
  back. They come from a generic JSON diff of the tile's snapshot before conversion and its
  snapshot after, under the tile's path (`/content/tileMap/<tileId>`). They are fine-grained, not a
  whole-tile replace. The diff is of the whole tile, not just its content, because some
  preprocessors move fields between the two (Table and Geometry moved `title`).
- Shared models converted at the same load go in the same entry, under
  `/content/sharedModelMap/<id>/sharedModel`.
- The developer writes nothing for this. The diff is generic.

**It is flagged as a conversion entry** so the parts of CLUE that apply entries to live MST trees can
recognize it. The flag's name is the builder's.

| Who | What it does with a conversion entry |
|---|---|
| Undo | Never undoable. |
| Concurrent manager (group documents) | Section 4. |
| Playback's JSON copy | Applies it like any other entry, in both directions. |
| Playback's MST trees | Never applies it. Playback reads tile versions from the JSON copy instead (section 3). |
| Dumb services | Can ignore the flag. |

**Detecting the conversion** is new code. Before `DocumentModel.create`, the load compares each
tile's `getVersion` with its type's `currentVersion` and runs `convertSnapshot` on the old ones. The
document is created from the converted JSON, so the preprocessors find nothing to do. The entry is
the diff between each old tile's JSON and its converted JSON, built once history has loaded.

**Who records it.**

- **The client that saves the document** (the owner's) records it after history has loaded, and
  saves it with the converted content. The entry goes into history just before the first local
  entry that changes the content. Content is saved only when it changes, so an entry that changes
  only the document's title or other metadata leaves the conversion entry pending. Flushing it then
  would store it next to old content, and the next load would convert again with new ids.
- **A read-only viewer** (a teacher or researcher) adds it to its in-memory history only and never
  uploads it.
- **The playback copy needs it too.** Playback builds its document from a snapshot of the live,
  already converted document and loads history from Firestore itself (`createHistoryDocumentCopy`
  in [canvas.tsx](../../../src/components/document/canvas.tsx)). That copy sees no conversion, so a
  viewer's live document hands its in-memory conversion entry to the copy. A saving client's entry
  is uploaded, and Firestore's local cache shows a pending write to listeners in the same browser,
  so the copy finds it. The one gap is playback opened in the short window after the converted
  content is saved and before the entry is written. That is left to CLUE-751, which handles the
  order of content and history saves.
- **Content replaced after load.** `setContent` replaces a loaded document's content. It runs
  when the content listener updates a document a teacher monitors, or one of the owner's own
  documents that isn't open, and when a network document's content is fetched. It converts the
  incoming content the same way the load does. It rebuilds the pending entry from that content,
  or clears it when nothing is old, so a pending entry always describes the stored content against
  the live content. Only the pending entry changes; one already in history stays.
- **Group documents** record conversion entries only once section 4 is built. *My call.* Until
  then they behave as today. A schema change that relies on section 4 can't ship before it anyway.

*My call:* it carries CLUE-760's `background: true` (this story adds the optional field if CLUE-760
hasn't landed yet), since it is produced by code, not by a person.

**It stays in history for good.** Nothing deletes or rewrites it, so the content's saved
`lastHistoryEntryId` and links from logged events can point at it safely.

**Known limit: its size.** A conversion entry's size grows with what the conversion touches. Each
changed value is stored in both directions, and each patch carries its full path. An entry is
uploaded as one Firestore document, and Firestore allows 1 MiB per document. Legacy DataFlow
programs are small, so this story's conversions are well under it. A story that adds a conversion
that could get that large, such as a shared model migration that touches every case of a large
data set, needs a fallback, such as a whole-model `replace` in each direction. Until then the
builder logs an error with the entry's size and the document when an entry is over the limit.

**What existing data already has.** In the study's history, no entry records a conversion. The
version does appear as state, inside whole-tile values: 2,602 of the 5,800 histories add a DataFlow
tile whose `program.id` is `"dataflow@0.1.0"`, and 290 add one at `"dataflow@1"`. Legacy DataFlow
documents need the bridge in section 6.

### 3. Playback across a conversion

**A JSON copy of the document.** When a document's history has a conversion entry (or legacy
entries, section 6), playback keeps a plain JSON copy of each tree beside the MST playback trees.
Every entry playback crosses is applied to the JSON copy as stored, in either direction, the
conversion entry included. A document with neither skips all of this and plays back as today.

The JSON copy starts from the same snapshot as the MST trees: the current, converted document. Going
backward across a conversion entry, its inverse patches return the copy to the old format, and the
old entries before it then apply to the copy as they were recorded.

**Which tiles are old.** Playback calls `getVersion` on the JSON copy of each tile the move touched,
at both ends of the move. A tile that is current at both ends has its patches applied to the MST
tree as today. A tile that is old at either end is loaded: playback runs `convertSnapshot` on its
JSON at the target position and puts the result into the MST tile, so the MST tree always holds
current-format tiles. "Either end" covers a move that crosses the conversion: going forward out of
the old region, the MST tile holds a converted copy with made-up ids, and the new-format patches
refer to the real ones, so the tile is loaded from the JSON, which holds the real state.

**How a tile is loaded.** By a `replace` patch at the tile's path, `/content/tileMap/<tileId>`, with
the converted JSON as its value, in the same `applyPatch` call as the move's other patches. A
`replace` patch and `applySnapshot` do the same thing to an existing node in MST: the patch assigns
the value, MST reconciles it with the node there, and since the type and `id` match it calls
`applySnapshot` on that node (`tryToReconcileNode` in mobx-state-tree). So the tile's preprocessors
and lifecycle hooks behave the same either way; only the action's name differs (`@APPLY_PATCHES`
or `@APPLY_SNAPSHOT`), which matters only to middleware. The patch keeps the load inside the existing
batched apply.

The difference that matters is **updating the tile in place versus removing it and adding it
again**. Reconciling keeps the `TileModel` and content nodes. Their `afterCreate` and `afterAttach`
don't run again and their volatile state stays. Children whose ids are unchanged are updated, and
children with new ids are destroyed and created fresh. Removing and re-adding the tile would also
break references to it: `SharedModelEntry`'s `tiles` and `provider` are `safeReference`s
([shared-model-entry.ts](../../../src/models/document/shared-model-entry.ts)), which drop a tile the
moment it is detached, so a re-added tile would silently fall out of its shared models. So a tile is
always loaded in place.

**One action per tree.** Today a tree applies a move's patches in a single MST `applyPatch` call
inside one action (`applyPatchesFromManager` in [tree.ts](../../../src/models/history/tree.ts)),
between `startApplyingPatchesFromManager` and `finishApplyingPatchesFromManager`, which hold off
shared-model syncing until the end. MobX reactions run when the outermost action ends, so nothing
observes the tree part-way through, even when two tiles' patches are interleaved. The new apply
keeps that. For each old tile in a move:

- Patches below the tile's path are skipped.
- Patches at the tile's own path (adding or removing the whole tile) stay where they were recorded,
  because other patches in the move may depend on the tile existing, such as a shared model's
  `tiles` list gaining or losing it. An add's value is replaced by the converted JSON of the tile:
  its state at the target position if it exists there, or the add's own value converted if it
  doesn't.
- A tile that exists at both ends and wasn't added in the move gets one in-place `replace` with its
  converted state at the target position. It can go anywhere in the batch, because the node is never
  detached, so nothing that refers to it changes.

The current tiles' patches are applied in recorded order around these. Each old tile goes from one
complete state to another once per move, which avoids exposing a converted copy of some
intermediate state.

**Where it hooks in.** [tree-manager.ts](../../../src/models/history/tree-manager.ts)
`goToHistoryEntryPosition`, which builds batches through `getEntryPatchesForTree`. Failure location
still works per entry: an entry that doesn't apply to the JSON copy is found exactly, and MST apply
failures for current tiles are handled as today. `replayHistoryToTrees` is only called from tests;
routing it through the same code is *builder's choice*.

*My call:* the concurrent manager's `doApplyHistoryEntries`
([firestore-history-manager-concurrent.ts](../../../src/models/history/firestore-history-manager-concurrent.ts)),
which applies remote entries to a live tree, gets no JSON copy. Live clients receive only
current-format entries, apart from the group-document cases in section 4.

**Cost.** Each load of an old tile runs its conversion, and a conversion that makes random ids (the
legacy DataFlow conversion gives connections random ids) makes different ones on every load. MST
then replaces those objects instead of updating them, and their components remount. Highlight and
selection refs on them drop. Playback is read-only, so this is accepted for a tile without
deterministic ids or a patch-level migration. The cost follows the positions playback shows, not the
number of entries:

- Scrubbing already keeps only the latest request (`runSeekLoop` in
  [playback-control-model.ts](../../../src/components/playback/playback-control-model.ts)), so a
  drag loads each old tile once per seek that runs, not once per entry passed.
- Playing advances one stop at a time and waits for each seek to settle before scheduling the next
  (`advance` in the same file), so it loads each old tile once per stop.
- Applying entries to the JSON copy is cheap.

**Optimizations left for later:**

- **Patch-level migrations.** A tile can supply a function that converts its old patches to
  current-format patches against the MST tree's state, which keeps ids and avoids the reload. The
  developer doc recommends one for tiles that write many entries, such as DataFlow (ticks) and the
  Simulator (steps).
- **Catching up.** If playback falls behind, it could apply entries only to the JSON copy and skip
  the MST work until it catches up. The seek loop's coalescing already does most of this.

### 4. Group documents (design only)

Two problems only group documents have. This story designs the answer; building it is two
follow-ups, and until they ship, group documents don't record conversion entries (section 2).
CLUE-792 makes a group-document client that receives a conversion entry stop editing and ask for a
reload, without applying the entry. CLUE-793 builds the rest of this section. CLUE-792 ships at
least one release before CLUE-793.

**Concurrent conversions.** Two clients on the new release can open an old group document at about
the same time. Each converts it with its own random ids and records its own conversion entry. Only
one can land first.

- **A conversion entry is never rolled back.** Rolling it back would apply its inverse to the live
  tree (see Anti-goals). So the concurrent manager excludes it from `rollbackLocalEntries`.
- **An incoming conversion entry conflicts with every pending local entry**
  (`partitionLocalEntriesForMerge` in [entry-scopes.ts](../../../src/models/history/entry-scopes.ts)),
  so they are all rolled back. Any entry that lands after a conversion entry was made by a client
  that had already received it.
- **The converting client holds edits until its conversion entry is committed.** That is normally a
  moment, and it means there are no pending edits on top of the conversion.
- **If another client's entries land first,** the converting client rebuilds the affected tiles from
  the pre-conversion JSON it kept. It applies the incoming entries to that JSON. If one of them is a
  conversion entry for the tile, the JSON is now the winner's converted tile, with the winner's ids;
  the client loads it into its tile and drops its own conversion for that tile. If they are
  old-format edits, the client converts the JSON again, loads it, and rebuilds its pending
  conversion entry from the new diff.
- A tile with deterministic ids makes this cheaper, since both clients' conversions agree, but
  the design can't rely on it, because ids are each tile's choice.

**Clients on different releases.** A tab still on an older release can't apply a newer conversion's
entries, and its own entries would be in the old format.

- **A client that receives a conversion entry whose new version it doesn't know stops editing.** It
  makes the document read-only and says its copy of CLUE is out of date and needs a reload.
- **Only clients released with the check can be stopped this way.** An earlier client keeps editing
  in the old format. So the check has to ship at least one release before the first schema change
  that relies on it, so tabs that old are unlikely to still be open. *My call:* that is accepted
  rather than adding Firestore rules.

Open points for the follow-up: the wording of the out-of-date message, and whether the read-only
document keeps showing the others' edits.

### 5. Content saved behind history

The JSON copy starts from the saved content, as playback does. When the content was saved before the
last few entries reached history, the starting state is wrong, just as it is for playback today. This
story doesn't change where playback starts. CLUE-751 makes the content's `lastHistoryEntryId` exact,
and a later story starts playback from it.

### 6. The legacy DataFlow bridge

Legacy DataFlow documents were converted before conversion entries existed, so their stored history
goes straight from legacy entries to new-format entries. Playback builds the missing conversion entry
in memory, and from there the general mechanism takes over.

- **Finding the boundary.** For each DataFlow tile, the last legacy entry before its first
  new-format entry. An entry is legacy when its DataFlow patches use legacy paths:
  `program/values/<n>/...`, numeric node ids under `program/nodes/<n>`, legacy `inputs` / `outputs`
  connection paths, or a `program` value whose `id` is `"dataflow@0.1.0"`. Legacy patches appear in
  many actions, not only `setProgram` (`setSlate` and `addCanonicalCases`, for example), so the check
  is by path, not by action.
- **The old state at the boundary.** The conversion entry needs the tile's legacy JSON at the
  boundary, and the stored content only has the converted form. The candidates, in order of
  preference:
  1. **Replay forward from the start.** If a document's history starts from a known state, applying
     the legacy entries forward in JSON gives the legacy tile at the boundary.
  2. **A reverse conversion.** A function from the new format back to the legacy one. The forward
     conversion ([convert-legacy-dataflow.ts](../../../src/plugins/dataflow/model/convert-legacy-dataflow.ts))
     loses information: it drops node `data` fields, the output side of connections and the
     `values` structure, and maps "Heat Lamp" to "Light Bulb". The reverse only has to rebuild
     what the earlier legacy entries touch, but a `remove` or `replace` on a path it didn't rebuild
     fails.
  3. **A patch-level migration** for this one step.

  The harness decides which works on the study's documents. The builder may combine them, for
  example forward replay where the start is known and the reverse conversion elsewhere.
- **Then** the in-memory conversion entry is the diff between that legacy tile and the converted
  tile at the boundary, as in section 2.

The harness is an uncommitted, throwaway Jest file in the CLUE-760 worktree,
`collaborative-learning-CLUE-760/src/models/history/zz-local-replay.test.ts`. It reads the study
data from `cc-data-studies/studies/clue-dataflow-behavior/local-data/clue-documents/`, which holds
student data and stays on the developer's machine.

**Pass bar:** each of the 174 documents plays back to its start, unless it stops on one of the
non-schema causes (see Non-goals) or on a legacy shape the PR names as one the bridge can't handle.

`programZoom` stays.

### 7. When playback can't go further

- **An entry doesn't apply to the JSON copy.** The chain is broken there: a non-schema bug, or a
  conversion with no conversion entry. Playback shows today's failure banner.
- **The legacy bridge can't build the old state.** Playback treats the boundary as the oldest
  position it can reach and says earlier history isn't available, not the failure banner. *My
  call.*
- **A conversion throws on an old tile** (the legacy conversion throws on an unknown node type, for
  example). The failure banner, at that position.

The exact wording and how the slider shows an unreachable range are left to the builder. CLUE-760 is
reworking the same slider, so whichever lands second follows the other.

### 8. The developer doc

A new doc, `docs/tile-schema-changes.md`, linked from
[undo-and-time-travel.md](../../undo-and-time-travel.md) and [tile-creation.md](../../tile-creation.md):

- What history is for, including dumb services, and why a schema change must leave the chain
  intact.
- The checklist: bump the version; register `getVersion` and `currentVersion` if the type has none;
  write the migration in `convertSnapshot` and have the type's preprocessor call it; add fixtures of
  old content with old history; add the boundary test (see Testing).
- **Ids:** when to make new ids deterministic (no churn in playback, and concurrent conversions
  agree) and when to keep them random (when they could collide, or stable ids would make the
  conversion hard to maintain).
- **Loads are in place:** a tile loaded during playback keeps its nodes and volatile state, so its
  views must not depend on state set only in `afterCreate` from properties that a load changes.
- **Shared models:** a shared model migration must keep the ids that tiles refer to (for example a
  DataSet's attribute and case ids). Otherwise tiles loaded at an old position point at objects that
  no longer exist.
- **Performance:** a conversion with random ids gives an old tile's new objects new ids on every
  load. A tile that writes many entries should consider deterministic ids or a patch-level
  migration.
- **`programZoom` as the worked example.** Under this design, removing it needs only a version bump
  and a `convertSnapshot` that drops the field. Old `/programZoom/...` patches still apply to the
  JSON copy, and the old tile is loaded through the conversion. The deprecated property exists today
  only because nothing could cross a conversion. The doc describes it; no code changes.
- Group documents: section 4's check must ship before the first schema change that relies on it.
- The known limit of content saved behind history.

### 9. Auditing the other tiles

Past snapshot migrations in other tiles have no conversion entries either, so their old history may
already be broken. Check each, and say whether playback of those documents breaks today. Known
candidates:

- **Table and Geometry** moved `title` from the content to the tile. Old `/content/title` patches
  may no longer resolve.
- **Drawing**: the `changes`-array format, and 1.0.0 → 1.1.0 (group dimensions became relative).
- **Diagram**: any old version is dropped to empty content.

Start by reading the code and building small test cases with old-format patches. Then check the
conclusions against real documents pulled with cc-data: for each candidate, find documents whose
history predates the change and scrub them with the harness. The pulled data stays local. *My
call:* the result goes in the PR description, and each tile that needs a bridge like section 6 gets
a follow-up story.

## Testing

- **JSON replay matches MST.** Over the study's histories, applying entries to the JSON copy gives
  the same state as applying them to MST trees, wherever the MST apply succeeds. This checks the
  JSON patch applier against MST's handling of maps, arrays, `add` and `replace`, which dumb services
  rely on too.
- **Conversion entry.** Recorded once at a load that converted something. Its inverse patches take
  the converted JSON back to the stored old JSON exactly, and its forward patches take that back to
  the converted JSON. It isn't undoable. A viewer keeps it in memory and hands it to the playback
  copy.
- **Crossing the conversion boundary.** Every schema change gets this test. Start from an old-format
  document with old-format history. Load it so the conversion runs and the conversion entry is
  recorded, then add new-format entries. Scrub backward to the start and forward to the end. No
  playback failures. At every position, the JSON copy equals a plain replay of the stored entries,
  and each MST tile equals its JSON run through `convertSnapshot`, ids aside.
- **Interleaved patches.** An entry that mixes an old tile's patches with a current tile's in one
  record, and one that splits a tile's patches across records. Each old tile is loaded once per
  move, and the result matches the JSON copy.
- **Loads keep references.** A move that loads an old tile attached to a shared model, and one that
  adds an old tile and attaches it in the same entry. The shared model's `tiles` list matches the
  JSON copy afterward.
- **Shared models.** A test-only shared model type with a version and a migration goes through the
  same path.
- **Dumb rebuild.** From the stored entries alone, conversion entry included, a test rebuilds the
  document at every entry using only a JSON patch library and no CLUE imports.
- **Legacy DataFlow.** Fixtures, small documents from the study each with its history, covering:
  legacy ticks (`setProgram` values only), node moves and additions, a connection added and later
  deleted, a whole-program `setProgram`, legacy value patches inside other actions, and a document
  whose bridge needs the fallback. Fixtures are stripped to what the tests need and checked for
  student names and free text before they are committed. The pass bar (section 6) is checked with
  the harness.
- **Can't go further.** A failed legacy bridge shows "earlier history isn't available", not the
  failure banner.
- **No slowdown.** A document with no conversion entries and no legacy entries never builds a JSON
  copy.
- **Performance check** (with the harness, not in CI): play the longest legacy DataFlow history at
  full speed and confirm playback stays responsive and doesn't crash.

## Delivery

The story ships as three stacked PRs, merged in order. Each one is useful on its own.

1. **Record conversion entries.** The `schemaVersion` registration, the JSON patch applier and diff,
   detecting old tiles at load and in `setContent`, building the conversion entry and flushing it
   into history, and DataFlow's `schemaVersion`. Today's playback skips conversion entries in this
   PR, so recording one never changes what playback shows. A test checks that a plain JSON patch
   library rebuilds the end state across a conversion entry.
2. **Play back across conversion entries.** The tree API for loads, the JSON copy, the playback
   patch source, crossing a conversion in both directions, rollback, and handing a pending entry to
   the playback copy (sections 3 and 7).
3. **Bridge legacy DataFlow history.** The history-bridge registry and virtual conversions, the
   "earlier history isn't available" boundary, the DataFlow bridge (section 6), and the developer
   doc (section 8).

Group documents are left out of all three (section 4).

A change to this design made in a later PR updates this document in that PR.

## Related work

- **CLUE-760** (background entries): its `isLegacyBackgroundEntry` rule recognizes legacy DataFlow
  ticks by their legacy paths. This story doesn't rewrite stored entries, so that rule keeps
  working; a future rewrite script would have to keep it working or retire it.
- **CLUE-751** (settled-state saves): makes `lastHistoryEntryId` exact, which the content-behind-history
  fix needs. It should also cover playback opened after converted content is saved but before the
  conversion entry is written (section 2).
- **CLUE-783** (large history performance): the batched apply that the old-tile loads join.
- **CLUE-792** (group documents stop editing on a conversion entry) and **CLUE-793** (group
  documents record conversion entries and merge them with concurrent edits): section 4. CLUE-792
  must ship at least one release before CLUE-793.
- **Follow-up: storing legacy DataFlow conversion entries**, so dumb services can cross the legacy
  conversion. Inserting an entry into a stored chain (its index and the next entry's
  `previousEntryId`) is that story's problem.
- **Follow-ups:** patch-level migrations for DataFlow and the Simulator if the performance check
  calls for them, the non-schema playback failures, and any tile the audit finds.
- **Maybe later: a rewrite script** for stored entries and content, so old formats and their
  conversion code can be retired.

## Decided

- Stored history stays a correct chain of JSON patches that a service without CLUE's code can apply
  in either direction. CLUE's runtime never rewrites entries; a later script that rewrites entries
  and content isn't ruled out.
- A conversion is recorded as a flagged entry with fine-grained forward and inverse patches, made by
  a generic diff. It is never undoable, never applied to a live MST tree, and never rolled back.
- Developers write a conversion function on JSON and a version reader. Conversion can be a new
  system rather than MST snapshot preprocessors. Patch-level migrations are an optional
  optimization.
- Playback keeps a JSON copy, reads tile versions from it, and loads old tiles from their converted
  JSON.
- Each tile decides whether its conversion makes deterministic or random ids. Random ids are
  supported and their churn is accepted.
- Tiles provide `getVersion`, since the version lives inside the tile's content.
- Shared models follow the same pattern.
- Group documents: an incoming conversion entry beats pending local entries, and a client that
  doesn't know its version stops editing. This story designs it (section 4); building it is a
  follow-up.
- The audit checks its conclusions against real documents.
- Pass bar for the 174 legacy documents: play back to the start, or stop on a non-schema cause or a
  named shape the bridge can't handle.
- `programZoom` gets no code change; it is the developer doc's example.

## My calls (check these)

- Group documents don't record conversion entries until section 4 is built.
- The conversion entry carries `background: true`, and this story adds the field if CLUE-760 hasn't.
- Each old tile is loaded once per move, at its state at the target position, in the same action as
  the other tiles' patches.
- Conversion is a registered `convertSnapshot` on the whole tile's JSON, and the type's MST
  preprocessor calls it. Existing preprocessors in other tiles stay until those tiles register a
  version.
- A load is a `replace` patch at the tile's path, so the tile is updated in place. Whole-tile adds
  and removes stay in recorded order.
- Shared models are in this story's mechanism (version reader, JSON copy, loading), with no real
  shared model migration written. A test-only type exercises it.
- The concurrent manager's live apply gets no JSON copy.
- A failed legacy bridge gets "earlier history isn't available". Other failures keep the banner.
- Clients released before the group-document check aren't stopped by it, and there are no Firestore
  rules.
- The audit result goes in the PR description, with follow-up stories.

## Left to the builder

- The flag's name and the shape of the `getVersion` / `currentVersion` / `convertSnapshot`
  registration.
- The JSON patch library and the diff used to build conversion entries.
- The tree API for applying patches and loading old tiles in one action.
- Which of the three legacy bridge approaches to use, decided with the harness.
- The "earlier history isn't available" wording and slider treatment.
