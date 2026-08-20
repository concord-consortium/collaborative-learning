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
// Force the author's start view for this session WITHOUT mutating the persisted record: volatile
// fields the display consults, released as soon as the user acts. The saved state survives.
applyFixedStartView(tab: string, dividerPosition: number) {
  self.startViewTab = tab;
  self.startViewDividerPosition = dividerPosition;
}
```

Notes:
- `startViewTab`, `startViewDividerPosition` and `startViewSubTabPinned` are `.volatile` fields, so
  they are never written back to Firebase. They are three parts of one setting but are released
  independently, because no one user action implies the others: navigating hands back the user's own
  tab, resizing hands back their own divider, and choosing a sub tab hands back their own sub tab.
  Releasing them together breaks in each direction. Releasing the tab on a resize swaps the panel's
  content underneath the resize; releasing the divider on a navigation collapses the panel out from
  under a returning user who had left the resources pane closed; releasing the sub tab pin on a
  navigation would apply the author's sub tab to a tab the user chose.
- `startViewSubTabPinned` makes the forced tab open on its FIRST sub tab instead of the one the user
  last used, so "start on Class Work with every published thumbnail visible" lands on the thumbnails.
  `applyFixedStartView` sets it only for the document tabs; the curriculum tabs always render a
  section rather than a browser, so there is no first sub tab to start on there.
  `isStartViewSubTabPinnedFor(tab)` drives `subTabIndex` in `section-document-or-browser`, and the
  new `selectDocumentGroup(tab, docGroupId)` action releases the pin for its own tab before recording
  the choice, so a sub tab click is never swallowed by the pin. Initialization keeps using
  `setCurrentDocumentGroupId`, which must not release anything.
- The display consults them. `stores.displayedActiveNavTab` prefers `startViewTab`;
  `displayedDividerPosition` prefers `startViewDividerPosition`; `focusDocument` /
  `focusSecondaryDocument` report the *displayed* tab, so a document tab held by the override reports
  nothing open (a curriculum tab still reports its section); and `isStartViewOverrideActiveFor(tab)`
  tells each renderer of a document tab to show its thumbnail browser with no selection
  (`section-document-or-browser`, `sort-work-view`).
- The tab is released by `clearStartViewOverride`, which `setActiveNavTab`,
  `openDocumentGroupPrimaryDocument` and `openDocumentGroupSecondaryDocument` all call, so the first
  genuine navigation restores the user's own (still-persisted) tab for the rest of the session. Any
  path that opens a document has to go through those actions rather than writing to `UITabModel`
  directly, or the override outlives the navigation and keeps suppressing the document that was just
  opened (`sorted-section`, `document-scroller`).
- The divider is released by `setDividerPosition` alone, that is, by an actual resize: dragging the
  divider, collapsing the pane, or following the "skip to resources" link.
- `db.ts` calls `applyDefaultPanelLayout` on every load as well as forcing the view, so a first-time
  visitor still gets the unit's layout persisted underneath the override rather than falling back to
  `kDividerHalf` once it is released.
- Consumers must compare against the *displayed* values, not the persisted ones: `nav-tab-panel`'s
  `handleSelectTab` compares the clicked tab against `stores.displayedActiveNavTab`, otherwise the tab
  the user sees selected is unreachable and clicking it closes an unrelated saved document. It also
  skips the close-on-reclick when the forced view held that tab: nothing was on screen to close, so the
  click hands the user back their own document instead of destroying it.

### 3. Startup hook (`src/lib/db.ts`)

At the existing point where `applyDefaultPanelLayout` is called (~line 195, after
`persistentUIReady` and the unit are ready), add:

```ts
const { appConfig } = this.stores;
const displayedTabs = this.stores.tabsToDisplay.map(t => t.tab);
const startView = resolveStartView({
  fixedStartView: appConfig.fixedStartView,
  fixedStartTab: appConfig.fixedStartTab,
  defaultPanelLayout: appConfig.defaultPanelLayout,
  hasDocumentTarget: !!urlParams.studentDocument
}, displayedTabs);
persistentUI.applyDefaultPanelLayout(appConfig.defaultPanelLayout);
if (startView) {
  persistentUI.applyFixedStartView(startView.tab, startView.dividerPosition);
}
```

The decision itself lives in `resolveStartView` (a pure helper in `persistent-ui.ts`) so it can be
unit tested without the DB layer. It warns and returns `undefined` for a non-displayed tab, and also
returns `undefined` when the user arrived with an explicit document target (`?studentDocument=...`),
so a shared link is never hijacked by the forced view.

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
- `applyDefaultPanelLayout` runs on **every** load, whether or not the view is forced, so a first-time
  visitor still gets the unit's layout persisted underneath the override. Otherwise releasing the
  override would drop them to the bare `kDividerHalf` default instead of the layout the author chose.
- Both steps live in `applyStartupUIState`, exported next to `resolveStartView`, so the startup seam
  is unit-testable instead of being untested glue inside `db.ts`.

### 4. Authoring UI

Add the two settings to the author form that already hosts `defaultPanelLayout`
(`src/authoring/components/workspace/nav-tabs.tsx`, registration ~lines 67–121) and mirror the
types in `src/authoring/types.ts`:
- `fixedStartView` → a boolean toggle ("Start every session on a fixed tab").
- `fixedStartTab` → a dropdown, enabled when the toggle is on **or** a tab is already stored, so an
  author can clear a wrong choice; clearing it to "(choose a tab)" with the toggle off deletes the
  setting. The `disabled` rule reads the SAVED tab, not the watched one, or the select would disable
  itself the instant the author cleared it and take their keyboard focus with it. It lists only tabs that are shown and
  not teacher-only (mirroring `resolveStartView`'s guard, so an author cannot pick a tab that will be
  ignored), labeled with the unit's custom labels, and read from the form's current values so a tab
  shown or hidden in this editing session is offered immediately.
- The form is seeded with react-hook-form's `values` option rather than `defaultValue`/`defaultChecked`,
  which React applies only at mount: `unitConfig` loads asynchronously and is reset when the author
  switches branches, so a form seeded from the DOM keeps showing the previous unit's values. Note RHF
  builds submit data from its own `_formValues`, not from the DOM, and a JSX `disabled` prop (unlike
  `register`'s `disabled` option) does not strip a field from the submission.
- The fieldset warns when `defaultPanelLayout` is `workspace-only`, which collapses the resources
  panel and so hides the forced tab entirely.

## Edge cases

- **Switch off / unset** → today's behavior exactly (restore last state; `applyDefaultPanelLayout`
  still runs for first-time visitors).
- **`fixedStartView` on but `fixedStartTab` unset or not displayed** → no forcing; warn; normal restore.
- **`?noPersistentUI`** → `initializePersistentUISync` returns early before the hook; forcing is
  effectively moot (nothing restored anyway). No special handling needed.
- **Teacher on a student-oriented target tab** → allowed by the "all users" decision, but only if
  the tab is displayed for that user; teacher-only/hidden filtering still applies via the guard.
- **Sub-tab**: the forced tab opens on its FIRST sub tab, via the volatile `startViewSubTabPinned`
  rather than by resetting the persisted `currentDocumentGroupId`. A sub tab click adopts that sub tab
  as the user's own and releases only the pin, not the tab. Without this, a user whose last Class Work
  sub tab was Bookmarks would be forced to Class Work and still not see the published work. This includes the
  Bookmarks sub-tab, which normally always renders `DocumentView`: while the override is active it
  shows the browser listing of bookmarked documents like any other sub-tab.
- **`?studentDocument=` deep link** → the forced view stands down, so the linked document opens.
- **`defaultPanelLayout: "workspace-only"`** → `resolveStartView` refuses it with a warning. The
  derived divider would be `kDividerMin`, which collapses the resources panel, so the forced tab would
  not be on screen at all; and because the forced divider is only released by an actual resize, it
  would close the panel on every load for a returning user who had opened it. The authoring form warns
  and `docs/unit-configuration.md` says so.
- **Curriculum tabs (`problems`, `teacher-guide`)** → "no document open" does not apply; the tab is
  forced and its restored section still shows, so comments and read-aloud keep working there.
- **`student-work`** → not supported (`kUnsupportedFixedStartTabs`). It is group keyed and always
  renders the four-up, so it has no thumbnail-browser state to start in, and its focused-student key is
  read directly by the teacher dashboard as well as the resources panel. `resolveStartView` refuses it
  with a warning and the authoring dropdown never offers it.

## Testing

- **`persistent-ui.test.ts`**, `applyFixedStartView(tab, divider)`: `displayedActiveNavTab`-facing
  state changes while the persisted `activeNavTab`, `dividerPosition` and document groups are
  untouched, including for a two-key group and for a tab that has never been visited; `focusDocument`
  reports nothing open for a document tab and still reports the section path for a curriculum tab;
  each of the four clearing actions drops the override. Confirm it applies even when
  `hasSavedPersistentUI` is true.
- **`resolveStartView`**: off, no tab, non-displayed tab (warns), unsupported tab (warns), explicit
  document target, and the forced case returning the layout-derived divider.
- **Renderers**: `section-document-or-browser` (browser instead of `DocumentView`, no thumbnail
  selected, saved key untouched, document returned on navigation) and `sorted-section` (a Sort Work
  thumbnail click ends the forced view and opens the document).
- **`nav-tab-panel`**: clicking the tab the user's saved state points at while another is forced, and
  clicking the forced tab itself.
- **Authoring form**: seeding from a config that arrives late, the shown/teacher-only filter including
  `student-work`, refusing to save a start tab that is no longer shown, and the `workspace-only` warning.
- **`configuration-manager` / `app-config-model`** — the two new getters resolve through the unit →
  investigation → problem layering and override order, matching the `defaultPanelLayout` tests.
- **Startup guard** — covered by the `applyStartupUIState` describe in `persistent-ui.test.ts`:
  `fixedStartView` on + displayed tab → forced with the layout-derived divider, on top of the layout
  that `applyDefaultPanelLayout` persisted; on + non-displayed tab → not forced, warns; off → layout
  only; `?studentDocument=` present → not forced; returning user → saved divider untouched.
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
