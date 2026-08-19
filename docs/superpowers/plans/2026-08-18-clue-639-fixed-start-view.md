# CLUE-639 Fixed Start View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unit authoring switch that, when on, forces every user to a fixed starting view on every load — a chosen nav tab, no document open (all thumbnails), divider reset to the unit default — instead of restoring their last-seen state.

> **Revision (per code review):** `applyFixedStartView` was reworked from mutating the persisted state
> into a session-only, non-destructive volatile override (`startViewOverride`) consulted by
> `displayedActiveNavTab`, `displayedDividerPosition`, and the doc browser. See the design doc revision note.

**Architecture:** Mirror the existing `defaultPanelLayout` unit setting through the 3-layer config chain (`ProblemConfiguration` → `ConfigurationManager` → `AppConfigModel`). Add a new `PersistentUIModel.applyFixedStartView` action plus two small pure helpers (`dividerForLayout`, `resolveStartView`). Invoke from the DB startup hook at `src/lib/db.ts` where `applyDefaultPanelLayout` already runs — but unconditionally (overriding restored state), and only when the target tab is displayed. Add the two fields to the authoring form.

**Tech Stack:** TypeScript, MobX-State-Tree, React, Jest.

---

## Task 1: Config setting + getters (3 layers)

**Files:**
- Modify: `src/models/stores/problem-configuration.ts` (add fields near `defaultPanelLayout`, ~line 37)
- Modify: `src/models/stores/configuration-manager.ts` (add getters near `defaultPanelLayout`, ~line 250)
- Modify: `src/models/stores/app-config-model.ts` (add getters near `defaultPanelLayout`, ~line 114)
- Test: `src/models/stores/configuration-manager.test.ts`

- [ ] **Step 1: Add the fields to `ProblemConfiguration`**

In `src/models/stores/problem-configuration.ts`, immediately after the `defaultPanelLayout` / `contentLayout` declarations inside `interface ProblemConfiguration`:

```ts
  // When true, every load starts on `fixedStartTab` (no open document, divider reset to the unit
  // default) instead of restoring the user's last-seen state. Off/undefined = restore last state.
  fixedStartView?: boolean;
  // The nav tab (an ENavTab id, e.g. "class-work") to start on when fixedStartView is true.
  // Kept as a separate value so toggling the switch off preserves the author's choice.
  fixedStartTab?: string;
```

- [ ] **Step 2: Add the `ConfigurationManager` getters**

In `src/models/stores/configuration-manager.ts`, next to the `defaultPanelLayout` getter:

```ts
  get fixedStartView() {
    return this.getProp<UC["fixedStartView"]>("fixedStartView");
  }

  get fixedStartTab() {
    return this.getProp<UC["fixedStartTab"]>("fixedStartTab");
  }
```

- [ ] **Step 3: Add the `AppConfigModel` getters**

In `src/models/stores/app-config-model.ts`, next to the `defaultPanelLayout` getter (~line 114):

```ts
    get fixedStartView() { return self.configMgr.fixedStartView; },
    get fixedStartTab() { return self.configMgr.fixedStartTab; },
```

- [ ] **Step 4: Write the failing layering test**

In `src/models/stores/configuration-manager.test.ts`, add inside the top-level `describe("ConfigurationManager", …)` (reuse the file's existing `defaults` fixture, as the `showShare` tests do at ~line 228):

```ts
  it("returns fixedStartView/fixedStartTab from the base config", () => {
    const config = new ConfigurationManager(
      { ...defaults, fixedStartView: true, fixedStartTab: "class-work" }, []);
    expect(config.fixedStartView).toBe(true);
    expect(config.fixedStartTab).toBe("class-work");
  });

  it("lets a later config override fixedStartTab", () => {
    const config = new ConfigurationManager(
      { ...defaults, fixedStartView: true, fixedStartTab: "class-work" },
      [{ fixedStartTab: "sort-work" }]);
    expect(config.fixedStartTab).toBe("sort-work");
  });

  it("defaults fixedStartView/fixedStartTab to undefined when unset", () => {
    const config = new ConfigurationManager(defaults, []);
    expect(config.fixedStartView).toBeUndefined();
    expect(config.fixedStartTab).toBeUndefined();
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/models/stores/configuration-manager.test.ts`
Expected: PASS (Steps 1–3 already implement the getters).

- [ ] **Step 6: Commit**

```bash
git add src/models/stores/problem-configuration.ts src/models/stores/configuration-manager.ts \
  src/models/stores/app-config-model.ts src/models/stores/configuration-manager.test.ts
git commit -m "CLUE-639: add fixedStartView/fixedStartTab unit config setting"
```

---

## Task 2: `dividerForLayout` + `resolveStartView` helpers

**Files:**
- Modify: `src/models/stores/persistent-ui/persistent-ui.ts` (export two module-level functions above `PersistentUIModel`)
- Test: `src/models/stores/persistent-ui/persistent-ui.test.ts`

Both helpers are pure and testable; `resolveStartView` holds the entire "force vs. restore" decision so the DB hook stays thin glue.

- [ ] **Step 1: Write the failing tests**

In `src/models/stores/persistent-ui/persistent-ui.test.ts`, add a new top-level `describe` (the file already imports `kDividerMin, kDividerMax, kDividerHalf` from `../ui-types`; add `dividerForLayout, resolveStartView` to the existing import from `./persistent-ui`):

```ts
describe("dividerForLayout", () => {
  it("maps each layout to a divider position", () => {
    expect(dividerForLayout("workspace-only")).toBe(kDividerMin);
    expect(dividerForLayout("resources-only")).toBe(kDividerMax);
    expect(dividerForLayout("split")).toBe(kDividerHalf);
    expect(dividerForLayout(undefined)).toBe(kDividerHalf);
  });
});

describe("resolveStartView", () => {
  const displayed = ["problems", "class-work", "sort-work"];

  it("returns undefined when the switch is off", () => {
    expect(resolveStartView({ fixedStartView: false, fixedStartTab: "class-work" }, displayed))
      .toBeUndefined();
  });

  it("returns undefined when no tab is set", () => {
    expect(resolveStartView({ fixedStartView: true }, displayed)).toBeUndefined();
  });

  it("returns undefined and warns when the tab is not displayed", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveStartView({ fixedStartView: true, fixedStartTab: "teacher-guide" }, displayed))
      .toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns the tab and layout-derived divider when displayed", () => {
    expect(resolveStartView(
      { fixedStartView: true, fixedStartTab: "class-work", defaultPanelLayout: "resources-only" },
      displayed
    )).toEqual({ tab: "class-work", dividerPosition: kDividerMax });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/models/stores/persistent-ui/persistent-ui.test.ts -t "dividerForLayout|resolveStartView"`
Expected: FAIL ("dividerForLayout is not a function" / import error).

- [ ] **Step 3: Implement the helpers**

In `src/models/stores/persistent-ui/persistent-ui.ts`, above `export const PersistentUIModel …` (the constants `kDividerHalf, kDividerMax, kDividerMin` are already imported from `../ui-types`):

```ts
type PanelLayout = "split" | "workspace-only" | "resources-only" | undefined;

// The divider position a given defaultPanelLayout implies. Used to reset the divider when forcing
// the author's start view, so fixedStartView and defaultPanelLayout stay consistent.
export function dividerForLayout(layout: PanelLayout) {
  switch (layout) {
    case "workspace-only": return kDividerMin;
    case "resources-only": return kDividerMax;
    default: return kDividerHalf; // "split" or undefined
  }
}

// The whole "force the author start view vs. restore last state" decision, kept pure/testable.
// Returns the tab + divider to force, or undefined to fall through to normal restore.
export function resolveStartView(
  opts: { fixedStartView?: boolean; fixedStartTab?: string; defaultPanelLayout?: PanelLayout },
  displayedTabs: string[]
): { tab: string; dividerPosition: number } | undefined {
  const { fixedStartView, fixedStartTab, defaultPanelLayout } = opts;
  if (!fixedStartView || !fixedStartTab) return undefined;
  if (!displayedTabs.includes(fixedStartTab)) {
    console.warn(`fixedStartView: "${fixedStartTab}" is not a displayed tab; ignoring`);
    return undefined;
  }
  return { tab: fixedStartTab, dividerPosition: dividerForLayout(defaultPanelLayout) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/models/stores/persistent-ui/persistent-ui.test.ts -t "dividerForLayout|resolveStartView"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/stores/persistent-ui/persistent-ui.ts src/models/stores/persistent-ui/persistent-ui.test.ts
git commit -m "CLUE-639: add dividerForLayout and resolveStartView helpers"
```

---

## Task 3: `applyFixedStartView` action

**Files:**
- Modify: `src/models/stores/persistent-ui/persistent-ui.ts` (add action next to `applyDefaultPanelLayout`, ~line 95)
- Test: `src/models/stores/persistent-ui/persistent-ui.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/models/stores/persistent-ui/persistent-ui.test.ts`, add inside the top-level `describe("PersistentUI", …)`:

```ts
  describe("applyFixedStartView", () => {
    it("forces the tab, closes the open document, and resets the divider — overriding saved state", () => {
      const ui = PersistentUIModel.create({
        version: "2.0.0",
        tabs: {
          "class-work": {
            id: "class-work",
            currentDocumentGroupId: "Workspaces",
            visitedDocumentGroups: { Workspaces: { id: "Workspaces", currentDocumentKeys: ["doc-1"] } }
          }
        },
        activeNavTab: "my-work",
        dividerPosition: kDividerMax,
        problemWorkspace: { type: "problem", mode: "1-up" }
      });
      // Simulate a returning user whose state was restored from Firebase.
      ui.setHasSavedPersistentUI(true);

      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);

      expect(ui.activeNavTab).toBe(ENavTab.kClassWork);
      expect(ui.tabs.get("class-work")?.currentDocumentGroup?.userExplicitlyClosedDocument).toBe(true);
      expect(ui.dividerPosition).toBe(kDividerHalf);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/models/stores/persistent-ui/persistent-ui.test.ts -t "applyFixedStartView"`
Expected: FAIL ("applyFixedStartView is not a function").

- [ ] **Step 3: Implement the action**

In `src/models/stores/persistent-ui/persistent-ui.ts`, in the same `.actions(self => ({ … }))` block that contains `applyDefaultPanelLayout` (they are siblings), add:

```ts
    // Force the author-configured start view, OVERRIDING any restored state (unlike
    // applyDefaultPanelLayout, this is intentionally not guarded by hasSavedPersistentUI).
    // Called on every load when the unit's fixedStartView switch is on and the tab is displayed.
    applyFixedStartView(tab: string, dividerPosition: number) {
      self.setActiveNavTab(tab);
      // Close any open primary document in the tab's current group → currentDocumentKeys becomes [],
      // which renders the thumbnail browser. Comparison mode is already cleared during
      // initializePersistentUISync, so there is no secondary document to promote. If the tab has no
      // current document group yet, closeDocumentGroupPrimaryDocument is a no-op (nothing was open).
      self.closeDocumentGroupPrimaryDocument(tab);
      self.setDividerPosition(dividerPosition);
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/models/stores/persistent-ui/persistent-ui.test.ts -t "applyFixedStartView"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/stores/persistent-ui/persistent-ui.ts src/models/stores/persistent-ui/persistent-ui.test.ts
git commit -m "CLUE-639: add applyFixedStartView action"
```

---

## Task 4: Wire the DB startup hook

**Files:**
- Modify: `src/lib/db.ts` (~line 195, the `persistentUIReady.then(...)` block)

This is thin glue over the tested helpers/action (mirrors how `applyDefaultPanelLayout` is invoked and not separately unit-tested at the db layer).

- [ ] **Step 1: Add the import**

At the top of `src/lib/db.ts`, add `resolveStartView` to the import from the persistent-ui model (find the existing import of `persistent-ui` symbols; if the store is only reached via `this.stores.persistentUI`, add a direct import):

```ts
import { resolveStartView } from "../models/stores/persistent-ui/persistent-ui";
```

- [ ] **Step 2: Replace the `applyDefaultPanelLayout` call with the forced-vs-restore branch**

Change the existing block:

```ts
              persistentUIReady.then(() => {
                persistentUI.applyDefaultPanelLayout(this.stores.appConfig.defaultPanelLayout);
              }).catch((err) => {
                console.error("Error initializing persistent UI:", err);
              });
```

to:

```ts
              persistentUIReady.then(() => {
                const { appConfig } = this.stores;
                const displayedTabs = this.stores.tabsToDisplay.map(t => t.tab);
                const startView = resolveStartView({
                  fixedStartView: appConfig.fixedStartView,
                  fixedStartTab: appConfig.fixedStartTab,
                  defaultPanelLayout: appConfig.defaultPanelLayout
                }, displayedTabs);
                if (startView) {
                  // Force the author's start view on every load, overriding restored state.
                  persistentUI.applyFixedStartView(startView.tab, startView.dividerPosition);
                } else {
                  persistentUI.applyDefaultPanelLayout(appConfig.defaultPanelLayout);
                }
              }).catch((err) => {
                console.error("Error initializing persistent UI:", err);
              });
```

- [ ] **Step 3: Verify types compile**

Run: `npm run check:types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "CLUE-639: force author start view at startup when configured"
```

---

## Task 5: Authoring form fields

**Files:**
- Modify: `src/authoring/types.ts` (add fields to the unit-config type, near `defaultPanelLayout` ~line 61)
- Modify: `src/authoring/components/workspace/nav-tabs.tsx` (form input type, defaults, submit, JSX)

- [ ] **Step 1: Add the fields to the authoring config type**

In `src/authoring/types.ts`, next to `defaultPanelLayout` (~line 61):

```ts
  fixedStartView?: boolean;
  fixedStartTab?: string;
```

- [ ] **Step 2: Extend the form input type**

In `src/authoring/components/workspace/nav-tabs.tsx`, in `interface INavTabsInputs` (~line 16):

```ts
  fixedStartView: boolean;
  fixedStartTab: string;
```

- [ ] **Step 3: Add current-value memos**

Next to `currentPanelLayout` / `currentContentLayout` (~lines 66–71):

```ts
  const currentFixedStartView = useMemo(() => {
    return unitConfig?.config?.fixedStartView ?? false;
  }, [unitConfig]);
  const currentFixedStartTab = useMemo(() => {
    return unitConfig?.config?.fixedStartTab ?? "";
  }, [unitConfig]);
```

- [ ] **Step 4: Persist on submit**

In `onSubmit`, inside `setUnitConfig(draft => { if (draft) { … } })`, after the `contentLayout` block:

```ts
        // Fixed start view (omit when off / no tab, so the default "restore last state" applies)
        if (data.fixedStartView && data.fixedStartTab) {
          draft.config.fixedStartView = true;
          draft.config.fixedStartTab = data.fixedStartTab;
        } else {
          delete draft.config.fixedStartView;
          // Preserve the author's tab choice on the draft even when the switch is off, so re-enabling
          // doesn't lose it — only clear it if no tab is selected at all.
          if (!data.fixedStartTab) delete draft.config.fixedStartTab;
          else draft.config.fixedStartTab = data.fixedStartTab;
        }
```

- [ ] **Step 5: Add the form controls**

In the JSX, after the Panel Layout `</fieldset>` (~line 139) and before the `<table>`:

```tsx
      <fieldset>
        <legend>Fixed Start View</legend>
        <p className="muted">
          When on, every user starts on the selected tab (no document open, divider reset) on every
          load, instead of resuming where they left off.
        </p>
        <label>
          <input type="checkbox" {...register("fixedStartView")} defaultChecked={currentFixedStartView} />
          {" "}Always start on a fixed tab
        </label>
        <select {...register("fixedStartTab")} defaultValue={currentFixedStartTab}>
          <option value="">(choose a tab)</option>
          {formTabs.map(formTab => (
            <option key={formTab.tab} value={formTab.tab}>{formTab.defaultLabel}</option>
          ))}
        </select>
      </fieldset>
```

- [ ] **Step 6: Verify types + lint**

Run: `npm run check:types && npx eslint src/authoring/components/workspace/nav-tabs.tsx src/authoring/types.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/authoring/types.ts src/authoring/components/workspace/nav-tabs.tsx
git commit -m "CLUE-639: add fixed start view fields to the authoring form"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run all touched jest suites**

Run:
```bash
npx jest src/models/stores/persistent-ui/persistent-ui.test.ts \
  src/models/stores/configuration-manager.test.ts \
  src/models/stores/app-config-model.test.ts
```
Expected: all green.

- [ ] **Step 2: Type-check + lint the whole change**

Run: `npm run check:types && npx eslint src/models/stores/persistent-ui/persistent-ui.ts src/lib/db.ts src/models/stores/configuration-manager.ts src/models/stores/app-config-model.ts src/models/stores/problem-configuration.ts`
Expected: no errors.

- [ ] **Step 3: Manual smoke test on localhost (before any push)**

Run `npm start`, then, in a unit whose config sets `"fixedStartView": true, "fixedStartTab": "class-work"`:
- Reload with a previously-open document / non-default tab / non-default divider → confirm it lands on Class Work, no document open (all thumbnails), divider at the unit default.
- Navigate away, reload → confirm it re-forces the start view.
- Remove `fixedStartView` (or set false) → confirm normal restore-last-state behavior returns.
- Set `fixedStartTab` to a hidden/teacher-only tab → confirm it falls back to normal restore and warns in the console.

Do not push until the localhost check passes and the user OKs.
