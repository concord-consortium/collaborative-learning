# Group Doc Tile-Focus Awareness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task. Each implementation step within a task should follow @superpowers:test-driven-development (red → green → refactor → commit).

**Goal:** Broadcast each group member's selected tiles via Firebase RTDB and render initial-badges on the corresponding tiles in group documents.

**Architecture:** A new `GroupActivityModel` MST store mirrors a new RTDB sub-tree under each group user (`.../users/{userId}/activity`). A `DBGroupActivityListener` populates the store from RTDB; an `ActivityBroadcaster` reaction writes the local user's selection upstream. A `<TileActivityBadges>` component reads from the store and renders inside `TileComponent`'s chrome.

**Tech Stack:** TypeScript, MobX State Tree, MobX `reaction`, Firebase Realtime Database 8, React 17, react-tippy, Jest.

---

## Task 1: `GroupActivityModel` MST store

**Files:**
- Create: `src/models/stores/group-activity.ts`
- Create: `src/models/stores/group-activity.test.ts`

**Step 1: Write failing tests**

```ts
// group-activity.test.ts
import { GroupActivityModel } from "./group-activity";

describe("GroupActivityModel", () => {
  it("starts empty and returns no users for any tile", () => {
    const store = GroupActivityModel.create({});
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("setActivity adds an entry; usersFocusedOnTile filters by doc + tile", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({
      userId: "u1", documentKey: "doc1",
      focus: { tileIds: ["tileA", "tileB"] },
      updatedAt: 1
    });
    store.setActivity({
      userId: "u2", documentKey: "doc1",
      focus: { tileIds: ["tileA"] },
      updatedAt: 2
    });
    store.setActivity({
      userId: "u3", documentKey: "doc2",
      focus: { tileIds: ["tileA"] },
      updatedAt: 3
    });

    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId).sort())
      .toEqual(["u1", "u2"]);
    expect(store.usersFocusedOnTile("doc1", "tileB").map(a => a.userId))
      .toEqual(["u1"]);
    expect(store.usersFocusedOnTile("doc2", "tileA").map(a => a.userId))
      .toEqual(["u3"]);
  });

  it("setActivity replaces existing entry for same user", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1",
                        focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    store.setActivity({ userId: "u1", documentKey: "doc2",
                        focus: { tileIds: ["tileB"] }, updatedAt: 2 });
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
    expect(store.usersFocusedOnTile("doc2", "tileB").map(a => a.userId))
      .toEqual(["u1"]);
  });

  it("removeActivity drops the user", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1",
                        focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId))
      .toEqual(["u1"]);
    store.removeActivity("u1");
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("ignores activity records with no focus", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1", updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("clear removes all activities", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1",
                        focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId))
      .toEqual(["u1"]);
    store.clear();
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });
});
```

**Step 2: Run tests, verify they fail**

- `npm test -- --no-watchman src/models/stores/group-activity.test.ts`
- Expected: failure due to missing module.

**Step 3: Implement the store**

```ts
// group-activity.ts
import { types, Instance, SnapshotIn } from "mobx-state-tree";

export const GroupUserActivityFocus = types.model("GroupUserActivityFocus", {
  tileIds: types.array(types.string)
});

export const GroupUserActivity = types.model("GroupUserActivity", {
  userId: types.identifier,
  documentKey: types.string,
  focus: types.maybe(GroupUserActivityFocus),
  updatedAt: types.number
});
export type GroupUserActivityType = Instance<typeof GroupUserActivity>;
export type GroupUserActivitySnapshot = SnapshotIn<typeof GroupUserActivity>;

export const GroupActivityModel = types
  .model("GroupActivity", {
    activities: types.map(GroupUserActivity)
  })
  .views(self => ({
    usersFocusedOnTile(documentKey: string, tileId: string): GroupUserActivityType[] {
      const result: GroupUserActivityType[] = [];
      self.activities.forEach(activity => {
        if (activity.documentKey === documentKey
            && activity.focus?.tileIds.includes(tileId)) {
          result.push(activity);
        }
      });
      return result;
    }
  }))
  .actions(self => ({
    setActivity(snapshot: GroupUserActivitySnapshot) {
      self.activities.set(snapshot.userId, GroupUserActivity.create(snapshot));
    },
    removeActivity(userId: string) {
      self.activities.delete(userId);
    },
    clear() {
      self.activities.clear();
    }
  }));

export type GroupActivityModelType = Instance<typeof GroupActivityModel>;
```

**Step 4: Run tests, verify they pass**

- `npm test -- --no-watchman src/models/stores/group-activity.test.ts`

**Step 5: Commit**

```bash
git add src/models/stores/group-activity.ts src/models/stores/group-activity.test.ts
git commit -m "Clue-317 Add GroupActivityModel MST store"
```

---

## Task 2: Register store in `Stores`

**Files:**
- Modify: `src/models/stores/base-stores-types.ts`
- Modify: `src/models/stores/stores.ts`

**Step 1: Add `groupActivity` field to `IBaseStores`**

In `base-stores-types.ts`, import `GroupActivityModelType` from `./group-activity` and add `groupActivity: GroupActivityModelType;` to the `IBaseStores` interface (alphabetical placement near `groups`).

**Step 2: Declare and construct `groupActivity` in `Stores`**

In `stores.ts`:
- Import `GroupActivityModel, GroupActivityModelType` from `./group-activity`.
- Declare `groupActivity: GroupActivityModelType;` on the class.
- In the constructor, after the `this.groups = ...` line, add:
  ```ts
  this.groupActivity = params?.groupActivity ?? GroupActivityModel.create({});
  ```
- `ICreateStores` already extends `Partial<IStores>` and `IStores extends IBaseStores`, so `params?.groupActivity` type-checks once step 1 lands. Verify.

**Step 3: Type check**

`npm run check:types` — expected: clean.

**Step 4: Run existing tests**

`npm test -- --no-watchman src/models/stores/` — expected: existing tests still pass.

**Step 5: Commit**

```bash
git add src/models/stores/base-stores-types.ts src/models/stores/stores.ts
git commit -m "Clue-317 Register groupActivity store"
```

---

## Task 3: Firebase activity path + db.ts methods

**Files:**
- Modify: `src/lib/firebase.ts` (add path helper)
- Modify: `src/lib/db.ts` (add write/clear/onDisconnect methods)
- Create: `src/lib/group-activity-db.test.ts` (path tests)

**Step 1: Failing path test**

```ts
// group-activity-db.test.ts
import { Firebase } from "./firebase";
import { UserModel } from "../models/stores/user";

describe("Firebase.getGroupUserActivityPath", () => {
  it("nests activity under the group user path", () => {
    const fb = new Firebase({} as any);
    const user = UserModel.create({
      id: "u1", classHash: "c1", offeringId: "off1"
    });
    expect(fb.getGroupUserActivityPath(user, "g1"))
      .toBe("classes/c1/offerings/off1/groups/g1/users/u1/activity");
    expect(fb.getGroupUserActivityPath(user, "g1", "u2"))
      .toBe("classes/c1/offerings/off1/groups/g1/users/u2/activity");
  });
});
```

Run: `npm test -- --no-watchman src/lib/group-activity-db.test.ts` → fail.

**Step 2: Add `getGroupUserActivityPath` in `firebase.ts`**

Right after `getGroupUserPath`:

```ts
public getGroupUserActivityPath(user: UserModelType, groupId: string, userId?: string) {
  return `${this.getGroupUserPath(user, groupId, userId)}/activity`;
}
```

Run test → pass.

**Step 3: Add write/clear/onDisconnect methods in `db.ts`**

Inside the `DB` class:

```ts
public setGroupUserActivity(activity: { documentKey: string; focus?: { tileIds: string[] } }) {
  const { user } = this.stores;
  if (!user.currentGroupId) return Promise.resolve();
  const ref = this.firebase.ref(
    this.firebase.getGroupUserActivityPath(user, user.currentGroupId)
  );
  return ref.set({
    ...activity,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });
}

public clearGroupUserActivity() {
  const { user } = this.stores;
  if (!user.currentGroupId) return Promise.resolve();
  const ref = this.firebase.ref(
    this.firebase.getGroupUserActivityPath(user, user.currentGroupId)
  );
  return ref.remove();
}

public setGroupUserActivityOnDisconnect() {
  const { user } = this.stores;
  if (!user.currentGroupId) return null;
  const ref = this.firebase.ref(
    this.firebase.getGroupUserActivityPath(user, user.currentGroupId)
  );
  const handler = ref.onDisconnect();
  handler.remove();
  return handler;
}
```

(Import `firebase` from `firebase/app` if not already imported.)

**Step 4: Type check**

`npm run check:types` — clean.

**Step 5: Commit**

```bash
git add src/lib/firebase.ts src/lib/db.ts src/lib/group-activity-db.test.ts
git commit -m "Clue-317 Add group user activity path + db methods"
```

---

## Task 4: `DBGroupActivityListener` + registration + tests

**Files:**
- Create: `src/lib/db-listeners/db-group-activity-listener.ts`
- Create: `src/lib/db-listeners/db-group-activity-listener.test.ts`
- Modify: `src/lib/db-listeners/index.ts`

**Step 1: Failing listener tests**

```ts
// db-group-activity-listener.test.ts
import { DBGroupActivityListener } from "./db-group-activity-listener";

describe("DBGroupActivityListener", () => {
  // Mock db with: stores.user.currentGroupId, stores.groupActivity (real),
  //               firebase.ref(path) returning a stub with .on/.off
  // Helper: simulate a "value" snapshot
  it("populates groupActivity store from a snapshot", () => { /* ... */ });
  it("removes a user when their activity disappears from snapshot", () => { /* ... */ });
  it("clears store when group changes / on stop", () => { /* ... */ });
});
```

Skeleton the tests; they will fail because the file doesn't exist. Detail the mocks during implementation; pattern follows existing listener tests in the repo if any, otherwise `jest.fn()` for `.on`/`.off`.

**Step 2: Implement the listener**

```ts
// db-group-activity-listener.ts
import firebase from "firebase/app";
import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBGroupActivityListener extends BaseListener {
  private db: DB;
  private usersRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBGroupActivityListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve) => {
      const { user } = this.db.stores;
      const groupId = user.currentGroupId;
      if (!groupId) { resolve(); return; }
      const path = `${this.db.firebase.getGroupPath(user, groupId)}/users`;
      this.usersRef = this.db.firebase.ref(path);
      this.usersRef.on("value", this.handleUsers);
      resolve();
    });
  }

  public stop() {
    if (this.usersRef) {
      this.usersRef.off("value", this.handleUsers);
      this.usersRef = null;
    }
    this.db.stores.groupActivity.clear();
  }

  private handleUsers = (snapshot: firebase.database.DataSnapshot) => {
    const { groupActivity } = this.db.stores;
    const value = snapshot.val() || {};
    const seen = new Set<string>();
    Object.keys(value).forEach(userId => {
      const activity = value[userId]?.activity;
      if (activity && typeof activity.documentKey === "string") {
        groupActivity.setActivity({
          userId,
          documentKey: activity.documentKey,
          focus: activity.focus
            ? { tileIds: activity.focus.tileIds || [] }
            : undefined,
          updatedAt: activity.updatedAt || 0
        });
        seen.add(userId);
      }
    });
    // Remove users whose activity disappeared
    Array.from(groupActivity.activities.keys()).forEach(userId => {
      if (!seen.has(userId)) groupActivity.removeActivity(userId);
    });
  };
}
```

**Step 3: Register in `DBListeners`**

In `src/lib/db-listeners/index.ts`:

- Import `DBGroupActivityListener`.
- Add a `groupActivityListener` field and instantiate in the constructor.
- In `start()`, start it after the groups listener (it depends on `currentGroupId` being set):

  ```ts
  await Promise.all([ /* ...existing... */ ]);
  await this.groupActivityListener.start();
  await Promise.all([ /* listeners that depend on documents */ ]);
  ```

- In `stop()`, stop it before `groupsListener.stop()`.

**Step 4: Run tests**

`npm test -- --no-watchman src/lib/db-listeners/db-group-activity-listener.test.ts` → pass.

**Step 5: Type check + commit**

```bash
npm run check:types
git add src/lib/db-listeners/db-group-activity-listener.ts \
        src/lib/db-listeners/db-group-activity-listener.test.ts \
        src/lib/db-listeners/index.ts
git commit -m "Clue-317 Add DBGroupActivityListener"
```

---

## Task 5: Activity broadcaster (writer)

**Files:**
- Create: `src/lib/group-activity-broadcaster.ts`
- Create: `src/lib/group-activity-broadcaster.test.ts`
- Modify: `src/lib/db-listeners/index.ts` (start/stop the broadcaster alongside listeners)

**Step 1: Failing tests**

```ts
// group-activity-broadcaster.test.ts
import { GroupActivityBroadcaster } from "./group-activity-broadcaster";
// Use jest.useFakeTimers() and a mocked db with setGroupUserActivity / clearGroupUserActivity
// Construct minimal stores with persistentUI.problemWorkspace.primaryDocumentKey
//   and ui.selectedTileIds; mutate them and assert on db method calls.

describe("GroupActivityBroadcaster", () => {
  it("writes activity when selection becomes non-empty in a doc", () => { /* ... */ });
  it("clears activity when selection empties", () => { /* ... */ });
  it("clears activity when document key becomes undefined", () => { /* ... */ });
  it("debounces rapid selection changes", () => { /* fake timers */ });
  it("registers onDisconnect on first write", () => { /* ... */ });
  it("dispose() tears down reactions and onDisconnect", () => { /* ... */ });
});
```

**Step 2: Implement**

```ts
// group-activity-broadcaster.ts
import { reaction, IReactionDisposer } from "mobx";
import firebase from "firebase/app";
import { debounce } from "lodash";
import { DB } from "./db";

export class GroupActivityBroadcaster {
  private db: DB;
  private disposer: IReactionDisposer | null = null;
  private onDisconnectHandler: firebase.database.OnDisconnect | null = null;
  private flush: ReturnType<typeof debounce>;

  constructor(db: DB) {
    this.db = db;
    this.flush = debounce(this.flushNow, 150);
  }

  start() {
    const { ui, persistentUI, user } = this.db.stores;
    this.disposer = reaction(
      () => ({
        groupId: user.currentGroupId,
        documentKey: persistentUI.problemWorkspace.primaryDocumentKey,
        tileIds: ui.selectedTileIds.slice()
      }),
      () => this.flush()
    );
  }

  stop() {
    this.flush.cancel();
    this.disposer?.();
    this.disposer = null;
    this.onDisconnectHandler?.cancel();
    this.onDisconnectHandler = null;
  }

  private flushNow = async () => {
    const { ui, persistentUI, user } = this.db.stores;
    const groupId = user.currentGroupId;
    const documentKey = persistentUI.problemWorkspace.primaryDocumentKey;
    const tileIds = ui.selectedTileIds.slice();

    if (!groupId) return;

    if (!documentKey || tileIds.length === 0) {
      await this.db.clearGroupUserActivity();
      return;
    }

    if (!this.onDisconnectHandler) {
      this.onDisconnectHandler = this.db.setGroupUserActivityOnDisconnect();
    }

    await this.db.setGroupUserActivity({
      documentKey,
      focus: { tileIds }
    });
  };
}
```

**Step 3: Wire into `DBListeners` lifecycle**

In `src/lib/db-listeners/index.ts`:

- Add a `groupActivityBroadcaster` field, instantiate in constructor.
- In `start()` (after `groupActivityListener.start()`): `this.groupActivityBroadcaster.start();`
- In `stop()`: `this.groupActivityBroadcaster.stop();`

**Step 4: Run tests + type check**

```bash
npm test -- --no-watchman src/lib/group-activity-broadcaster.test.ts
npm run check:types
```

**Step 5: Commit**

```bash
git add src/lib/group-activity-broadcaster.ts \
        src/lib/group-activity-broadcaster.test.ts \
        src/lib/db-listeners/index.ts
git commit -m "Clue-317 Add GroupActivityBroadcaster"
```

---

## Task 6: `<TileActivityBadges>` component + styles + tests

**Files:**
- Create: `src/components/tiles/tile-activity-badges.tsx`
- Create: `src/components/tiles/tile-activity-badges.scss`
- Create: `src/components/tiles/tile-activity-badges.test.tsx`

**Step 1: Failing component tests**

```tsx
// tile-activity-badges.test.tsx
import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { TileActivityBadges } from "./tile-activity-badges";
// Build minimal stores with: groupActivity (with N entries on (docKey,tileId)),
//                            class (resolving names/initials),
//                            documents (so a getDocument(docKey).type === "group" check passes)

describe("TileActivityBadges", () => {
  it("renders nothing when no users are focused", () => { /* ... */ });
  it("renders nothing when document type is not 'group'", () => { /* ... */ });
  it("renders 1, 2, 3, 4 badges", () => { /* ... */ });
  it("renders 4 + '+N' overflow when 5+ users", () => { /* ... */ });
  it("tooltip lists all focused users' full names", () => { /* ... */ });
  it("applies left-shift class when hovered or selected", () => { /* ... */ });
});
```

**Step 2: Implement**

```tsx
// tile-activity-badges.tsx
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { Tooltip } from "react-tippy";
import { useStores } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { GroupDocument } from "../../models/document/document-types";
import "./tile-activity-badges.scss";

interface IProps {
  documentKey: string;
  tileId: string;
  hovered: boolean;
  selected: boolean;
}

const MAX_VISIBLE = 4;

export const TileActivityBadges = observer(function TileActivityBadges({
  documentKey, tileId, hovered, selected
}: IProps) {
  const { groupActivity, groups, documents } = useStores();
  const tooltipOptions = useTooltipOptions({ distance: 6 });

  const document = documents.getDocument(documentKey);
  if (document?.type !== GroupDocument) return null;

  const focused = groupActivity.usersFocusedOnTile(documentKey, tileId);
  if (focused.length === 0) return null;

  // Resolve userId -> name/initials via the active group
  const group = groups.groupForUser(focused[0].userId);
  const groupUsers = group?.users ?? [];
  const usersWithIdentity = focused.map(activity => {
    const u = groupUsers.find(gu => gu.id === activity.userId);
    return {
      userId: activity.userId,
      initials: u?.initials ?? "??",
      name: u?.name ?? "Unknown",
    };
  });

  const visible = usersWithIdentity.slice(0, MAX_VISIBLE);
  const overflow = usersWithIdentity.length - MAX_VISIBLE;

  const tooltipText = usersWithIdentity.map(u => u.name).join("\n");

  const className = classNames("tile-activity-badges", {
    "drag-handle-visible": hovered || selected
  });

  return (
    <Tooltip title={tooltipText} {...tooltipOptions}>
      <div className={className} data-testid="tile-activity-badges">
        {visible.map(u => (
          <div key={u.userId} className="badge" data-testid="activity-badge">
            {u.initials}
          </div>
        ))}
        {overflow > 0 && (
          <div className="badge overflow" data-testid="activity-badge-overflow">
            +{overflow}
          </div>
        )}
      </div>
    </Tooltip>
  );
});
```

**Step 3: Styles**

```scss
// tile-activity-badges.scss
@import "../vars";

$badge-width: 22px;
$badge-height: 16px;
$badge-gap: 2px;
$drag-handle-clearance: 36px;

.tile-activity-badges {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: $badge-gap;
  z-index: 50;
  pointer-events: auto;
  transition: right 0.2s;

  &.drag-handle-visible {
    right: $drag-handle-clearance;
  }

  .badge {
    width: $badge-width;
    height: $badge-height;
    border-radius: 2px;
    background-color: $charcoal-medium-light; // pick once we see live colors
    color: white;
    font-size: 10px;
    font-weight: bold;
    line-height: $badge-height;
    text-align: center;
  }
}
```

(Color value placeholder — match group-button initials styling; refine during manual test.)

**Step 4: Run tests + type check**

```bash
npm test -- --no-watchman src/components/tiles/tile-activity-badges.test.tsx
npm run check:types
```

**Step 5: Commit**

```bash
git add src/components/tiles/tile-activity-badges.tsx \
        src/components/tiles/tile-activity-badges.scss \
        src/components/tiles/tile-activity-badges.test.tsx
git commit -m "Clue-317 Add TileActivityBadges component"
```

---

## Task 7: Mount `<TileActivityBadges>` in `TileComponent`

**Files:**
- Modify: `src/components/tiles/tile-component.tsx`

**Step 1: Insert badge render**

Inside `TileComponent.render()`, near where `dragTileButton` / `resizeTileButton` are rendered, add:

```tsx
const activityBadges = (
  <TileActivityBadges
    documentKey={this.props.documentId ?? ""}
    tileId={model.id}
    hovered={hoverTile}
    selected={isTileSelected}
  />
);
```

Render it inside the tile chrome JSX between `{dragTileButton}` and `{resizeTileButton}`. (The component returns `null` when not in a group doc / no focus, so this is safe for all tile contexts.)

If `documentId` isn't directly on props, use the appropriate doc-key prop name available in `TileComponent` (verify in the existing render method — likely `docId` or via context). Use whichever maps to a real document key; do not fabricate.

**Step 2: Manual smoke**

Type check + run an existing tile component test to verify nothing regressed:

```bash
npm run check:types
npm test -- --no-watchman src/components/tiles/tile-component.test
```

**Step 3: Commit**

```bash
git add src/components/tiles/tile-component.tsx
git commit -m "Clue-317 Mount TileActivityBadges in TileComponent"
```

---

## Task 8: Manual multi-client emulator test

No code changes; this validates the runtime behavior the unit tests can't.

**Setup:**
- Start the firebase emulator (`firebase emulators:start` or the project's documented script).
- Run two browser sessions with two different student logins, both in the same group, viewing the same group document.
- URL params: `?appMode=qa&firebase=emulator&firestore=emulator&unit=...&problem=...`.

**Verify (use as a checklist):**
- [X] User A selects tile T → user B sees a badge with A's initials in T's top-right within ~1s.
- [X] User A deselects → badge disappears.
- [X] User A selects multiple tiles → multiple badges appear simultaneously.
- [X] Both A and B select tile T → both see the other's badge (each sees one).
- [X] Hovering tile T shows a tooltip with the other user's full name.
- [X] Hovering causes drag handle to appear; badges shift left to clear it.
- [X] User A closes the browser tab → A's badge disappears for B within a few seconds (`onDisconnect`).
- [X] User A switches to a personal doc → A's badge disappears from B's view of the group doc.
- [X] With 5+ simulated users (use a script or many tabs) → first 4 badges + `+N` rendered.
- [X] Badges do NOT appear in personal docs (gated by `document.type === "group"`).

**Cleanup:** none (no commits).

If any check fails, file a follow-up task and address before merging.

---

## Risks / known unknowns

- **Lodash `debounce` typing**: ensure existing utility exists (it does — used elsewhere). Otherwise replace with a small in-house debounce.
- **`documentId` prop on `TileComponent`**: needs verification — the actual prop name might differ. Treat as the one open detail at task-7 time; don't fabricate.
- **`useStores` / `useTooltipOptions` hooks**: ensure these exist in the project (they do, per existing components).
- **Firebase rules**: writes to a new `activity` child of an existing user-readable node likely already pass existing rules, but confirm in manual test. If denied, a small rules update is needed (separate task).
