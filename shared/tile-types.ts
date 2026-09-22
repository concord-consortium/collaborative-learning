/**
 * The authoritative list of tile types CLUE registers.
 *
 * This module deliberately has no imports: it is loaded by the browser app, by node scripts and by
 * the evaluation harness (scripts/ai-harness), none of which should have to drag in the client-side
 * loading utilities that `src/register-tile-types.ts` uses.
 *
 * The first 20 entries mirror the keys of `gTileRegistration` in `src/register-tile-types.ts`, in the
 * same order. `Placeholder` and `Unknown` are registered statically by that file's top-level imports
 * rather than through `gTileRegistration`, so they are listed last.
 *
 * A test in scripts/ai-harness (test/tile-types.test.ts) parses `src/register-tile-types.ts` and fails
 * if the two lists drift apart, so a newly registered tile type has to be added here as well.
 */
export const tileTypes = [
  "Question",
  "AI",
  "BarGraph",
  "DataCard",
  "Dataflow",
  "Diagram",
  "Drawing",
  "ErrorTest",
  "Expression",
  "Geometry",
  "Graph",
  "Image",
  "IframeInteractive",
  "Numberline",
  "Simulator",
  "Starter",
  "Table",
  "Text",
  "Timeline",
  "WaveRunner",
  "Placeholder",
  "Unknown"
] as const;

export type TileType = typeof tileTypes[number];
