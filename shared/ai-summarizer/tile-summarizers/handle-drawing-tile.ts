import { TileHandlerParams } from "../ai-summarizer-types";
import { drawingToTable } from "./drawing-to-table";

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the
// drawing, which can be used in contexts where it is possible to import React libraries. That one
// names nothing: each object's id is passed to the renderer as a React key and never reaches the
// markup, so the path it serves cannot be cited object by object the way this one can.
export function handleDrawingTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  return drawingToTable(tile.model.content);
}
