# CLUE-639: Author-set fixed start view

## Goal

Let a unit author force every user to a specific starting view on **every** app load —
a chosen nav tab, with no document open on the left (all thumbnails visible) and the
center divider reset to the unit default — instead of restoring the user's last-seen
navigation state. Controlled by an authoring switch. Units that leave the switch off keep
today's behavior (restore the last page/configuration the user saw).

Primary use case: one unit must always start users on **Class Work** (published documents)
with no document open, so every published thumbnail is visible. Other units might default
to **Sort Work**, etc.

## Context / current architecture

- **Persisted UI state** lives in `PersistentUIModel`
  (`src/models/stores/persistent-ui/persistent-ui.ts`), saved per-offering/per-user in the
  Firebase Realtime Database (no localStorage). Relevant persisted fields:
  - `activeNavTab` — the current nav tab (`setActiveNavTab`, line 134).
  - `dividerPosition` — the center divider, default `kDividerHalf` (50); `kDividerMin`=0
    (workspace only), `kDividerMax`=100 (resources only). Setter `setDividerPosition` (line 89).
  - `tabs` — per-tab state; each tab's `currentDocumentGroup` holds `currentDocumentKeys`
    (`src/models/stores/persistent-ui/ui-document-group.ts:21`): `undefined` = no choice yet,
    `[]` = user explicitly closed → **show all thumbnails**, `[key]` = a document is open.
- **Nav tabs**: `ENavTab` (`src/models/view/nav-tabs.ts`): `problems`, `teacher-guide`,
  `student-work`, `my-work`, `class-work`, `sort-work`. Displayed tabs come from the unit's
  `navTabs` config; `stores.displayedActiveNavTab` resolves the active tab against displayed
  tabs and falls back to the first tab if the stored one is hidden/stale.
- **Existing precedent — `defaultPanelLayout`**: an author-set unit setting
  (`"split" | "workspace-only" | "resources-only"`) applied at startup by
  `PersistentUIModel.applyDefaultPanelLayout` (line 95), invoked from `src/lib/db.ts:195`
  after both the unit and persistentUI are ready. It is guarded by
  `if (self.hasSavedPersistentUI) return;` so it only affects **first-time** visitors.
  CLUE-639 mirrors this plumbing but must fire on **every** load and **override** saved state.

## Decisions (confirmed with product)

- **When**: force the default view on **every** load. Mid-session navigation still works and is
  saved as usual; only the starting point is re-forced next load (not a lock).
- **Who**: **all** users (students and teachers).
- **Setting shape**: a separate **enable flag** plus a **tab value**, so turning the switch off
  preserves the chosen tab — matching the established non-destructive authoring-toggle pattern
  (`aiEvaluation`/`aiPrompt`). Not a single enum.
- **Reset scope**: tab **+** no document open **+** divider reset to the unit default.
- **Divider default** is derived from `defaultPanelLayout` so the two settings compose
  (resources-only → 100, workspace-only → 0, else 50).

## Design

### 1. Unit setting (3-layer config, mirroring `defaultPanelLayout`)

Add to the `UnitConfiguration` interface (`src/models/stores/problem-configuration.ts`):

```ts
// When true, every load starts on `fixedStartTab` (no open document, divider reset)
// instead of restoring the user's last-seen state.
fixedStartView?: boolean;
// The nav tab to start on (an ENavTab id, e.g. "class-work"). Preserved when the
// switch is off so authors don't lose their choice by toggling.
fixedStartTab?: string;
```

Expose through the two getter layers, following `defaultPanelLayout`:

- `ConfigurationManager` (`src/models/stores/configuration-manager.ts`):
  ```ts
  get fixedStartView() { return this.getProp<UC["fixedStartView"]>("fixedStartView"); }
  get fixedStartTab() { return this.getProp<UC["fixedStartTab"]>("fixedStartTab"); }
  ```
- `AppConfigModel` (`src/models/stores/app-config-model.ts`):
  ```ts
  get fixedStartView() { return self.configMgr.fixedStartView; },
  get fixedStartTab() { return self.configMgr.fixedStartTab; },
  ```

### 2. New `PersistentUIModel` action

Add next to `applyDefaultPanelLayout` in `persistent-ui.ts`:

> **Revision (per code review):** an earlier version of this action *mutated* the persisted
> `activeNavTab`/`dividerPosition`/document group. Because the Firebase snapshot-writer is already
> active at load time, that overwrote the user's saved state on every load (a lock, not a starting
> point), and `closeDocumentGroupPrimaryDocument` also mishandled a two-key group (promoting the
> secondary document) and no-oped for an unvisited tab. The action was reworked into a **session-only,
> non-destructive override** (below), which is what shipped.

```ts
// Force the author's start view for this session WITHOUT mutating the persisted record: a volatile
// override the display consults, cleared as soon as the user navigates. The saved state survives.
applyFixedStartView(tab: string, dividerPosition: number) {
  self.startViewOverride = { tab, dividerPosition };
}
```

Notes:
- `startViewOverride` is a `.volatile` field, so it is never written back to Firebase.
- The display consults it: `stores.displayedActiveNavTab` prefers `startViewOverride.tab`;
  `displayedDividerPosition` prefers `startViewOverride.dividerPosition`; and
  `section-document-or-browser`'s `renderDocumentView` shows the thumbnail browser (no document) for
  the override tab.
- It is cleared by `setActiveNavTab`, `setDividerPosition`, and `openDocumentGroupPrimaryDocument`, so
  the first genuine navigation restores the user's own (still-persisted) state for the rest of the session.

### 3. Startup hook (`src/lib/db.ts`)

At the existing point where `applyDefaultPanelLayout` is called (~line 195, after
`persistentUIReady` and the unit are ready), add:

```ts
const { appConfig } = this.stores;
const tabDisplayed = this.stores.tabsToDisplay.some(t => t.tab === appConfig.fixedStartTab);
if (appConfig.fixedStartView && appConfig.fixedStartTab && tabDisplayed) {
  persistentUI.applyFixedStartView(appConfig.fixedStartTab, dividerForLayout(appConfig.defaultPanelLayout));
} else {
  persistentUI.applyDefaultPanelLayout(appConfig.defaultPanelLayout);
  if (appConfig.fixedStartView && appConfig.fixedStartTab) {
    console.warn(`fixedStartView: "${appConfig.fixedStartTab}" is not a displayed tab; ignoring`);
  }
}
```

- `dividerForLayout(layout)` maps `resources-only`→`kDividerMax`, `workspace-only`→`kDividerMin`,
  else `kDividerHalf`. This helper lives with the action (or inline) and keeps CLUE-639's divider
  reset consistent with `defaultPanelLayout`.
- The displayed-tab guard is `this.stores.tabsToDisplay.some(t => t.tab === fixedStartTab)` — the same
  `tabsToDisplay` list that `stores.displayedActiveNavTab` resolves against (`stores.ts:231,255`). If
  `fixedStartTab` is hidden, teacher-only while the user is a student, or otherwise not displayed, we
  **do not** force it — we fall back to normal restore + the existing `applyDefaultPanelLayout`, and
  warn. This prevents stranding a user on an inaccessible tab.
- `db.ts:195` runs inside the DB layer, which has `this.stores`; `tabsToDisplay` is populated once the
  unit is loaded (it drives `initializeActiveNavTab` at `stores.ts:420`), so it is ready at this hook.
- When `fixedStartView` is on, we intentionally do **not** also call `applyDefaultPanelLayout`
  (the forced path sets the divider itself).

### 4. Authoring UI

Add the two settings to the author form that already hosts `defaultPanelLayout`
(`src/authoring/components/workspace/nav-tabs.tsx`, registration ~lines 67–121) and mirror the
types in `src/authoring/types.ts`:
- `fixedStartView` → a boolean toggle ("Start every session on a fixed tab").
- `fixedStartTab` → a dropdown of the unit's configured nav-tab ids, enabled when the toggle is on.

## Edge cases

- **Switch off / unset** → today's behavior exactly (restore last state; `applyDefaultPanelLayout`
  still runs for first-time visitors).
- **`fixedStartView` on but `fixedStartTab` unset or not displayed** → no forcing; warn; normal restore.
- **`?noPersistentUI`** → `initializePersistentUISync` returns early before the hook; forcing is
  effectively moot (nothing restored anyway). No special handling needed.
- **Teacher on a student-oriented target tab** → allowed by the "all users" decision, but only if
  the tab is displayed for that user; teacher-only/hidden filtering still applies via the guard.
- **Sub-tab**: closing the primary document shows the current group's thumbnails. Resetting the
  tab's `currentDocumentGroupId` to its default sub-tab is covered by existing seeding in
  `section-document-or-browser.tsx` when unset; if a non-default sub-tab was restored we leave it,
  since the requirement is "no document open," not "reset every sub-tab." (Revisit only if a unit
  needs a specific sub-tab forced.)

## Testing

- **`persistent-ui.test.ts`** — `applyFixedStartView(tab, divider)`: sets `activeNavTab`; the active
  tab's `currentDocumentGroup.currentDocumentKeys` becomes `[]` (thumbnails / `userExplicitlyClosedDocument`);
  `dividerPosition` equals the passed value. Confirm it works even when `hasSavedPersistentUI` is true
  (overrides saved state).
- **`configuration-manager` / `app-config-model`** — the two new getters resolve through the unit →
  investigation → problem layering and override order, matching the `defaultPanelLayout` tests.
- **Startup guard** (unit-level, around the db hook or a small extracted helper) — `fixedStartView`
  on + displayed tab → `applyFixedStartView` called with the layout-derived divider; on + non-displayed
  tab → not called, warn, `applyDefaultPanelLayout` runs; off → `applyDefaultPanelLayout` runs.
- **Divider mapping** — `dividerForLayout` returns min/max/half for the three layout values.

## Critical files

- `src/models/stores/problem-configuration.ts` — add `fixedStartView` / `fixedStartTab` to `UnitConfiguration`.
- `src/models/stores/configuration-manager.ts` — two getters.
- `src/models/stores/app-config-model.ts` — two getters.
- `src/models/stores/persistent-ui/persistent-ui.ts` — `applyFixedStartView` action (+ `dividerForLayout` helper).
- `src/lib/db.ts` — startup hook (~line 195) choosing forced vs. normal restore.
- `src/authoring/components/workspace/nav-tabs.tsx` and `src/authoring/types.ts` — author form + types.
- Reference (do not reinvent): `PersistentUIModel.applyDefaultPanelLayout`,
  `closeDocumentGroupPrimaryDocument`, `stores.displayedActiveNavTab`, `ENavTab`.
