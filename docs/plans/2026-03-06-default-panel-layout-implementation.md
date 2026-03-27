# Default Panel Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `defaultPanelLayout` unit setting that controls whether CLUE opens in split, workspace-only, or resources-only mode for first-time visitors.

**Architecture:** New `defaultPanelLayout` property added to `ProblemConfiguration` interface, cascaded through `ConfigurationManager` and `AppConfigModel`. Applied at startup in `db.ts` after both persistent UI and unit config have loaded. Authored via the existing Navigation Tabs editor in the authoring system.

**Tech Stack:** TypeScript, MobX State Tree, React Hook Form

---

### Task 1: Add type and config cascade

**Files:**
- Modify: `src/models/stores/problem-configuration.ts`
- Modify: `src/models/stores/unit-configuration.ts`
- Modify: `src/models/stores/configuration-manager.ts`
- Modify: `src/models/stores/app-config-model.ts`
- Modify: `src/test-fixtures/sample-unit-configurations.ts`

**Step 1: Add the type to ProblemConfiguration**

In `src/models/stores/problem-configuration.ts`, add to the `ProblemConfiguration` interface:

```typescript
  // default panel layout when user first visits a problem
  // "split" (default) shows both panels; "workspace-only" collapses resources; "resources-only" collapses workspace
  defaultPanelLayout?: "split" | "workspace-only" | "resources-only";
```

Since `UnitConfiguration` extends `ProblemConfiguration`, this makes the property available at all cascade levels.

**Step 2: Add getter to ConfigurationManager**

In `src/models/stores/configuration-manager.ts`, add a getter alongside the other `ProblemConfiguration` properties (near line 210):

```typescript
  get defaultPanelLayout() {
    return this.getProp<UC["defaultPanelLayout"]>("defaultPanelLayout");
  }
```

**Step 3: Add view to AppConfigModel**

In `src/models/stores/app-config-model.ts`, add a view alongside the other config views (near line 105):

```typescript
    get defaultPanelLayout() { return self.configMgr.defaultPanelLayout; },
```

**Step 4: Update test fixtures**

In `src/test-fixtures/sample-unit-configurations.ts`, add to `unitConfigDefaults`:

```typescript
  defaultPanelLayout: undefined,
```

Add to `unitConfigOverrides`:

```typescript
  defaultPanelLayout: "workspace-only",
```

**Step 5: Run tests to verify nothing breaks**

Run: `npm test -- src/models/stores/app-config-model.test.ts`
Expected: All existing tests pass. The new property cascades automatically through the existing `getProp` mechanism.

**Step 6: Commit**

```
feat: add defaultPanelLayout to unit configuration cascade (CLUE-338)
```

---

### Task 2: Add test for defaultPanelLayout config cascade

**Files:**
- Modify: `src/models/stores/app-config-model.test.ts`

**Step 1: Write the test**

Add to `src/models/stores/app-config-model.test.ts`:

```typescript
  describe("defaultPanelLayout", () => {
    it("should return undefined when not configured", () => {
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
      expect(appConfig.defaultPanelLayout).toBeUndefined();
    });

    it("should return the configured value", () => {
      const appConfig = AppConfigModel.create({
        config: { ...unitConfigDefaults, defaultPanelLayout: "workspace-only" }
      });
      expect(appConfig.defaultPanelLayout).toBe("workspace-only");
    });

    it("should cascade from override configs", () => {
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
      appConfig.setConfigs([{ defaultPanelLayout: "resources-only" }]);
      expect(appConfig.defaultPanelLayout).toBe("resources-only");
    });
  });
```

**Step 2: Run tests**

Run: `npm test -- src/models/stores/app-config-model.test.ts`
Expected: PASS

**Step 3: Commit**

```
test: add defaultPanelLayout config cascade tests (CLUE-338)
```

---

### Task 3: Apply default panel layout on first visit

**Files:**
- Modify: `src/models/stores/persistent-ui/persistent-ui.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/models/stores/ui-types.ts` (check for existing type)

**Context:** Two async operations happen at startup: (1) persistent UI loads from Firebase, (2) unit config loads. The default panel layout must be applied only after both complete, and only if no saved state was found.

**Step 1: Add volatile flag to PersistentUIModel**

In `src/models/stores/persistent-ui/persistent-ui.ts`, add to the `.volatile()` block (around line 48):

```typescript
    hasSavedPersistentUI: false,
```

**Step 2: Set the flag in initializePersistentUISync**

In `initializePersistentUISync`, after the `safeJsonParse` call, set the flag based on whether Firebase had data. Add right before the `if (asObj)` block:

```typescript
      self.hasSavedPersistentUI = !!asObj;
```

**Step 3: Add action to apply default panel layout**

Add an action to PersistentUIModelV2 (in the same actions block as `setDividerPosition`):

```typescript
    applyDefaultPanelLayout(layout: "split" | "workspace-only" | "resources-only" | undefined) {
      if (self.hasSavedPersistentUI) return;
      switch (layout) {
        case "workspace-only":
          self.dividerPosition = kDividerMin;
          break;
        case "resources-only":
          self.dividerPosition = kDividerMax;
          break;
        // "split" or undefined: keep the default kDividerHalf
      }
    },
```

**Step 4: Call from db.ts after both loads complete**

In `src/lib/db.ts`, capture the persistent UI sync promise and apply the default after both it and the unit have loaded. Change the initialization block (around line 140):

```typescript
            const { persistentUI, user, db, unitLoadedPromise, exemplarController} = this.stores;

            // Record launch time in Firestore
            this.firestore.recordLaunchTime();

            // Start fetching the persistent UI. We want this to happen as early as possible.
            const persistentUIReady = persistentUI.initializePersistentUISync(user, db);

            // Resolve after listeners have started.
            unitLoadedPromise.then(() => {
              this.listeners.start().then(resolve).catch(reject);
              exemplarController.initialize(this.stores);

              // After unit loads, apply configured default panel layout for first-time visitors
              persistentUIReady.then(() => {
                persistentUI.applyDefaultPanelLayout(this.stores.appConfig.defaultPanelLayout);
              });
            });
```

**Step 5: Run tests**

Run: `npm test -- src/models/stores/persistent-ui/persistent-ui.test.ts`
Expected: Existing tests pass. The new volatile and action don't affect existing behavior.

**Step 6: Commit**

```
feat: apply defaultPanelLayout on first visit when no saved UI state (CLUE-338)
```

---

### Task 4: Add test for applying default panel layout

**Files:**
- Modify: `src/models/stores/persistent-ui/persistent-ui.test.ts`

**Step 1: Write tests for applyDefaultPanelLayout**

Add a new `describe` block:

```typescript
describe("applyDefaultPanelLayout", () => {
  it("sets divider to kDividerMin for workspace-only when no saved state", () => {
    const model = PersistentUIModel.create({});
    // hasSavedPersistentUI defaults to false (no saved state)
    model.applyDefaultPanelLayout("workspace-only");
    expect(model.dividerPosition).toBe(kDividerMin);
  });

  it("sets divider to kDividerMax for resources-only when no saved state", () => {
    const model = PersistentUIModel.create({});
    model.applyDefaultPanelLayout("resources-only");
    expect(model.dividerPosition).toBe(kDividerMax);
  });

  it("keeps kDividerHalf for split when no saved state", () => {
    const model = PersistentUIModel.create({});
    model.applyDefaultPanelLayout("split");
    expect(model.dividerPosition).toBe(kDividerHalf);
  });

  it("keeps kDividerHalf for undefined when no saved state", () => {
    const model = PersistentUIModel.create({});
    model.applyDefaultPanelLayout(undefined);
    expect(model.dividerPosition).toBe(kDividerHalf);
  });

  it("does not change divider when saved state exists", () => {
    const model = PersistentUIModel.create({});
    // Simulate saved state loaded from Firebase
    (model as any).hasSavedPersistentUI = true;
    model.applyDefaultPanelLayout("workspace-only");
    expect(model.dividerPosition).toBe(kDividerHalf);
  });
});
```

Note: Check `persistent-ui.test.ts` for the correct import pattern and how `PersistentUIModel` is created in tests. Adjust the volatile assignment if needed — you may need to use `runInAction` from MST to set the volatile.

**Step 2: Run tests**

Run: `npm test -- src/models/stores/persistent-ui/persistent-ui.test.ts`
Expected: PASS

**Step 3: Commit**

```
test: add applyDefaultPanelLayout tests (CLUE-338)
```

---

### Task 5: Add to authoring types and Navigation Tabs editor

**Files:**
- Modify: `src/authoring/types.ts`
- Modify: `src/authoring/components/workspace/nav-tabs.tsx`

**Step 1: Add to authoring types**

In `src/authoring/types.ts`, add to `IUnitConfig` interface:

```typescript
  defaultPanelLayout?: "split" | "workspace-only" | "resources-only";
```

**Step 2: Add Panel Layout select to NavTabs form**

In `src/authoring/components/workspace/nav-tabs.tsx`:

Add to the form inputs interface:

```typescript
interface INavTabsInputs {
  tabs: FormTab[];
  defaultPanelLayout: string;
}
```

Add a `useMemo` for the current value:

```typescript
  const currentPanelLayout = useMemo(() => {
    return unitConfig?.config?.defaultPanelLayout ?? "split";
  }, [unitConfig]);
```

Add the select field above the tabs table in the JSX (before `<table>`):

```tsx
      <fieldset className="panel-layout-fieldset">
        <legend>Panel Layout</legend>
        <p className="muted">
          Controls which panels are visible when a student first opens this problem.
        </p>
        <select
          {...register("defaultPanelLayout")}
          defaultValue={currentPanelLayout}
        >
          <option value="split">Split (resources and workspace)</option>
          <option value="workspace-only">Workspace only</option>
          <option value="resources-only">Resources only</option>
        </select>
      </fieldset>
```

Update the `onSubmit` handler to save the panel layout:

```typescript
  const onSubmit: SubmitHandler<INavTabsInputs> = (data) => {
    setUnitConfig(draft => {
      if (draft) {
        // Save panel layout (omit if "split" since that's the default)
        if (data.defaultPanelLayout && data.defaultPanelLayout !== "split") {
          draft.config.defaultPanelLayout = data.defaultPanelLayout as any;
        } else {
          delete (draft.config as any).defaultPanelLayout;
        }

        // existing tab-saving logic...
        formTabs.forEach((tab, index) => {
          // ... unchanged ...
        });
      }
    });
  };
```

**Step 3: Run the build to check for TypeScript errors**

Run: `npm run check:types`
Expected: No new errors

**Step 4: Commit**

```
feat: add Panel Layout setting to Navigation Tabs authoring editor (CLUE-338)
```

---

### Task 6: Manual verification and final commit

**Step 1: Run full test suite for changed files**

Run: `npm test -- src/models/stores/app-config-model.test.ts src/models/stores/persistent-ui/persistent-ui.test.ts`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Run type check**

Run: `npm run check:types`
Expected: No new type errors

**Step 4: Update design doc to mark as implemented**

Add "Status: Implemented" to the top of `docs/plans/2026-03-06-default-panel-layout-design.md`.

**Step 5: Commit**

```
docs: mark defaultPanelLayout design as implemented (CLUE-338)
```
