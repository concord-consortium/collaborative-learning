# Text Tile Heading Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a heading (H2) toggle button to the text tile toolbar, registered with the common toolbar framework so any unit can include it.

**Architecture:** The `@concord-consortium/slate-editor` already renders `heading2` blocks as `<h2>`. We add a `HeadingToolbarButton` component to `text-toolbar-registration.tsx` following the exact same pattern as `NumberedListToolbarButton` — `toggleElement` + `EFormat.heading2`, registered as `'heading'`. No changes to the renderer, content model, or Firebase sync pipeline are needed.

**Tech Stack:** React 17, TypeScript 4.9, `@concord-consortium/slate-editor` ^0.10.1, MobX State Tree, Jest + Testing Library

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/assets/icons/text/heading-text-icon.svg` | Heading toolbar icon (H glyph) |
| Modify | `src/components/tiles/text/toolbar/text-toolbar-registration.tsx` | Add `HeadingToolbarButton` component + registration |
| Modify | `src/components/tiles/text/spec-text-tile.tsx` | Add `'heading'` to test tools list |
| Modify | `src/components/tiles/text/text-tile.test.tsx` | Update button count + add heading button test |
| Modify | `docs/unit-configuration.md` | Document `'heading'` as available text button |
| Modify | `src/public/demo/units/qa/content.json` | Add text tools config for manual QA testing |

---

### Task 1: Add the icon asset

**Files:**
- Create: `src/assets/icons/text/heading-text-icon.svg`

- [ ] **Step 1: Copy icon from Downloads**

```bash
cp ~/Downloads/heading-1-text-icon.svg \
   src/assets/icons/text/heading-text-icon.svg
```

- [ ] **Step 2: Verify the file exists**

```bash
ls src/assets/icons/text/heading-text-icon.svg
```

Expected: file path printed with no error.

- [ ] **Step 3: Commit**

```bash
git add src/assets/icons/text/heading-text-icon.svg
git commit -m "feat(text-tile): add heading toolbar icon"
```

---

### Task 2: Write failing tests for the heading button

**Files:**
- Modify: `src/components/tiles/text/spec-text-tile.tsx:26-35`
- Modify: `src/components/tiles/text/text-tile.test.tsx`

- [ ] **Step 1: Add `'heading'` to the test tools list in `spec-text-tile.tsx`**

In `src/components/tiles/text/spec-text-tile.tsx`, update the `"tools"` array (lines 26–35) to include `"heading"` between `"subscript"` and `"superscript"`:

```typescript
      "tools": [
        "bold",
        "italic",
        "underline",
        "subscript",
        "heading",
        "superscript",
        "list-ol",
        "list-ul",
        "link"
      ]
```

- [ ] **Step 2: Update the button count test and add a heading-specific test in `text-tile.test.tsx`**

Replace the existing `"renders its toolbar"` test and add a new test (the existing file already imports `screen` and `userEvent`):

```typescript
  it("renders its toolbar", () => {
    specTextTile({});
    userEvent.click(screen.getByTestId("ccrte-editor"));
    expect(screen.getAllByRole("button")).toHaveLength(9);
  });

  it("renders a heading button in the toolbar", () => {
    specTextTile({});
    userEvent.click(screen.getByTestId("ccrte-editor"));
    expect(screen.getByRole("button", { name: "Heading" })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- src/components/tiles/text/text-tile.test.tsx --no-coverage
```

Expected output: two failures:
- `Expected: 9 / Received: 8` (button count)
- `Unable to find an accessible element with the role "button" and name "Heading"`

---

### Task 3: Implement `HeadingToolbarButton`

**Files:**
- Modify: `src/components/tiles/text/toolbar/text-toolbar-registration.tsx`

- [ ] **Step 1: Add the icon import**

After line 18 (the last icon import), add:

```typescript
import HeadingToolIcon from "../../../../assets/icons/text/heading-text-icon.svg";
```

- [ ] **Step 2: Add the `HeadingToolbarButton` component**

After the closing brace of `SuperscriptToolbarButton` (after line 82), add:

```typescript
function HeadingToolbarButton({name}: IToolbarButtonComponentProps) {
  return <GenericTextToolbarButton
    name={name} title="Heading" Icon={HeadingToolIcon}
    slateType={EFormat.heading2} toggleFunc={toggleElement}/>;
}
```

> **Note on `EFormat.heading2`:** If TypeScript reports `Property 'heading2' does not exist on type 'typeof EFormat'`, replace `EFormat.heading2` with the string literal `"heading2"` (which matches `slate-renderers.tsx:35` and is what the Slate editor uses internally).

- [ ] **Step 3: Register the button**

In the `registerTileToolbarButtons('text', [...])` call (starts at line 96), add the `heading` entry after `subscript` and before `superscript`:

```typescript
  {
    name: 'subscript',
    component: SubscriptToolbarButton,
  },
  {
    name: 'heading',
    component: HeadingToolbarButton,
  },
  {
    name: 'superscript',
    component: SuperscriptToolbarButton,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/tiles/text/text-tile.test.tsx --no-coverage
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run TypeScript check**

```bash
npm run check:types
```

Expected: no errors. If you see `Property 'heading2' does not exist`, apply the string literal fallback from Step 2.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiles/text/toolbar/text-toolbar-registration.tsx \
        src/components/tiles/text/spec-text-tile.tsx \
        src/components/tiles/text/text-tile.test.tsx
git commit -m "feat(text-tile): add heading toolbar button (CLUE-475)"
```

---

### Task 4: Update unit-configuration docs

**Files:**
- Modify: `docs/unit-configuration.md:337-344`

- [ ] **Step 1: Add `'heading'` to the Text section**

In `docs/unit-configuration.md`, find the Text tile section (around line 328). After the `edit-variable` bullet and before the next tile section (`#### Wave Runner`), add:

```markdown
Additionally, the following button is supported and can be added to the toolbar:

- `heading`: applies heading (H2) block formatting to the current block; toggles back to paragraph when pressed again
```

The full updated Text section should read:

```markdown
#### Text

Common toolbar framework; default buttons:

- `bold`
- `italic`
- `underline`
- `subscript`
- `superscript`
- `list-ol`
- `list-ul`
- `link`

Additionally these buttons are supported and can be added to the toolbar if the configuration makes use of shared variables:

- `new-variable`
- `insert-variable`
- `edit-variable`

Additionally, the following button is supported and can be added to the toolbar:

- `heading`: applies heading (H2) block formatting to the current block; toggles back to paragraph when pressed again
```

- [ ] **Step 2: Commit**

```bash
git add docs/unit-configuration.md
git commit -m "docs: document 'heading' as available text tile toolbar button"
```

---

### Task 5: Add heading to QA unit for manual testing

**Files:**
- Modify: `src/public/demo/units/qa/content.json`

- [ ] **Step 1: Add text tools config to QA unit**

In `src/public/demo/units/qa/content.json`, find the `"settings"` object inside `"config"` (around line 16). Add a `"text"` entry alongside the existing `"table"`, `"datacard"`, `"diagram"`, `"graph"` entries:

```json
      "text": {
        "tools": ["bold", "italic", "underline", "subscript", "heading", "superscript", "list-ol", "list-ul", "link"]
      },
```

- [ ] **Step 2: Run the full text tile test suite**

```bash
npm test -- src/components/tiles/text --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/public/demo/units/qa/content.json
git commit -m "chore(qa): add text tile tools config with heading button for QA testing"
```

---

## Verification Checklist

Manual verification after implementation:

1. `npm start` → navigate to QA unit (`?appMode=dev&unit=qa&problem=0.1`) → click a text tile → heading button (H icon) appears after subscript in the toolbar
2. Place cursor in a paragraph line → click heading button → text renders visibly larger as `<h2>`, button shows active (highlighted/blue)
3. Click heading button again → text reverts to normal paragraph size, button deselects
4. Select text spanning multiple lines → click heading → only the block containing the cursor becomes a heading (Slate block behavior)
5. Open the same document in two browser tabs → apply heading in tab 1 → heading appears in tab 2 within ~1 second (collaborative sync)
6. Reload the page → heading formatting is preserved (persistence)
7. `npm run check:types` → zero TypeScript errors
