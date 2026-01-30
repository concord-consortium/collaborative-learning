# Add Curriculum Subtabs to Problems

## Story

As a CLUE curriculum designer, I need to create and reorganize subtabs within problems.

- Problem subtabs can be picked from the list of unused tab/section names (set in the Curriculum tabs)
- Problem subtabs can be set and ordered on the Problem Configuration page
- add/rename all directories/content types in the project to match *(out of scope for this spec)*
- add/rename all the references unit type JSON to match *(out of scope for this spec)*
- Teacher Guide tab authoring works the same way with Teacher Guide section names
- Don't permanently delete sections that are no longer referenced, that can be done manually. Just don't show them.

---

## Runtime Section System Reference

This section documents how sections work in the CLUE runtime, to ensure generated code produces compatible output.

### Data Flow Overview

```
Unit JSON (content.json)
    │
    ├─ /sections: ISectionInfoMap (section type definitions)
    │   ├─ "introduction": { initials: "IN", title: "Introduction", ... }
    │   └─ "initialChallenge": { initials: "IC", title: "Initial Challenge", ... }
    │
    └─ /investigations[n]/problems[m]
        └─ sections: ["path/to/section1.json", "path/to/section2.json", ...]
                          │
                          ▼
                    [External Files]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    { type: "introduction",    { type: "initialChallenge",
      tiles: [...] }             tiles: [...] }
```

### Key Structures

**Unit's `/sections` map** (defines available section types):
```json
{
  "sections": {
    "introduction": {
      "initials": "IN",
      "title": "Introduction",
      "placeholder": "Work area for Introduction section"
    },
    "initialChallenge": {
      "initials": "IC",
      "title": "Initial Challenge"
    }
  }
}
```

**Problem's `sections` array** (references content files):
```json
{
  "ordinal": 1,
  "title": "1.1 Problem Title",
  "sections": [
    "investigation-1/problem-1/introduction/content.json",
    "investigation-1/problem-1/initialChallenge/content.json"
  ]
}
```

**Section content file** (e.g., `investigation-1/problem-1/introduction/content.json`):
```json
{
  "type": "introduction",
  "tiles": [
    {
      "id": "abc123",
      "content": { "type": "Text", "format": "html", "text": ["<p>Welcome!</p>"] }
    }
  ]
}
```

### Runtime Loading Process

1. **Unit loads** → `registerSectionInfo(unit.sections)` populates global `gSectionInfoMap`
2. **Problem loads** → `problem.loadSections()` fetches each file path in `sections` array
3. **Section file parsed** → `type` field (e.g., `"introduction"`) matches against `gSectionInfoMap`
4. **UI renders** → Section tabs display `title` from the map, content from the file

### Files Map in Authoring

The authoring system maintains a `files` map in Firebase that tracks file metadata:
```typescript
files: {
  "investigation-1/problem-1/introduction/content.json": {
    type: "introduction",  // Must match section type key
    title: "Introduction"  // Optional display title
  }
}
```

The `type` field in the files map comes from the `type` field in the content file itself (set via `/putContent` API).

### Validation Requirements

For the runtime to work correctly:
1. **Section type must exist** - `content.type` must be a key in unit's `/sections` map
2. **File path in problem.sections** - Must point to a valid content file
3. **Content file structure** - Must have `type` field matching a section type key
4. **No duplicate types** - Each problem should have at most one section per type

---

## Implementation Summary

### Scope

This feature adds UI to the **Problem Configuration page** (`ProblemSections` component) to allow authors to:
1. Select which section types (from the unit's existing `/sections` map) are included in a problem
2. Reorder the selected sections
3. Automatically generate/link content files for new sections

**Out of scope:** Adding/removing section type definitions (authors use existing types from Curriculum Tabs or edit raw JSON).

### Key Decisions

| Decision | Choice |
|----------|--------|
| Section type definitions | Use existing types from `/sections` (Curriculum Tabs page) |
| Section properties | Unit-level only (no per-problem overrides) |
| File path generation | Auto-generate: `investigation-{n}/problem-{m}/{sectionType}/content.json` |
| Existing files | Reuse if file exists at expected path (enables recovery) |
| Teacher Guide sections | Separate list from `planningDocument.sectionInfo` |
| Section removal | Hide only (remove from array, keep content file) |
| Section type deletion | Prevent if in use by any problem |
| Validation | No duplicates + type must exist (empty problems allowed) |
| File creation | On save only |

### UI Pattern

Checkbox + reorder table (matching pattern from `unit-item-children.tsx`):
- Table showing all available section types from `/sections`
- Checkbox column to enable/disable each section for this problem
- ↑↓ reorder buttons using `fieldArray.swap()` to reorder any adjacent items
- Items stay in place when checkbox is toggled (no automatic sorting)
- On save, enabled items are collected in their current list order

### Files to Modify

- `src/authoring/components/workspace/container-config/problem-sections.tsx` - Main implementation
- `src/authoring/components/workspace/container-config/container-config.tsx` - Integration
- `src/authoring/utils/nav-path.ts` - Path generation utilities

### File Metadata Handling

When new section files are created, they must be added to the Firebase `files` map so the UI can track them. The `files` state in `use-curriculum.tsx` is synced from Firebase via a listener at `authoring/content/branches/${branch}/units/${unit}/files`.

**Approach:** The existing `/putContent` API (in `authoring-api/src/routes/put-content.ts`) already handles this automatically. When content is saved with a `type` field, the API updates the Firebase files metadata:

```typescript
// From put-content.ts - already implemented
if (content.type || content.title) {
  const filePath = getUnitFilesPath(branch, unit, escapedPath);
  await db.ref(filePath).transaction((file) => {
    file = file ?? { type: "unknown", title: "Untitled" };
    if (content.type) file.type = content.type;
    if (content.title) file.title = content.title;
    return file;
  });
}
```

This means we just need to ensure new section content includes the correct `type` field (the section type key, e.g., `"introduction"`).

---

## Questions (All Resolved)

### 1. ✅ Section Type Definitions

**Choice:** Curriculum Tabs page only. Authors define all section types on the existing Curriculum Tabs configuration page. Problems can only pick from these pre-defined types.

### 2. ✅ Section Type Properties

**Choice:** Unit-level only. All section type properties (initials, title, placeholder) are defined once at the unit level and inherited by all problems.

### 3. ✅ File Path Generation

**Choice:** Auto-generate based on convention (`investigation-{n}/problem-{m}/{sectionType}/content.json`), but:
- Ensure it doesn't conflict with an existing investigation or problem file
- Detect if the unit uses a different path structure and mirror that pattern

### 4. ✅ Handling Existing Files

**Choice:** Reuse existing file. If a file exists at the expected path, use it (allows recovery of previously removed sections).

### 5. ✅ Teacher Guide Sections

**Choice:** Separate type lists. Teacher Guide sections use `planningDocument.sectionInfo`, curriculum sections use `/sections`.

### 6. ✅ Section Removal Behavior

**Choice:** Hide only. Remove the section reference from the problem's `sections` array but leave the content file untouched.

**Note:** Restoration is automatic - when adding a section type back, path generation finds the existing file.

### 7. ✅ Section Type Deletion

**Choice:** Prevent deletion of section types still in use. UI should message why delete is disabled.

### 8. ✅ UI for Section Selection

**Choice:** Hybrid checkbox + reorder table (see UI Pattern above).

### 9. ✅ Validation

**Choice:**
- No duplicate section types in a problem
- Section type must exist in the `/sections` map
- Empty problems allowed during drafting

### 10. ✅ Real-time vs. Save-time Operations

**Choice:** On save. Section files are only created when the user saves the Problem Configuration form.

### 11. ✅ Curriculum Tabs Page Changes

**Choice:** No changes needed. This spec is only for selecting existing section types on the Problem Configuration page.

### 12. ✅ Section Type Key Generation

**Choice:** Not applicable (no new types created in this feature).

### 13. ✅ Teacher Guide Section Management

**Choice:** Not needed for this feature.

### 14. ✅ Error Handling for File Creation

If `saveContent` fails when creating a new section file, what should happen?

**Choice:** Abort the entire save operation on any failure and show error message.

### 15. ✅ Teacher Guide Content Path Prefix

The code uses `"teacher-guide/"` as the prefix for teacher guide section file paths.

**Verified:** The prefix `"teacher-guide/"` is correct. Evidence:
- Production content files: `src/public/demo/units/qa/teacher-guide/investigation-N/problem-M/{sectionType}/content.json`
- Left nav code: `getUnitChildrenTree(teacherGuideConfig, files, "teacher-guide/")`
- Curriculum config: `unitUrl.replace(/content\.json$/, "teacher-guide/content.json")`

Full path structure: `teacher-guide/investigation-{ordinal}/problem-{ordinal}/{sectionType}/content.json`

### 16. ✅ Unsaved Changes Warning

If the user makes changes to the problem sections and navigates away without saving, should there be a confirmation dialog?

**Choice:** No warning needed (match existing authoring behavior).

### 17. ✅ Form Reset After Save

After saving, the Firebase `files` listener updates, which triggers `problemFormDefaults` to recalculate and resets the form. Is this the intended behavior?

**Choice:** Allow form reset after save (reflects the saved state from Firebase).

### 18. ✅ Section Order Preservation on Form Reset

`buildProblemSectionsFormData` returns sections in the order they appear in `Object.keys(availableSections)`. But for an existing problem that already has sections in a specific order, shouldn't the enabled sections preserve their current order from `problem.sections`, with any new/unused section types appended after? As written, reordering would be lost on form reset.

**Choice**: Change to put the enabled sections first using the saved ordering and then save the enabled ones to the content json in their order on save.

### 19. ✅ Incremental Edit vs. Full Replacement of `container-config.tsx`

The spec's Phase 3 presents `container-config.tsx` as a full file replacement. The existing file already has type guards, `onSubmitParent`, and conditionally renders `ProblemSections`. Should the implementation be an incremental edit to the existing file rather than a wholesale replacement? The existing file may have logic or patterns that differ slightly from the spec's version.

**Choice**: Yes, it should be an incremental edit.

### 20. ✅ Race Condition Between `saveContent` and `setUnitConfig`

The spec calls `saveContent(file.path, emptyContent)` to create section files, then updates `unitConfig` via `setUnitConfig`. `saveContent` saves individual content files while `setUnitConfig` triggers a separate save of the unit's `content.json`. Is there a race condition risk where the unit config save completes before all `saveContent` calls finish? The spec does `await` each `saveContent` before calling `setUnitConfig`, so this should be fine — confirming that's intentional.

**Choice**: No race condition. All section file `saveContent` calls are awaited sequentially, then `setUnitConfig` updates local state synchronously, and a `useEffect` saves the unit config on the next render cycle — so section files are always persisted first.

### 21. ✅ Double-Submission Guard on Problem Form Only

The spec uses a `useRef(false)` guard against double-submission on the problem form but not on the parent form. Is this because the problem form does async work (`saveContent` calls) while the parent form is synchronous?

**Choice:** Yes. The existing parent form's `onSubmit` is synchronous (calls `setUnitConfig`/`setTeacherGuideConfig` which are immer state updaters that return immediately). The problem form introduces `async` work (`await saveContent(...)` for each new section file), so without the guard, double-clicking Save could create duplicate files or fire redundant API calls while a previous save is in flight.

### 22. ✅ Teacher Guide `planningDocument.sectionInfo` Shape

The spec references `teacherGuideConfig?.planningDocument?.sectionInfo` for teacher guide sections. Is this a `Record<string, ISection>` with the same shape as `unitConfig.sections`? If the types differ, the `ProblemSections` component would need to handle that.

**Verified:** Both are `Record<string, ISection>`. `planningDocument.sectionInfo` is typed at `types.ts:143` and `unitConfig.sections` at `types.ts:33` — same shape, so the `ProblemSections` component can treat them identically.

### 23. ✅ `ProblemSections` Current Props Mismatch

The existing `problem-sections.tsx` component currently accepts `UnitItemChildrenProps` (`defaultValues`, `register`, `errors`, `control` typed to `IUnitParentFormInputs`). The spec replaces these with a completely different props interface (`availableSections`, `control`, `errors` typed to `IProblemFormInputs`). This is a breaking change to the component's contract. Since the existing component is a stub (renders an empty div), is it safe to completely replace the props interface and implementation?

**Choice:** Yes, replace entirely. The existing `UnitChild` shape (`title`, `originalIndex`) cannot model section toggles (`type`, `enabled`, `existingPath`). The stub was scaffolded by copying the `UnitItemChildren` interface as a placeholder.

### 24. ✅ Existing `useMemo` Returns Only Three Properties

The existing `useMemo` in `container-config.tsx` returns `{ defaultValues, itemType, childType }`. The spec adds `problemFormDefaults` as a fourth return value, which also requires adding `_problemFormDefaults`, `availableSections`, and `files` into the memo's scope. Since the existing memo depends only on `[item]`, adding `availableSections` and `files` as dependencies means the memo will recalculate more often. Is this acceptable, or should `problemFormDefaults` be computed in a separate `useMemo`?

**Choice:** Use a separate `useMemo`. Leave the existing memo unchanged (depends on `[item]`), and compute `problemFormDefaults` in a new memo with `[item, availableSections, files]`. This avoids unnecessary recalculation of the parent form's `defaultValues` when Firebase `files` change.

### 25. ✅ Testing Checklist Item Outdated

The testing checklist says to verify `buildProblemSectionsFormData` returns sections "in `/sections` map order." This should be updated to reflect question 18's answer: enabled sections first in saved order, then disabled sections in `/sections` map order.

**Choice:** Already fixed in the Testing Checklist section.

### 26. ✅ `parseItemPath` Uses Array Index, Not Ordinal

The spec's `parseItemPath` extracts `investigationIndex` from the path segment `investigation-{n}`. This value is then used as an array index into `config.investigations[pathInfo.investigationIndex]`. Looking at the existing `getUnitItem` in `nav-path.ts`, it does the same thing — `pathParts[1]` is `investigation-{index}` where the number is the **array index**, not the ordinal. So this is consistent. However, later in `onSubmitProblem`, the code uses `item.ordinal` (from the problem object) for path generation, which is the **ordinal** (display number), not the array index. These are different values when `firstOrdinal` isn't 1 or when items have been reordered. Is this distinction handled correctly in `getProblemBasePath`?

**Verified:** Yes, handled correctly. `parseItemPath` extracts the array index for object lookup (`config.investigations[index]`), then `onSubmitProblem` reads `investigation.ordinal` and `item.ordinal` from those objects for file path generation. Section file paths use ordinals (e.g., `investigation-2/problem-1/`), confirmed by examining real unit content JSON. The two values serve different purposes and are used in the right places.

### 27. ✅ `Files` Map Uses `sectionPathPrefix` for Teacher Guide Lookups

In `nav-path.ts:getUnitChildrenTree`, the teacher guide file lookup prepends `"teacher-guide/"` to the section path before looking it up in the `files` map (`const path = sectionPathPrefix + sectionPath`). This means the `files` map keys for teacher guide sections include the `"teacher-guide/"` prefix. But in `buildProblemSectionsFormData`, the code looks up `files?.[sectionPath]` using the raw path from `problem.sections`. For teacher guide problems, `problem.sections` contains paths **without** the `"teacher-guide/"` prefix (since it's in the teacher guide's own `content.json`). Will the `files` lookup fail for teacher guide sections because of this prefix mismatch?

**Confirmed bug.** The Firebase `files` map uses a single shared map for the entire unit. Teacher guide files are stored with the `"teacher-guide/"` prefix (e.g., `files["teacher-guide/investigation-1/problem-1/launch/content.json"]`), but `problem.sections` in the teacher guide's `content.json` stores paths without it (e.g., `"investigation-1/problem-1/launch/content.json"`).

**Fix:** Add a `sectionPathPrefix` parameter (default `""`) to `buildProblemSectionsFormData`. Pass `"teacher-guide/"` when the item is a teacher guide. Use it when looking up `files` keys and when checking for existing files in `onSubmitProblem`. The same prefix is already used in `getUnitChildrenTree` and `saveContent` for teacher guide paths.

Affected code:
- `buildProblemSectionsFormData`: use `files?.[sectionPathPrefix + sectionPath]` instead of `files?.[sectionPath]`
- `onSubmitProblem`: use `files?.[sectionPathPrefix + newPath]` when checking if a file exists
- `onSubmitProblem`: use `saveContent(sectionPathPrefix + file.path, ...)` when creating new section files
- The `existingPath` stored in form items should remain the raw path (without prefix) since that's what goes into `problem.sections`

### 28. ✅ `getProblemBasePath` Teacher Guide Prefix Conflict with `sectionPathPrefix`

`getProblemBasePath` already prepends `"teacher-guide/"` to generated paths when `isTeacherGuide` is true (lines 501 and 506 in the spec). But `onSubmitProblem` also prepends `sectionPathPrefix` (`"teacher-guide/"`) when calling `saveContent`. For a **new** section on a teacher guide problem with no existing paths, the flow would be:

1. `getProblemBasePath` returns `"teacher-guide/investigation-1/problem-1"` (fallback with prefix)
2. `generateSectionPath` returns `"teacher-guide/investigation-1/problem-1/intro/content.json"`
3. This raw path goes into `newSectionPaths` (which becomes `problem.sections`)
4. `saveContent(sectionPathPrefix + file.path, ...)` would produce `"teacher-guide/teacher-guide/investigation-1/problem-1/intro/content.json"` — a double prefix

Additionally, `problem.sections` would contain `"teacher-guide/investigation-1/problem-1/intro/content.json"` — but teacher guide `problem.sections` should store paths **without** the prefix (as confirmed in question 27). So `getProblemBasePath` should NOT prepend `"teacher-guide/"` since `sectionPathPrefix` handles that at the `files` map / `saveContent` layer. The raw paths in `problem.sections` should be prefix-free.

**Fix:** Remove the `isTeacherGuide` parameter from `getProblemBasePath`. The function should always generate prefix-free paths. For teacher guides, the `sectionPathPrefix` already handles the `"teacher-guide/"` prefix at the files map lookup and `saveContent` layer. The fallback paths should use `pattern.prefix` (from existing sibling paths) or `""` (empty string) — never `"teacher-guide/"`.

### 29. ✅ Render Structure: Single Form Wraps Title and Conditional Content

The existing `container-config.tsx` renders a single `<form onSubmit={handleSubmit(onSubmit)}>` that wraps the title input, the conditional `UnitItemChildren`/`ProblemSections`, and the submit button. For problems, the title input needs to use `problemForm.register("title")` instead of the parent form's `register("title")`, and the form's `onSubmit` needs to use `problemForm.handleSubmit(onSubmitProblem)`. The spec's render update instruction says to "Change the existing `isProblem(item)` branch" but the title input and `<form>` element are **outside** that branch.

**Fix:** Use two conditional `<form>` elements. When the item is a problem, render a `<form>` bound to the problem form (`problemForm.handleSubmit`, `problemForm.register`, `problemForm.formState.errors`). Otherwise, render the existing parent form. This duplicates the title `<div>` and submit button JSX, but keeps each form cleanly bound to its own react-hook-form instance with no cross-form interference.

### 30. ✅ `onSubmitProblem` Early Return Leaves `isSubmitting` Stuck

In `onSubmitProblem`, if `if (!investigation) return;` is hit after `isSubmitting.current = true`, the ref is never reset to `false`. This would permanently block future submissions.

**Fix:** Add `isSubmitting.current = false` before the early return. Change:
```typescript
if (!investigation) return;
```
to:
```typescript
if (!investigation) {
  isSubmitting.current = false;
  return;
}
```

### 31. ✅ `availableSections` Memo Has Unstable `pathInfo` Dependency

The spec computes `pathInfo = itemPath ? parseItemPath(itemPath) : undefined` which returns a **new object** on every render. This is then used as a `useMemo` dependency for `availableSections`:

```typescript
const availableSections = useMemo(() => { ... }, [pathInfo, unitConfig, teacherGuideConfig]);
```

Since `pathInfo` is a new object reference each render, `useMemo` re-runs every time, defeating memoization. This cascades: if `availableSections` returns a new reference (e.g., `?? {}` for nullish sections), then `problemFormDefaults` also recalculates, triggering the `useEffect` form reset on every render — wiping the user's unsaved edits.

**Fix:** Memoize `pathInfo` with `useMemo` based on `itemPath`:
```typescript
const pathInfo = useMemo(
  () => itemPath ? parseItemPath(itemPath) : undefined,
  [itemPath]
);
```
`itemPath` is a string derived from the `path` prop — stable when the prop doesn't change. This makes the entire downstream chain (`availableSections` → `problemFormDefaults` → form reset effect) stable.

---

## Detailed Implementation

### Phase 1: Types and Utilities

#### 1.1 Update `container-config-types.ts`

Add new types for problem section form data:

```typescript
// src/authoring/components/workspace/container-config/container-config-types.ts

export interface UnitChild {
  title: string;
  originalIndex?: number;
}

// Represents a section in the form
export interface ProblemSectionFormItem {
  // The section type key (e.g., "introduction", "whatIf")
  type: string;
  // Whether this section is enabled for this problem
  enabled: boolean;
  // The file path if it exists (from problem.sections array)
  existingPath?: string;
}

// Form inputs for problem configuration
export interface IProblemFormInputs {
  title: string;
  sections: ProblemSectionFormItem[];
}

export interface IUnitParentFormInputs {
  title: string;
  description?: string;
  // This is used at the unit and investigation level
  firstOrdinal?: number;
  children: UnitChild[];
}
```

#### 1.2 Add path generation utilities to `nav-path.ts`

```typescript
// src/authoring/utils/nav-path.ts - ADD these functions

import { IInvestigation, IUnit } from "../types";

/**
 * Extract the section type from a section file path.
 * Example: "investigation-1/problem-1/whatIf/content.json" -> "whatIf"
 * Example: "whatIf/content.json" -> "whatIf"
 */
export const getSectionTypeFromPath = (sectionPath: string): string | undefined => {
  // Pattern: .../sectionType/content.json or sectionType/content.json
  const match = /(?:^|\/)([^/]+)\/content\.json$/.exec(sectionPath);
  return match?.[1];
};

/**
 * Infer the problem's base path from existing section paths.
 * Example: ["investigation-1/problem-1/intro/content.json"] -> "investigation-1/problem-1"
 */
export const inferProblemBasePath = (existingSectionPaths: string[]): string | undefined => {
  if (existingSectionPaths.length === 0) return undefined;

  // Take the first path and extract everything before the section type
  const firstPath = existingSectionPaths[0];
  // Pattern: basePath/sectionType/content.json
  const match = /^(.+)\/[^/]+\/content\.json$/.exec(firstPath);
  return match?.[1];
};

/**
 * Extract the path pattern from an existing problem's section paths.
 * Returns the pattern with placeholders for ordinals that can be applied to other problems.
 * Example: "investigation-1/problem-2/intro/content.json" -> { invPattern: "investigation-", probPattern: "problem-" }
 */
const extractPathPattern = (
  sectionPath: string
): { prefix: string; invPattern: string; probPattern: string } | undefined => {
  // Match patterns like "investigation-1/problem-2/..." or "sections/investigation-1/problem-2/..."
  const match = /^(.*?)(investigation-)\d+(\/problem-)\d+\//.exec(sectionPath);
  if (!match) return undefined;
  return {
    prefix: match[1],        // e.g., "" or "sections/"
    invPattern: match[2],    // "investigation-"
    probPattern: match[3],   // "/problem-"
  };
};

/**
 * Find an existing section path from any problem in the unit to infer the path convention.
 * Searches sibling problems first, then other investigations.
 */
export const findPathPatternFromUnit = (
  config: IUnit | undefined,
  currentInvestigationIndex: number
): { prefix: string; invPattern: string; probPattern: string } | undefined => {
  if (!config?.investigations) return undefined;

  // 1. Check sibling problems in the same investigation first
  const currentInvestigation = config.investigations[currentInvestigationIndex];
  if (currentInvestigation?.problems) {
    for (const problem of currentInvestigation.problems) {
      if (problem.sections?.length > 0) {
        const pattern = extractPathPattern(problem.sections[0]);
        if (pattern) return pattern;
      }
    }
  }

  // 2. Check problems in other investigations
  for (let i = 0; i < config.investigations.length; i++) {
    if (i === currentInvestigationIndex) continue;
    const inv = config.investigations[i];
    for (const problem of inv.problems || []) {
      if (problem.sections?.length > 0) {
        const pattern = extractPathPattern(problem.sections[0]);
        if (pattern) return pattern;
      }
    }
  }

  return undefined;
};

/**
 * Generate a section file path for a given section type.
 */
export const generateSectionPath = (
  problemBasePath: string,
  sectionType: string
): string => {
  return `${problemBasePath}/${sectionType}/content.json`;
};

/**
 * Get the problem base path for generating new section file paths.
 * Returns prefix-free paths — the caller handles any teacher-guide prefix
 * via sectionPathPrefix at the files map / saveContent layer.
 *
 * Priority:
 * 1. Infer from current problem's existing section paths
 * 2. Infer pattern from other problems in the unit, apply current ordinals
 * 3. Fall back to ordinal-based default: "investigation-{inv.ordinal}/problem-{prob.ordinal}"
 */
export const getProblemBasePath = (
  existingSectionPaths: string[],
  unitConfig: IUnit | undefined,
  investigation: IInvestigation,
  investigationIndex: number,
  problemOrdinal: number,
): string => {
  // 1. Try to infer from current problem's existing paths
  const inferredPath = inferProblemBasePath(existingSectionPaths);
  if (inferredPath) {
    return inferredPath;
  }

  // 2. Try to infer pattern from other problems in the unit
  const pattern = findPathPatternFromUnit(unitConfig, investigationIndex);
  if (pattern) {
    return `${pattern.prefix}${pattern.invPattern}${investigation.ordinal}${pattern.probPattern}${problemOrdinal}`;
  }

  // 3. Fall back to ordinal-based default
  return `investigation-${investigation.ordinal}/problem-${problemOrdinal}`;
};
```

### Phase 2: ProblemSections Component

#### 2.1 Implement `problem-sections.tsx`

```typescript
// src/authoring/components/workspace/container-config/problem-sections.tsx

import React from "react";
import { Control, FieldErrors, useFieldArray, useWatch } from "react-hook-form";
import { IProblemFormInputs } from "./container-config-types";
import { ISection } from "../../../types";

interface ProblemSectionsProps {
  // Available section types from unit's /sections map
  availableSections: Record<string, ISection>;
  // Form control
  control: Control<IProblemFormInputs>;
  errors: FieldErrors<IProblemFormInputs>;
}

export const ProblemSections: React.FC<ProblemSectionsProps> = ({
  availableSections,
  control,
  errors,
}) => {
  const sectionsFieldArray = useFieldArray({
    control,
    name: "sections",
  });

  // Watch the sections to get current values
  const watchedSections = useWatch({ control, name: "sections" });

  return (
    <div className="problemSections">
      <div className="sectionLabel">Problem Sections</div>
      {Object.keys(availableSections).length === 0 && (
        <div className="noSectionsMessage">
          No section types defined. Add section types on the Curriculum Tabs page.
        </div>
      )}
      <table className="problemSectionsTable">
        <thead>
          <tr>
            <th>Include</th>
            <th>Reorder</th>
            <th>Section</th>
            <th>File Path</th>
          </tr>
        </thead>
        <tbody>
          {sectionsFieldArray.fields.map((field, index) => {
            const sectionDef = availableSections[field.type];
            const isEnabled = watchedSections?.[index]?.enabled ?? false;
            const isFirst = index === 0;
            const isLast = index === sectionsFieldArray.fields.length - 1;

            return (
              <tr key={field.id} className={isEnabled ? "enabled" : "disabled"}>
                <td className="checkboxColumn">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {
                      sectionsFieldArray.update(index, {
                        ...watchedSections[index],
                        enabled: !isEnabled,
                      });
                    }}
                  />
                </td>
                <td className="reorderColumn">
                  <button
                    type="button"
                    onClick={() => {
                      if (index > 0) sectionsFieldArray.swap(index, index - 1);
                    }}
                    disabled={isFirst}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index < sectionsFieldArray.fields.length - 1) {
                        sectionsFieldArray.swap(index, index + 1);
                      }
                    }}
                    disabled={isLast}
                    style={{ marginLeft: 2 }}
                  >
                    ↓
                  </button>
                </td>
                <td className="sectionNameColumn">
                  {sectionDef?.title ?? field.type}
                  {sectionDef?.initials && (
                    <span className="initials"> ({sectionDef.initials})</span>
                  )}
                </td>
                <td className="pathColumn">
                  {field.existingPath ? (
                    <span className="existingPath">{field.existingPath}</span>
                  ) : isEnabled ? (
                    <span className="newPath">(will be created)</span>
                  ) : (
                    <span className="noPath">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {errors.sections && (
        <span className="form-error">
          {typeof errors.sections.message === "string"
            ? errors.sections.message
            : "Invalid sections configuration"}
        </span>
      )}
    </div>
  );
};
```

### Phase 3: Integration with ContainerConfig

#### 3.1 Update `container-config.tsx` (incremental edits)

The existing file already has the component structure, type guards (`isUnit`, `isInvestigation`, `isProblem`), the `onSubmit` handler for parent items, and conditional rendering of `ProblemSections`. The following changes are needed:

**Add imports:**

```typescript
// Add to existing imports
import { useRef } from "react";
import { ISection } from "../../../types";
import {
  getProblemBasePath,
  generateSectionPath,
  getSectionTypeFromPath,
} from "../../../utils/nav-path";
import { IProblemFormInputs, ProblemSectionFormItem } from "./container-config-types";
```

**Add helper functions** (before the component):

```typescript
// Build form data for problem sections
// Returns enabled sections first (in their saved order from problem.sections),
// then disabled sections (in the order they appear in availableSections).
// This preserves the author's reordering across saves and form resets.
// sectionPathPrefix: "" for regular sections, "teacher-guide/" for teacher guide sections.
// The files map keys include this prefix, but problem.sections stores paths without it.
function buildProblemSectionsFormData(
  problem: IProblem,
  availableSections: Record<string, ISection>,
  files: Record<string, { type?: string }> | undefined,
  sectionPathPrefix = ""
): ProblemSectionFormItem[] {
  // Build a map of existing section paths by type
  const existingPathsByType = new Map<string, string>();
  problem.sections.forEach((sectionPath) => {
    // files map keys include the prefix, but problem.sections does not
    const file = files?.[sectionPathPrefix + sectionPath];
    const sectionType = file?.type ?? getSectionTypeFromPath(sectionPath);
    if (sectionType) {
      existingPathsByType.set(sectionType, sectionPath);
    }
  });

  const enabledTypes = new Set(existingPathsByType.keys());

  // 1. Enabled sections first, in their saved order (from problem.sections)
  const enabledItems: ProblemSectionFormItem[] = [];
  problem.sections.forEach((sectionPath) => {
    const file = files?.[sectionPathPrefix + sectionPath];
    const sectionType = file?.type ?? getSectionTypeFromPath(sectionPath);
    if (sectionType && availableSections[sectionType]) {
      enabledItems.push({
        type: sectionType,
        enabled: true,
        existingPath: sectionPath,  // Raw path without prefix (goes into problem.sections)
      });
    }
  });

  // 2. Disabled sections after, in the order they appear in availableSections
  const disabledItems: ProblemSectionFormItem[] = Object.keys(availableSections)
    .filter((sectionType) => !enabledTypes.has(sectionType))
    .map((sectionType) => ({
      type: sectionType,
      enabled: false,
    }));

  return [...enabledItems, ...disabledItems];
}

// Extract investigation index from path
// Paths are: "investigations/investigation-{n}/problem-{m}" or "teacher-guides/investigation-{n}/problem-{m}"
function parseItemPath(itemPath: string): {
  investigationIndex: number;
  isTeacherGuide: boolean;
} | undefined {
  const parts = itemPath.split("/");
  const isTeacherGuide = parts[0] === "teacher-guides";

  // Both path formats have investigation at parts[1]
  const invMatch = /^investigation-(\d+)$/.exec(parts[1] || "");
  if (!invMatch) return undefined;

  return {
    investigationIndex: parseInt(invMatch[1], 10),
    isTeacherGuide,
  };
}
```

**Add to `useCurriculum()` destructuring:** `files` and `saveContent`

**Add inside the component** (new state/hooks):

```typescript
// Guard against rapid double-submissions (needed because problem save is async)
const isSubmitting = useRef(false);

const pathInfo = useMemo(
  () => itemPath ? parseItemPath(itemPath) : undefined,
  [itemPath]
);

// Get available sections based on whether this is a teacher guide or not
const availableSections = useMemo(() => {
  if (!pathInfo) return {};
  if (pathInfo.isTeacherGuide) {
    return teacherGuideConfig?.planningDocument?.sectionInfo ?? {};
  }
  return unitConfig?.sections ?? {};
}, [pathInfo, unitConfig, teacherGuideConfig]);
```

**Add a separate `useMemo` for problem form defaults** (leave the existing `useMemo` unchanged):

```typescript
// Prefix for files map lookups and saveContent paths.
// The files map is shared across the unit; teacher guide files are keyed with "teacher-guide/" prefix.
const sectionPathPrefix = pathInfo?.isTeacherGuide ? "teacher-guide/" : "";

// Separate memo for problem-specific form defaults.
// Depends on files and availableSections, which change more often than item.
const problemFormDefaults = useMemo(() => {
  if (!item || !isProblem(item)) return undefined;
  return {
    title: item.title,
    sections: buildProblemSectionsFormData(item, availableSections, files, sectionPathPrefix),
  };
}, [item, availableSections, files, sectionPathPrefix]);
```

**Add a separate problem form** with validation resolver, and a problem submit handler:

```typescript
// Memoized resolver for problem form validation
const problemFormResolver = useMemo(() => {
  return (values: IProblemFormInputs) => {
    const errors: Record<string, any> = {};
    const enabledTypes = values.sections.filter(s => s.enabled).map(s => s.type);

    const duplicates = enabledTypes.filter(
      (type, index) => enabledTypes.indexOf(type) !== index
    );
    if (duplicates.length > 0) {
      errors.sections = { message: `Duplicate section types: ${duplicates.join(", ")}` };
    }

    const invalidTypes = enabledTypes.filter(type => !availableSections[type]);
    if (invalidTypes.length > 0) {
      errors.sections = { message: `Unknown section types: ${invalidTypes.join(", ")}` };
    }

    return {
      values: Object.keys(errors).length === 0 ? values : {},
      errors,
    };
  };
}, [availableSections]);

const problemForm = useForm<IProblemFormInputs>({
  defaultValues: problemFormDefaults,
  mode: "onChange",
  resolver: problemFormResolver,
});

// Reset problem form when defaults change
useEffect(() => {
  if (problemFormDefaults) {
    problemForm.reset(problemFormDefaults);
  }
}, [problemForm.reset, problemFormDefaults]);

// Handler for problem items
const onSubmitProblem: SubmitHandler<IProblemFormInputs> = async (data) => {
  if (!itemPath || !pathInfo || !item || !isProblem(item)) return;
  if (isSubmitting.current) return;
  isSubmitting.current = true;

  const itemPathParts = itemPath.split("/");
  const config = pathInfo.isTeacherGuide ? teacherGuideConfig : unitConfig;
  const investigation = config?.investigations?.[pathInfo.investigationIndex];
  if (!investigation) {
    isSubmitting.current = false;
    return;
  }

  const enabledSections = data.sections.filter(s => s.enabled);
  const existingPaths = enabledSections.filter(s => s.existingPath).map(s => s.existingPath!);
  const problemBasePath = getProblemBasePath(
    existingPaths, config, investigation,
    pathInfo.investigationIndex, item.ordinal
  );

  const newSectionPaths: string[] = [];
  const filesToCreate: { path: string; sectionType: string }[] = [];

  for (const section of enabledSections) {
    if (section.existingPath) {
      newSectionPaths.push(section.existingPath);
    } else {
      // newPath is the raw path (without prefix) — goes into problem.sections
      const newPath = generateSectionPath(problemBasePath, section.type);
      newSectionPaths.push(newPath);
      // files map keys include the prefix, so use it for lookup
      if (!files?.[sectionPathPrefix + newPath]) {
        filesToCreate.push({ path: newPath, sectionType: section.type });
      }
    }
  }

  try {
    for (const file of filesToCreate) {
      // saveContent needs the prefixed path so the API stores it correctly in the files map
      await saveContent(sectionPathPrefix + file.path, { type: file.sectionType, tiles: [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create section file:", message);
    problemForm.setError("sections", {
      message: "Failed to create section file. Please try again."
    });
    isSubmitting.current = false;
    return;
  }

  const updateUnitDraft = (draft: WritableDraft<IUnit> | undefined) => {
    if (!draft) return;
    const currentItem = getUnitItem(draft, itemPathParts);
    if (!currentItem || !isProblem(currentItem)) return;
    currentItem.title = data.title;
    currentItem.sections = newSectionPaths;
  };

  if (pathInfo.isTeacherGuide) {
    setTeacherGuideConfig(updateUnitDraft);
  } else {
    setUnitConfig(updateUnitDraft);
  }
  isSubmitting.current = false;
};
```

**Update the render:** Replace the single `<form>` with two conditional forms. When `isProblem(item)` is true, render a `<form>` using `problemForm.handleSubmit(onSubmitProblem)`, with the title input bound to `problemForm.register("title")`, errors from `problemForm.formState.errors`, and `ProblemSections` receiving `availableSections`, `problemForm.control`, and `problemForm.formState.errors`. When `isProblem(item)` is false, render the existing parent `<form>` unchanged. Both forms include their own title `<div>` and submit button. Example structure:

```typescript
  if (isProblem(item)) {
    return (
      <form onSubmit={problemForm.handleSubmit(onSubmitProblem)}>
        <div>
          <label htmlFor="title">{itemType} Title</label>
          <input
            type="text"
            id="title"
            defaultValue={problemFormDefaults?.title}
            {...problemForm.register("title", { required: "Title is required" })}
          />
          {problemForm.formState.errors.title && (
            <span className="form-error">{problemForm.formState.errors.title.message}</span>
          )}
        </div>
        <ProblemSections
          availableSections={availableSections}
          control={problemForm.control}
          errors={problemForm.formState.errors}
        />
        <div className="bottomButtons">
          <button type="submit" disabled={saveState === "saving"}>Save</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ... existing parent form unchanged ... */}
    </form>
  );
```

### Phase 4: Styles

#### 4.1 Add styles to `workspace.scss`

```scss
// src/authoring/components/workspace.scss - ADD to existing .config section

.problemSectionsTable {
  width: 100%;
  table-layout: auto;
  margin-top: 10px;

  th {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid #ccc;
  }

  td {
    padding: 4px 8px;
    text-align: left;
    vertical-align: middle;
  }

  tr.disabled {
    opacity: 0.6;
  }

  tr.enabled {
    background-color: #f0f8ff;
  }

  .checkboxColumn {
    width: 60px;
    text-align: center;
  }

  .reorderColumn {
    width: 70px;
    white-space: nowrap;
  }

  .sectionNameColumn {
    font-weight: 500;

    .initials {
      font-weight: normal;
      color: #666;
    }
  }

  .pathColumn {
    font-family: monospace;
    font-size: 0.85em;
    color: #666;

    .newPath {
      font-style: italic;
      color: #090;
    }

    .noPath {
      color: #999;
    }
  }
}
```

---

## Testing Checklist

### Unit Tests
- [ ] `getSectionTypeFromPath` correctly extracts section type from various path formats
- [ ] `inferProblemBasePath` handles empty arrays and various path formats
- [ ] `generateSectionPath` creates correct paths
- [ ] `buildProblemSectionsFormData` returns enabled sections first (in saved order), then disabled sections (in `/sections` map order)
- [ ] `findPathPatternFromUnit` finds patterns from sibling problems
- [ ] `findPathPatternFromUnit` finds patterns from other investigations
- [ ] `getProblemBasePath` uses ordinals for fallback paths
- [ ] `parseItemPath` correctly parses both regular and teacher-guide paths
- [ ] Section types with special characters are handled (or validated against)

### Integration Tests
- [ ] Enabling a section adds it to the problem
- [ ] Disabling a section removes it from the problem (but not the file)
- [ ] Reordering sections updates the order in problem.sections
- [ ] New section files are created with correct content (type set to section type key)
- [ ] New section files appear in the `files` map (via `/putContent` API)
- [ ] Existing orphaned files are reused when re-enabling a section
- [ ] New problem inherits path convention from existing problems in unit
- [ ] Teacher Guide sections use `planningDocument.sectionInfo`
- [ ] Validation prevents duplicate section types
- [ ] Validation prevents unknown section types
- [ ] Partial file creation failure shows error and doesn't update unit config

### Manual Testing
- [ ] UI shows checkboxes and reorder buttons correctly
- [ ] Toggling checkbox does not change item position in list
- [ ] Disabled sections appear grayed out
- [ ] File paths display correctly (existing vs. "will be created")
- [ ] Save button is disabled while saving
- [ ] Changes persist after page refresh

---

## Error States

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Failed to create section file. Please try again." | Network error or server issue during file creation | Retry the save; check network connection |
| "Duplicate section types: X, Y" | Same section type enabled multiple times (bug in UI logic) | Report bug; should not occur in normal use |
| "Unknown section types: X" | Section type not defined in unit's `/sections` map | Add the section type on Curriculum Tabs page first |
