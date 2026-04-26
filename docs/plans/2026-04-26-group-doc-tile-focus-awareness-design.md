# Group Document Tile-Focus Awareness

## Context

When multiple students are simultaneously editing a group document, there is currently no way for any one student to know what their group-mates are doing. This feature adds a lightweight awareness layer: each user broadcasts which tile(s) they have selected, and other group members see that activity rendered as initial-badges in the top-right of the relevant tiles.

The infrastructure is intentionally generic ("activity") rather than focus-specific so future awareness signals (cursor position, currently-active tool, in-progress edits, etc.) can be added without re-architecting.

## Scope

**In scope (initial PR):**
- Broadcast each user's currently-selected tile IDs and the document those tiles belong to.
- Render initial-badges in the top-right of each tile in a group document, listing which group members are focused on that tile.
- Tooltip on hover shows the full names of the focused users.
- Up to 4 badges shown stacked; 5+ users on the same tile show 4 badges plus `+N`.
- Cleanup on disconnect, document close, or empty selection.

**Out of scope (deferred):**
- Per-tile-type fine-grained focus (cursor position, intra-tile selection ranges, active tool). The data schema accommodates these as siblings of `focus`; rendering is not implemented.
- Display in non-group documents. The broadcast schema is doc-keyed and would work for any document, but rendering is gated to documents of type `"group"` for the first cut.
- Changes to the existing group button in the app header.
- Per-user color coding of badges.

## Design Decisions (with alternatives considered)

### "Focused" = currently-selected tile(s)

We reuse `UIModel.selectedTileIds` rather than introducing a separate notion of focus. This piggybacks on the existing selection model and means a user broadcasts focus simply by clicking a tile. Selection is already an array, so multi-tile focus is supported for free.

*Alternative considered:* Per-tile-type "active editing" focus (e.g. text caret in a text tile, drawing tool active in a drawing tile). Rejected for the initial cut — it would require per-tile-type integration and the selection-based signal is already meaningful. The schema leaves room to add this later.

### Display gated to group documents; data layer is doc-agnostic

A user broadcasts `{documentKey, focus: {tileIds}}` regardless of which document they are editing. The renderer gates display to documents of type `"group"`. This separates write-side logic (always broadcast current activity) from read-side policy (which docs warrant rendering).

*Alternative considered:* Only broadcast when in a group document. Rejected because it bakes the "group docs only" policy into every write site. The chosen split keeps future scope expansion (e.g. showing peer activity in 4-up personal docs) as a render-only change.

### Storage: Firebase Realtime Database, indexed by user

Path: `classes/{classHash}/groups/{groupId}/users/{userId}/activity`

A single record per user, mutated in place as they navigate / select. `onDisconnect().remove()` registered once on the user's own activity node.

*Alternative considered:* Index by document — `groups/{groupId}/activity/{documentKey}/{userId}`. This would let a doc viewer subscribe to exactly the records relevant to that doc, avoiding a client-side filter. Rejected because at typical group sizes (~4 users) the read-side filter is one trivial line, while the doc-indexed layout requires a "switch documents" routine that atomically removes the old path, writes the new, and re-arms `onDisconnect` on the new path. The user-indexed layout is harder to corrupt.

### Lifecycle: clear on empty selection, doc close, or disconnect

The activity record is removed (not emptied) under any of:
- `selectedTileIds` becomes empty.
- The user closes / leaves the document (no current document context).
- The user disconnects (Firebase `onDisconnect().remove()`).

This keeps badges from lingering for users who are present-but-idle, which the user explicitly asked for.

### Display: rectangular badges, single color, group-button styling

Up to 4 small rectangular badges shown side-by-side in the tile's top-right, each containing 2-character user initials. 5+ users → first 4 + `+N` rectangle. All badges share a single color and reuse the existing group-button initials styling (typography, sizing) so they read as the same affordance.

*Alternative considered:* Per-user color hashing. Rejected (user preference); single color is sufficient because hover tooltip disambiguates.

### Separate MST store + listener for activity

A new `GroupActivityModel` store holds the mirrored RTDB activity records. It is *not* folded into `GroupsModel`.

*Alternative considered:* Add an `activity` field to each `GroupUserModel` and have the existing `db-groups-listener` populate it. Rejected because presence (connection state) and activity have different update cadences and consumers — coupling them would mean every connection-status flicker re-renders activity consumers. The cost of separation is one new listener and one new store; both are small and follow established patterns in the codebase.

## Data Schema

```ts
// Persisted at: classes/{classHash}/groups/{groupId}/users/{userId}/activity
interface UserActivity {
  documentKey: string;       // which doc the activity is in
  focus?: {
    tileIds: string[];       // currently selected tiles within that doc
  };
  // Future siblings (NOT in initial PR):
  //   cursor?: { tileId: string; ... };
  //   tool?: { name: string };
  //   selection?: { tileId: string; range: ... };
  updatedAt: number;         // server timestamp
}
```

The `activity` node is removed (not emptied) when there is nothing to broadcast.

## Components & Responsibilities

### `GroupActivityModel` (new)
*Location:* `src/models/stores/group-activity.ts`

```ts
GroupUserActivity = types.model({
  userId: string,
  documentKey: string,
  focus: types.maybe(types.model({ tileIds: types.array(string) })),
  updatedAt: number,
});

GroupActivityModel = types.model({
  activities: types.map(GroupUserActivity),  // keyed by userId
})
.views(self => ({
  usersFocusedOnTile(documentKey: string, tileId: string): GroupUserActivity[]
  // ...other helpers as needed
}))
.actions(self => ({
  setActivity(userId: string, activity: UserActivity): void
  removeActivity(userId: string): void
}));
```

Registered in the root `stores` model alongside `groups`.

### `DBGroupActivityListener` (new)
*Location:* `src/lib/db-listeners/db-group-activity-listener.ts`

Pattern follows existing `db-groups-listener.ts`:
- `start()` subscribes to `classes/{classHash}/groups/{groupId}/users` with `.on("value")` and reads each user's `activity` child.
- Pushes diffs into `GroupActivityModel` (set/update/remove).
- `stop()` detaches the listener; called when `currentGroupId` changes.

### Activity broadcaster (new methods on `db.ts`)
*Location:* additions to `src/lib/db.ts`

A small service / set of methods that:
1. Sets up an MST `reaction` watching `(persistentUI.problemWorkspace.primaryDocumentKey, ui.selectedTileIds)`.
2. When both are present and non-empty: writes `{documentKey, focus: {tileIds}, updatedAt}` to the activity path. Debounced ~150ms.
3. When either becomes empty: `remove()` the activity node.
4. On first write (per session/group): registers `onDisconnect().remove()` on the activity path.

Disposed when the user leaves the group.

### `<TileActivityBadges>` (new)
*Location:* `src/components/tiles/tile-activity-badges.tsx` (sibling of `tile-component.tsx`)

```tsx
interface Props {
  documentKey: string;
  tileId: string;
  hovered: boolean;     // tile-level hover state
  selected: boolean;    // tile is selected locally
}
```

Reads from `groupActivityStore.usersFocusedOnTile(documentKey, tileId)`. Renders 0–4 rectangular initial-badges plus optional `+N` overflow. Tooltip lists full names. Returns `null` if no activity or if the document is not a group document.

Positioned absolutely in the tile's top-right via CSS. When `hovered || selected` is true (i.e. the drag handle is visible), shifts `right` by ~36px to clear the drag handle's hit area.

### `TileComponent` change
Single insertion point in `src/components/tiles/tile-component.tsx`: render `<TileActivityBadges documentKey={...} tileId={model.id} hovered={hoverTile} selected={isTileSelected} />` near the existing drag/resize button render. The component handles its own visibility / null-rendering.

## "Current document" signal

The broadcaster needs to know which document the user is editing. After investigation:
- `persistentUI.problemWorkspace.primaryDocumentKey` is the right source — it tracks the document currently primary in the editor workspace.
- `persistentUI.focusDocument` was considered but can return a section path string (not a doc key) when the user is on the Problems / Teacher Guide tabs.

If a user is on a tab that is not a document workspace, `primaryDocumentKey` is `undefined` and no activity is broadcast — which is the correct behavior.

## File Layout

```
src/lib/db-listeners/db-group-activity-listener.ts   (new)
src/models/stores/group-activity.ts                   (new)
src/models/stores/stores.ts                           (register new store)
src/lib/db.ts                                         (broadcaster methods + onDisconnect setup)
src/components/tiles/tile-activity-badges.tsx         (new)
src/components/tiles/tile-activity-badges.scss        (new)
src/components/tiles/tile-component.tsx               (mount the badges)
```

Plus tests (see below).

## Testing Strategy

### Unit tests
- **`group-activity.ts` store** — snapshot apply / `usersFocusedOnTile()` filtering by `documentKey + tileId`; handling of missing/empty records.
- **Activity broadcaster** — with a mocked `db` ref, verify writes happen on selection, removes happen on clear/doc-close/disconnect, debounce works.
- **`db-group-activity-listener`** — with mock RTDB, verify snapshots translate into store updates and removals.
- **`<TileActivityBadges>` component** — 0/1/2/3/4/5+ user rendering, `+N` overflow, tooltip content, left-shift behavior when `hovered`/`selected`, null render for non-group docs.

### Manual / multi-client testing
The realtime aspect requires multi-client testing:
- Use the Firebase emulator (`appMode=qa&firebase=emulator`).
- Two browser windows / two student logins / same group / same group doc.
- Verify badge appearance/disappearance on selection changes, tab close, doc switch, network drop.
- Edge cases: rapid select/deselect (debounce holds), 5+ users on one tile (`+N` rendering), drag handle hover (badges shift left).

## Risks & Open Questions

- **Debounce window**: 150ms is a starting guess. May need tuning if it feels laggy or if we see Firebase write-rate concerns. Cheap to adjust.
- **Activity record stale on crash**: `onDisconnect()` covers normal tab close / network drop, but a hung tab could leave a stale record. Acceptable for first cut; group sessions are short and the next reconnect overwrites.
- **Selection vs. "actively doing"**: a user with a tile selected but who has wandered off to read something else still shows as focused. This is the price of using selection as the signal. Future cursor/focus signals can refine this.
- **Multiple tabs by the same user**: each tab will fight to write its own activity record. Not a deal-breaker (each write replaces the prior) but worth flagging — last-write-wins semantics.

## Next Step

Implementation plan to be written via the `writing-plans` skill.
