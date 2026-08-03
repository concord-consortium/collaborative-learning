# CLUE-543: Synchronize Sketch, Dataflow, and chip colors

> Revised plan (v3). Supersedes the "Sketch-only superset" v1: we now also recolor the Dataflow
> operator block so Sketch fills, Dataflow blocks, and Diagram/variable chips share one pastel vocabulary.

## Goal

Students annotate/sketch alongside Dataflow programs and Diagram/variable chips. Give them a shared color
vocabulary ("the blue block", "the light-yellow chip") by:

1. Restructuring the Sketch **fill** palette into two rows: bold colors on top, a matching row of pastels
   below that share the Dataflow block and chip colors.
2. Recoloring the Dataflow **operator** block to blue so it matches the chip blue and the new Sketch swatch.
   (Input and output blocks already use the target pastels.)

## Confirmed direction

### Sketch fill palette — two rows

- **Top row (8), bold, ending with yellow:**
  `none, black, red, green, blue, pink, orange, yellow`
  - `pink` is the existing `purple` swatch `#d100d1` (relabeled).
  - The saturated `gray #bfbfbf` is **removed** from the fill palette (it stays in the stroke palette).
- **Bottom row (7), white then 6 sync pastels:**

  | key (proposed) | hex | synced to |
  |---|---|---|
  | `white` | `#ffffff` | (existing white, moved here) |
  | `paleGray` | `#d4d4d4` | chip gray |
  | `lightOrange` | `#ffc7bf` | chip "red" (warm pastel) |
  | `lightGreen` | `#b7e690` | chip green |
  | `lightBlue` | `#addef4` | chip blue **+ Dataflow operator (new)** |
  | `lightPurple` | `#a5b2ff` | Dataflow input block |
  | `lightYellow` | `#f7e58f` | chip yellow **+ Dataflow output** |

- **Stroke/line palette: unchanged** (stays the saturated set for legibility). Pastels are fill-only.

### Dataflow block colors

Categories are **input = purple, operator = blue, output = yellow**. The existing SCSS var names
(`$input-blue`, `$operator-green`) are wrong and will be renamed.

| category | hex | current var | change |
|---|---|---|---|
| input | `#a5b2ff` (purple) | `$input-blue` | value unchanged; rename → `$input-purple` |
| operator | `#addef4` (blue) | `$operator-green` = `#4ad0ee` (teal) | **change value** to `#addef4`; rename → `$operator-blue` |
| output | `#f7e58f` (yellow) | `$output-yellow` | unchanged |

Chips are untouched — they live in the external `@concord-consortium/diagram-view` package and already use
these colors; we only bring Sketch and the Dataflow operator into alignment.

## Color facts (verified)

- **Sketch** — `src/plugins/drawing/components/color-swatch.tsx` `SwatchColor` enum (hex stored on objects);
  fill order in `fill-color-palette.tsx` `kColors`; stroke order in `stroke-color-palette.tsx`. Current
  enum: `none, black #000000, white #ffffff, red #eb0000, green #008a00, blue #0000ff, gray #bfbfbf,
  orange #ff8415, yellow #ffff00, purple #d100d1`.
- **Dataflow** — `src/plugins/dataflow/components/dataflow-vars.scss`: `$input-blue #a5b2ff`,
  `$operator-green #4ad0ee` (teal), `$output-yellow #f7e58f`; each has `-outline` and `-lighter-1/2/3`
  shades (output also `-element`). Consumed by `nodes/dataflow-node.scss` (node bodies/states),
  `components/ui/dataflow-program-toolbar.scss` (block-palette buttons), `nodes/controls/dropdown-list-control.scss`.
- **Chips** — `@concord-consortium/diagram-view/.../theme-utils.js`: blue `#addef4`, green `#b7e690`,
  yellow `#f7e58f`, red `#ffc7bf`, gray `#d4d4d4`, light-gray `#e6e6e6` (light-gray intentionally dropped).

## Implementation

### Sketch
1. **`color-swatch.tsx`** — add 6 enum keys: `paleGray #d4d4d4`, `lightOrange #ffc7bf`, `lightGreen #b7e690`,
   `lightBlue #addef4`, `lightPurple #a5b2ff`, `lightYellow #f7e58f`. (Values must stay unique so there is no
   duplicate React key / double-highlight. `#bfbfbf` keeps its `gray` key for the stroke palette.) `ColorSwatch`
   needs no change; it draws any hex and adds a contrast ring for light colors via
   `isLightColorRequiringContrastOffset` (`utilities/color-utils.ts`).
2. **`fill-color-palette.tsx`** — rewrite `kColors` to the two-row sequence above (drops `gray #bfbfbf`).
3. **`stroke-color-palette.tsx`** — unchanged.
4. **`drawing-toolbar.scss`** — size `.toolbar-palette.fill-color` so the grid breaks into two rows (top row
   of 8 ending at yellow; bottom row of 7 starting at white). `.palette-buttons` already `flex-wrap: wrap`;
   tune the width to 8 swatches per row, or render two explicit rows.

No model/migration work: `stroke`/`fill` are `types.string` hex, so existing drawings are unaffected.

### Dataflow
5. **`dataflow-vars.scss`** — recolor the operator family (`.node.math/.logic/.transform/.control`) using the
   designer's exact values (the node body is one flat blue across all states; only the inset fields differ):

   | var (renamed) | hex | used for |
   |---|---|---|
   | `$operator-blue` (was `$operator-green` `#4ad0ee`) | `#addef4` | node body background (all states) |
   | `$operator-blue-lighter-1` | `#c1e6f6` | name field bg (`.node-name input`) |
   | `$operator-blue-lighter-2` | `#d6eef9` | name field border (+ other light inset borders) |
   | `$operator-blue-lighter-3` | `#ebf7fd` | expression/value bg (`.value-container`, `.node-graph`) |
   | `$operator-blue-outline` | keep `#0271c1` | node border / icons (a blue that still harmonizes) |

   Also rename `$input-blue → $input-purple` (value `#a5b2ff` unchanged). Update references in
   `dataflow-node.scss`, `dataflow-program-toolbar.scss`, `dropdown-list-control.scss`.

## Verification

1. `npm start`; add a Sketch tile → **Fill** palette shows two rows (top: none…yellow; bottom: white +
   6 pastels) with contrast rings on the pastels. **Stroke** palette unchanged.
2. Add a Dataflow tile → operator blocks render blue (`#addef4`); input purple, output yellow. Place a
   Sketch fill, a Dataflow block, and a variable chip side by side → matching colors.
3. Fill a shape with a pastel, reopen the palette → the chosen swatch shows the selected check (stored hex
   matches a palette entry).
4. `npm run check:types` + `npm run lint`. Add a small Jest test: fill palette contains the new hexes and
   has no duplicate values.

## Open items to confirm

- **`lightOrange` hex** — using `#ffc7bf` (the chip's warm pastel, a salmon/peach). If a truer orange is
  wanted it would be a new hex outside the chip set.
- **Naming** — enum keys for the new pastels (`paleGray`, `lightOrange`, …). The existing `purple`
  (`#d100d1`) keeps its key; "pink" is just its display name in the top row.
