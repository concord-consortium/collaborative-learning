# Changing a tile's schema without breaking history

If you change the saved format of a tile or a shared model (rename a property, move a field,
change how ids are made, remove something), old documents have to be converted as they load. This
doc says what else to do so that history, and so time travel, keeps working across the change.

## What history is for, and why the chain must stay intact

A document's history is a list of entries. Each entry holds JSON patches (forward and inverse)
that take the document from one state to the next. See [history-framework.md](./history-framework.md)
and [undo-and-time-travel.md](./undo-and-time-travel.md).

Two kinds of reader use that chain:

- **CLUE's playback** walks the entries backward and forward from the document's current content.
- **Services that don't run CLUE's code** can rebuild the document at any entry by applying the
  stored JSON patches with an ordinary JSON patch library. An analysis service looking at student
  work, or a service that stores full document states at intervals, works this way.

Conversion at load is not an MST action, so on its own it records nothing. Old entries would keep
the old paths and values, new entries would use the new ones, and nothing in between would say the
format changed. Playback would stop with the failure banner at the first old entry that touches a
changed part of the tile, and a patch-applying service would fail the same way.

To prevent that, a load that converts old tiles or shared models records a **load entry**. A load
entry records the changes CLUE made to the stored content while loading it. Today those are schema
conversions. Its patches take each converted model from its old JSON to its converted JSON, and
back. They come from a generic diff, so you write nothing for them. The entry is flagged
`isLoadEntry` and `background`, and it is never undoable. Playback applies it like any other entry
to a plain JSON copy of the document, so it can cross the change in either direction. It never
applies it to a live MST tree.

For this to work you tell the system which version your type's JSON is at, and how to convert an
older one. Everything else is done for you.

## The checklist

1. **Bump the version.** The version lives wherever your type keeps it (DataFlow's `program.id`,
   Drawing's `version`, and so on). It need not be a single field: DataFlow reads a program with no
   id as legacy when it has a `values` map. A type that has never had one adds one with its first
   schema change.
2. **Register `schemaVersion`** if the type has none. It goes in the tile's
   `registerTileContentInfo` call, or in the shared model's `registerSharedModelInfo` call. The
   shape is `ISchemaVersionInfo` in
   [schema-version-info.ts](../src/models/tiles/schema-version-info.ts):

   ```ts
   registerTileContentInfo({
     type: kMyTileType,
     // ...
     schemaVersion: {
       // the version this release writes
       currentVersion: kMyTileVersion,
       // reads the version from the whole TileModel JSON (not only `content`); must cope with
       // JSON saved before the type had a version, for example by returning the oldest version
       getVersion: tile => tile?.content?.version ?? "1",
       // takes the whole tile JSON at any older version and returns it at currentVersion;
       // JSON that is already current is returned unchanged, and JSON it can't handle gives
       // undefined
       convertSnapshot: convertMyTile
     }
   });
   ```

   For a shared model, `getVersion` and `convertSnapshot` get the shared model's JSON instead of a
   tile's. A type with no `schemaVersion` is always treated as current. Both functions are plain
   functions on JSON with no MST or store imports.

   A model is **old** when its version isn't `currentVersion` and `convertSnapshot` accepts it.
   `convertSnapshot` returns `undefined` for JSON it can't handle, such as a tile saved by a newer
   release that reaches an older client after a rollback, or from a stale tab. A model it declines
   is treated as current: it loads through MST as it would without a `schemaVersion`, nothing is
   recorded for it, and playback applies its patches as usual. What `convertSnapshot` returns must
   be at `currentVersion`; in development, the load warns when it isn't, naming the model's path and
   both versions.
3. **Write the migration in `convertSnapshot`, and have the preprocessor call it.** Conversion is
   not an MST snapshot preprocessor, because those only run inside MST, and only on the model that
   defines them. `convertSnapshot` is the one place the migration lives. Document load and
   playback call it on JSON. Your `tileSnapshotPreProcessor` (or the model's `preProcessSnapshot`)
   still runs when old content enters through an action, such as pasting an old tile, so it should
   call the same function rather than repeat it, and pass a snapshot it declines through to MST
   unchanged. DataFlow's registration shows the pattern:
   [`convertDataflowTileSnapshot`](../src/plugins/dataflow/dataflow-registration.ts) is
   `convertSnapshot`, and `tileSnapshotPreProcessor` wraps it.

   ```ts
   function convertMyTile(tile: any) {
     const version = getMyTileVersion(tile);
     if (version === kMyTileVersion) return tile;
     // A version this release doesn't know, such as one from a newer release.
     if (!kOlderVersions.includes(version)) return undefined;
     // Return a new object; don't modify `tile`.
     // Handle every older version, not only the one just before this release.
     return { ...tile, content: { /* converted content, with version: kMyTileVersion */ } };
   }

   registerTileContentInfo({
     // ...
     tileSnapshotPreProcessor: tile => convertMyTile(tile) ?? tile,
     schemaVersion: {
       currentVersion: kMyTileVersion, getVersion: getMyTileVersion, convertSnapshot: convertMyTile
     }
   });
   ```

4. **Add fixtures of old content with old history.** Keep small examples of the old format: a tile
   as it was saved, and history entries recorded against it. They are what proves the conversion
   and the chain still work.
5. **Add a crossing test.** Model it on
   [tree-manager-conversion.test.ts](../src/models/history/tree-manager-conversion.test.ts), which
   uses the test-only tile and shared model types in
   [schema-conversion-test-types.ts](../src/models/history/schema-conversion-test-types.ts). Start
   from an old-format document with old-format history. Load it so the load entry is
   recorded, add new-format entries, then scrub backward to the start and forward to the end.
   Check that there are no playback failures, that the JSON copy equals a plain replay of the stored
   entries at each position, and that each MST tile equals its JSON run through `convertSnapshot`
   (ids aside). [dumb-rebuild.test.ts](../src/models/history/dumb-rebuild.test.ts) shows the other
   half: rebuilding every position from the stored entries with only a JSON patch library, which is
   what a service without CLUE's code does.

## How playback crosses the change

Playback only does extra work for a document whose history has a load entry, or an entry in
a legacy format that a registered history bridge recognizes. A bridge
([history-bridges.ts](../src/models/history/history-bridges.ts)) finds conversions that history
never recorded; DataFlow's
[legacy bridge](../src/plugins/dataflow/model/legacy-dataflow-history-bridge.ts) is the example.
Other documents play back as before, with no JSON copy.

When it does, playback keeps a JSON copy of the document beside the MST trees and applies every
entry it crosses to that copy as stored. At each move it asks `getVersion` about the tiles the move
touched, at both ends of the move, and `convertSnapshot` where the version differs. A tile that is
current at both ends gets its patches applied to the MST tile as usual, and so does a tile its
converter declines. A tile that is old at either end is **loaded**: playback runs
`convertSnapshot` on its JSON at the target position and replaces the MST tile's state with the
result, in the same action as the move's other patches.

If an entry doesn't apply to the JSON copy, or `convertSnapshot` throws, playback stops there and
shows the failure banner. If a bridge can't rebuild a tile's old state, playback treats that
boundary as the oldest position it can reach and says "Earlier history isn't available." It does
not show the failure banner.

## Ids

If your conversion has to make new ids, you choose how.

- **Deterministic ids** (made from the tile id and something stable in the old data) mean every
  conversion of the same JSON gives the same ids. Playback causes no churn, because loading the tile
  again updates the same objects. Two clients that convert the same document also agree. Legacy
  DataFlow node ids are an example: `<n>@<tileId>`, from the old node number and the tile's id.
- **Random ids** are the right choice when deterministic ids could collide, or when keeping them
  stable would make the conversion hard to maintain. Playback pays for it: each load of an old tile
  makes different ids, so MST replaces the objects, their components remount, and highlight and
  selection refs on them drop. Playback is read-only, so this is acceptable unless the tile writes
  a lot of history (see Performance).

## Loads are in place

A tile loaded during playback keeps its `TileModel` and content nodes. Their `afterCreate` and
`afterAttach` hooks don't run again and their volatile state stays. Children whose ids are
unchanged are updated, and children with new ids are destroyed and created fresh. Updating in place
is deliberate: removing and re-adding a tile would drop it from the shared models that refer to it.

So views must not depend on state that is set only in `afterCreate` from properties a load can
change. Compute it in a view, or update it when the property changes.

## Shared models

Shared models use the same `schemaVersion` registration and the same playback path. A migration
must keep the ids that tiles refer to, for example a DataSet's attribute and case ids. Otherwise a
tile loaded at an old position points at objects that no longer exist in the shared model.

## Performance

Each load of an old tile runs its conversion. Playback loads an old tile once per move that touches
it, not once per entry passed, but a tile that writes many entries (DataFlow's ticks, the
Simulator's steps) is touched by many moves. For those tiles, use deterministic ids so reloads
change little. If that isn't enough, a tile may later add a patch-level migration, converting its
old patches to current-format patches so playback doesn't reload the tile. That is not built yet.

## Worked example: removing DataFlow's `programZoom`

`DataflowContentModel` keeps a deprecated `programZoom` property only so old `/programZoom/...`
patches still resolve against the MST tree. It is unread, but removing it would make those patches
throw during playback.

With the mechanism above, removing it needs only:

- a version bump in the DataFlow state (a new `STATE_VERSION_CURRENT`), and
- a `convertSnapshot` step that drops `content.programZoom` from older tiles.

The recorded load entry removes the field from the converted tile. Old `/programZoom/...`
patches still apply to the JSON copy, which holds the old format at those positions, and playback
loads the old tile through the conversion, so the MST model never sees a `programZoom` patch. No
code change is made for this here. This is a description of what the change would take.

## Concurrent documents

Concurrent documents are the ones with the `concurrent` flag: group documents, and class-wide
collaborative documents such as the driving-question board. They don't record load entries yet,
and `convertStoredContent` in `document.ts` skips them on purpose. The concurrent history manager
applies every incoming entry's patches straight to each client's live document, not to a playback
copy. A load entry recorded there would therefore be applied to every other client's live document,
and then saved. A client released before concurrent documents learn to handle load entries has no
way to refuse one.

Their playback works like any other document's: the history bridges and the JSON copy apply to it,
so legacy DataFlow history in a concurrent document plays back across the conversion. Two problems
are unsolved for them. Clients converting the same old document at the same time each make their
own load entry. A tab still running an older release can't apply a newer conversion's entries and
would keep writing old-format ones.

The plan has two steps. First, a client of a concurrent document that receives a load entry doesn't
apply it, stops editing, and asks for a reload. Then concurrent documents record load entries and
merge them with concurrent edits, and the stop narrows to conversions whose version the client
doesn't know. The check can only stop clients that already have it, so the first step has to ship
at least one release before the second, so that tabs old enough to lack it are unlikely to still be
open.

## Known limit

Playback starts from the document's saved content. If that content was saved before its last few
entries reached history, the starting state is wrong, and this affects playback across a conversion
the same way it affects playback without one. The history that reaches the load entry may also be
incomplete in that window: if playback is opened after the converted content is saved but before
the load entry is written, the entry isn't there yet.
