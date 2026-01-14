import { TileHandlerParams } from "../ai-summarizer-types";

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the drawing,
// which can be used in contexts where it is possible to import React libraries.
export function handleDrawingTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  return "This tile contains a drawing.";
}
