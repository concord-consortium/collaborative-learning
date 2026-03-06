# Default Panel Layout Setting (CLUE-338)

## Problem

CLUE always opens with a 50/50 split between the resources pane and workspace. Some curricula would benefit from opening with only the workspace visible, or only the resources pane visible, depending on the problem.

## Solution

Add a `defaultPanelLayout` configuration property that controls the initial divider position when a user first visits a problem.

### Configuration Property

```typescript
defaultPanelLayout?: "split" | "workspace-only" | "resources-only"
```

- `"split"` — both panels at 50/50 (default if property is omitted)
- `"workspace-only"` — resources panel collapsed, workspace fills the screen
- `"resources-only"` — workspace collapsed, resources panel fills the screen

### Configuration Cascade

The property lives in `ProblemConfiguration` (which `UnitConfiguration` extends), so it participates in the unit -> investigation -> problem cascade via `ConfigurationManager`. A unit can set a default, and individual problems can override it.

### Runtime Behavior

Applied on **first visit only**. In `PersistentUIModel.initializePersistentUISync()`, after loading saved state from Firebase:

- If no saved state exists for this user/problem, set the divider position based on the config:
  - `"split"` -> `kDividerHalf` (50)
  - `"workspace-only"` -> `kDividerMin` (0)
  - `"resources-only"` -> `kDividerMax` (100)
- If the user already has saved persistent UI state, their preference is respected and the config default is ignored.

### Authoring

The setting is added to the existing **Navigation Tabs** editor page in the authoring system as a "Panel Layout" select field. When `"split"` is selected (or no selection is made), the property is omitted from the JSON since it is the default.

## Files to Change

| File | Change |
|------|--------|
| `src/models/stores/unit-configuration.ts` | Add `defaultPanelLayout` to `ProblemConfiguration` interface |
| `src/models/stores/app-config-model.ts` | Add to MST model so it's accessible at runtime |
| `src/models/stores/persistent-ui/persistent-ui.ts` | Apply default divider position on first visit |
| `src/authoring/types.ts` | Add `defaultPanelLayout` to `IUnitConfig` |
| `src/authoring/components/workspace/nav-tabs.tsx` | Add Panel Layout select field to form and save logic |
