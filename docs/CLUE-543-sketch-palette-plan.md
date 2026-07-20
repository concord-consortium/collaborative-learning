# CLUE-543: Add colors to the Sketch palette to match Dataflow & Diagram/variable chips

> Plan doc for discussion (incl. UI designer) before implementation. Implementation not started.

## Context

Students annotate/sketch alongside Dataflow programs and Diagram/variable chips, but the Sketch
(Drawing) tile only offers 8–10 saturated primary colors that don't match the colors used by
Dataflow blocks or variable chips. That makes it hard for students (and AI) to refer to work using a
shared color vocabulary ("the blue block", "the yellow chip"). This ticket expands the Sketch tile's
color palette to a **superset** that includes the Dataflow block colors and the Diagram/variable-chip
colors, so a student can pick the exact color of a block or chip.

## Decisions (confirmed)

- **Scope: Sketch only.** Do **not** change how Dataflow blocks or variable chips render — just expand
  the Sketch palette to offer matching colors. (Variable chips live in the external
  `@concord-consortium/diagram-view` package; leaving them untouched keeps this in-repo and low-risk.)
- **Full union** for the Sketch **fill** palette: keep every existing Sketch fill color **and** add the
  sync colors; intentional near-duplicates are acceptable (nothing removed).
- **Pastels in fill only.** All sync colors (dataflow + chip) are light pastels; they go into the
  **fill** palette only. The **stroke/line** palette stays the existing saturated set for legibility.
- Include the **3 Dataflow category colors** (input/operator/output). The per-node-type greens/oranges
  in `dataflow-vars.scss` are **legacy/unused** — verified: `dataflow-node.scss` references the
  category vars 50×, the per-node vars 0×.

## Color facts (verified)

**Sketch** — `src/plugins/drawing/components/color-swatch.tsx` (`SwatchColor` enum; hex stored on objects):
`none`, `black #000000`, `white #ffffff`, `red #eb0000`, `green #008a00`, `blue #0000ff`,
`gray #bfbfbf`, `orange #ff8415`, `yellow #ffff00`, `purple #d100d1`.

**Dataflow** blocks (3 category families actually rendered) —
`src/plugins/dataflow/components/dataflow-vars.scss:19,25,31`:
`$input-blue #a5b2ff`, `$operator-green #4ad0ee` (actually **teal**), `$output-yellow #f7e58f`.

**Diagram + variable chips** (same 6-color palette) —
`@concord-consortium/diagram-view/.../utils/theme-utils.js`:
`blue #addef4`, `green #b7e690`, `yellow #f7e58f`, `red #ffc7bf`, `gray #d4d4d4`, `light-gray #e6e6e6`.

Overlap: dataflow output-yellow `#f7e58f` is **identical** to chip yellow. The only real cross-mismatch
is blue (dataflow `#a5b2ff` vs chip `#addef4`) — under "Sketch only" we simply offer both.

## Superset to add to the FILL palette

8 new swatches (exact-hex dedup: `#f7e58f` appears once). Proposed enum keys — **names are a good topic
for the UI designer**:

| key (proposed) | hex | source |
|---|---|---|
| `periwinkle` | `#a5b2ff` | dataflow input |
| `teal` | `#4ad0ee` | dataflow operator |
| `paleYellow` | `#f7e58f` | dataflow output **==** chip yellow |
| `skyBlue` | `#addef4` | chip blue |
| `paleGreen` | `#b7e690` | chip green |
| `paleRed` | `#ffc7bf` | chip red |
| `silver` | `#d4d4d4` | chip gray |
| `paleGray` | `#e6e6e6` | chip light-gray |

Result: fill palette grows 10 → **18** swatches; stroke palette unchanged (8).

## Implementation

1. **`src/plugins/drawing/components/color-swatch.tsx`** — add the 8 keys to the `SwatchColor` enum.
   Each value is a unique hex (no duplicate values within a palette → avoids duplicate React `key` /
   double-highlight). `ColorSwatch` needs no change: it renders any color as an SVG circle and already
   applies a contrast border for light colors via `isLightColorRequiringContrastOffset`
   (`src/utilities/color-utils.ts`), which the new pastels trigger automatically.
2. **`src/plugins/drawing/components/fill-color-palette.tsx`** — append the 8 new entries to `kColors`
   (keep existing entries; group the sync colors after the existing ones for a readable grid).
3. **`src/plugins/drawing/components/stroke-color-palette.tsx`** — **unchanged** (pastels are fill-only).
4. **`src/plugins/drawing/drawing-toolbar.scss`** — widen `.toolbar-palette.fill-color` (currently
   ~159px) so 18 swatches wrap into a tidy grid; `.palette-buttons` already uses
   `display:flex; flex-wrap:wrap`. Stroke palette width untouched.

No model/migration changes: `stroke`/`fill` are `types.string` storing hex, so existing drawings are
unaffected and additions are purely additive.

## Verification

1. `npm start`; add a Drawing/Sketch tile. Open the **Fill** palette → confirm the 8 new swatches
   appear as a clean grid and light pastels show the contrast ring. Open the **Stroke** palette →
   confirm it is unchanged.
2. Draw a filled shape, pick a chip/block color (e.g. `#addef4`), reopen the fill palette → the chosen
   swatch shows the selected check (confirms stored hex matches a palette entry).
3. Put a variable chip / dataflow block next to the sketch → visually confirm the fill matches.
4. `npm run check:types` + `npm run lint`. Optionally add a small Jest test asserting the fill palette
   contains the new colors and has no duplicate hex values (there are currently no drawing color-palette
   tests).

## Open question for the UI designer

- Swatch **names** (see table) and **ordering/grouping** in the fill grid.
- **Line colors:** the pastels are fill-only by decision. If we also want the *stroke* palette to match
  blocks, we'd add the 3 saturated dataflow **outline** colors (`#394aff` input, `#0271c1` operator,
  `#c66c02` output), which are legible as lines. Currently out of scope.
