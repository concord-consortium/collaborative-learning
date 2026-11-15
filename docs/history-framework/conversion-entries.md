# Conversion entries

**Status: built.** This doc describes conversion entries and how history playback crosses them. Keep
it up to date as either changes.

A tile or shared model type can register a schema version and a converter (`ISchemaVersionInfo`).
When a document is loaded, `createDocumentModel` converts its old tiles and shared models before MST
sees them (`convertContentJson` in `schema-conversion.ts`), and records the conversion as a
**conversion entry**: a history entry with `isConversionEntry: true`. Its patches turn each
converted model's stored JSON into its converted JSON, and its inverse patches turn it back. It is
not undoable. For how to change a tile's schema, see
[tile-schema-changes.md](../tile-schema-changes.md).

## When it is added to the history

The conversion entry is not added to the history when the document loads. The TreeManager holds it
as `pendingConversionEntry` and adds it just before the first entry that changes the content
(`completeHistoryEntry`), so it is saved along with the converted content it describes. A document
that is only viewed never adds one. If the content is replaced before then
(`DocumentModel.setContent`), the pending entry is rebuilt from the new content.

Concurrent documents (group and class-wide) are not converted this way. Their snapshot preprocessors
convert them as MST loads them, and nothing is recorded.

## A conversion entry is never applied to an MST tree

Its patches are separate diffs in each direction rather than paired changes, and the live tree has
already loaded the converted models. Undo and redo never reach one because it isn't undoable.
Playback gives it no patches and crosses it with model replacements instead (see "Playback across
conversions" below).

## Playback across conversions

`TreeManager.goToHistoryEntryPosition` moves every tree from the current history position to another
one in a single batch. An entry's recorded patches are in the format the document had when it was
recorded, so once a history holds a conversion entry, the entries before it can carry patches the
current MST models reject or misread. Playback crosses them using a JSON copy of the document and a
patch source.

### Patch sources

A **patch source** (`IPlaybackPatchSource` in `playback-patch-source.ts`) is what
`goToHistoryEntryPosition` asks for the patches each tree receives. History entries record what
happened, in whatever format the document had then, and the patch source turns that record into
patches the current MST models accept. It has two methods:

- `getPatches(entry, treeId, direction)`: the patches a tree receives for one entry, going forward
  (redo) or backward (undo). The move and the rollback after a failure both use it, so they agree on
  what was applied.
- `getModelReplacements(treeId)`: whole-model `replace` patches the tree applies after all of the
  move's patches, in the same action.

`defaultPatchSource` returns each entry's recorded patches unchanged, gives conversion entries no
patches, and has no model replacements. Every document that doesn't need a JSON copy (see below)
uses it.

### The JSON copy

When the history holds a conversion entry, a pending one was handed over, or a history bridge finds
a conversion the history never recorded (`needsJsonCopy`), the first move builds a `JsonHistoryCopy`
of the main document from its snapshot. The copy is plain JSON. It applies every entry as stored,
conversion entries included, so it can be at any position in any format. Each move moves the copy
first, one entry at a time. `applyJsonPatches` applies an entry all or nothing, so if an entry
doesn't apply, the copy stops before it and the trees stop at the same position.

Playback runs on a copy of the document that the canvas makes (`canvas.tsx`), with the history from
Firestore. If the live document converted old content and its conversion entry is still pending, the
Firestore history doesn't have that entry, but the copy's content is converted. So the canvas hands
the pending entry to the playback copy's TreeManager as `localConversionEntry`. It stays out of the
history. The JSON copy starts from the document's JSON with that entry undone (`getJsonCopyStart`),
so it holds the stored content the Firestore history reaches.

### History bridges

A conversion made before conversion entries were recorded, or in a concurrent document, which
doesn't record them yet, has no conversion entry. A plugin can register a **history bridge**
(`registerHistoryBridge` in `history-bridges.ts`) that recognizes such a history and reports its
**virtual conversions**: for each one, a model path, the position the conversion sits at, and the
model's old JSON just before it. A local conversion entry that the history doesn't hold yet is
passed to the bridges as if it came after the history, so a bridge can see that it records a
conversion. The JSON copy crosses a virtual conversion like a conversion entry. Going backward it
sets the model to the old JSON the bridge rebuilt, and going forward it undoes that. When a bridge
can't rebuild a model's old JSON, or the model isn't in the copy when the copy reaches the
conversion, the copy can't cross that conversion backward, so playback treats its position as the
oldest it can reach and says "Earlier history isn't available." It does not show the failure banner.

DataFlow's legacy bridge (`legacy-dataflow-history-bridge.ts`) is the example. Legacy DataFlow tiles
store their program in an older format, and the history of a tile converted without a conversion
entry goes straight from patches in that format to patches in the current one. For each tile, the
bridge finds the last entry with a legacy patch and puts a virtual conversion after it. It skips the
tile when the next entry that touches the tile is a conversion entry that converts it from legacy,
one with a legacy patch on the tile in its forward or inverse patches, since that entry records the
conversion. A conversion entry from a later schema change doesn't count. Conversion entries
themselves don't count as legacy entries. To rebuild the tile's old JSON, the bridge looks back from
the last legacy entry for the nearest entry that adds or replaces the whole tile, or a model that
holds it, such as the tile map. It then replays the patches on the tile forward from there through
the last legacy entry. If no entry adds the tile, or a patch doesn't apply, the bridge falls back to
the undo patches of the next entry that touches the tile, when they put back the legacy tile, as
when that entry deletes it. Otherwise the old JSON is left undefined and playback stops at the
conversion.

### Old models and model replacements

For each move, `moveJsonCopy` in `tree-manager.ts` decides which models are **old**, meaning they
need conversion (`modelJsonNeedsConversion`: the version isn't current and the converter doesn't
decline it). A model is old in a move when:

- it is old in the copy at the start or at the end of the move;
- a patch in the move carries a value that holds an old version of it, which finds a model added and
  removed within the move, absent at both ends; or
- a conversion entry or a virtual conversion in the move changes it.

The move's patch source (`createOldModelPatchSource`) then keeps every patch of an old model away
from MST:

- patches inside an old model are dropped;
- a patch that adds or replaces a whole old model carries its converted state at the target, and a
  patch above an old model, such as a replace of the whole tile map, carries converted values;
- each old model that exists at the target gets one **model replacement**: a whole-model `replace`
  patch holding its state there, converted, from the copy.

This is how playback crosses a conversion entry: a tree gets no patches for the entry, and every
model the entry changed is replaced instead.

MST updates a replaced model in place. Its `TileModel` and content nodes are kept, so their
`afterCreate` and `afterAttach` hooks don't run again and their volatile state stays. Children whose
ids are unchanged are updated, and children with new ids are destroyed and created fresh. The copy
converts each old model at most once per position.

Because the patches inside an old model are dropped, a node added to it during the move doesn't
exist until the model replacements are applied, at the end of the action. A patch outside the model
can still set an MST reference to that node: MST resolves references when they are read, and the
reference resolves once the replacement adds the node. But a read before then throws, or returns
false from `isValidReference`, and a later patch in the move that goes into a newly added node runs
that node's `afterCreate` and `afterAttach` hooks early. So a hook that reads such a reference can
see it missing. References to a whole tile or shared model don't have this problem, because an old
model that appears during a move is added by its own patch, in order. The tests in `mst.test.ts`
under "references to a node added later in the same action" show this behavior.

### Failures

Playback stops with the failure banner, keeping the trees and the JSON copy at the same position,
when:

- An entry doesn't apply to the copy. The move stops before that entry.
- A conversion throws. The move doesn't advance.
- MST rejects a patch. The move stops before the failing entry, the entries applied past that point
  are rolled back, and the copy moves back to the same position. If a rollback can't be built there,
  because a conversion throws, the move rolls back to where it started.
- MST rejects a model replacement. The whole move rolls back to where it started.

Moving the copy back after one of these failures uses the entries' recorded patches in the other
direction, and an entry that applied one way doesn't always apply the other way. If the copy can't
get back to where the trees are, the two no longer agree, and playback stops for good: the error is
logged with `console.error`, the entry that blocked the copy gets a failure marker,
`TreeManager.jsonCopyOutOfStep` is set so later moves do nothing, and the playback control says
"History playback stopped because of an error. Close and reopen the history to try again." Reopening
the history makes a new playback copy. When the copy stops short while a rollback is being built,
the rollback's model replacements come from the copy, so the old models show their state at the
copy's position, not the trees', until the history is reopened.

Errors in the MST trees don't stop playback this way. A rollback that can't be built or applied, or
an error that isn't a patch or model replacement failure, is logged, and playback carries on from
wherever the trees are.

## Related docs

- [catch-up-at-load.md](catch-up-at-load.md) — How a document opened for editing catches up to its
  history, undoing the pending conversion entry before it applies the missing entries.
- [start-editing-entry.md](start-editing-entry.md) — The planned entry recorded when a document is
  opened for editing, and how it differs from a conversion entry.
- [tile-schema-changes.md](../tile-schema-changes.md) — How to change a tile's or shared model's
  saved format, which is what makes a load convert old models.
