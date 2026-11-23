import { AnnotationDescriberParams, TileHandlerParams } from "../ai-summarizer-types";
import { drawingToTable } from "./drawing-to-table";

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the
// drawing, which can be used in contexts where it is possible to import React libraries. That one
// names nothing: each object's id is passed to the renderer as a React key and never reaches the
// markup, so the path it serves cannot be cited object by object the way this one can.
export function handleDrawingTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  try {
    return drawingToTable(tile.model.content);
  } catch (error) {
    // Whatever is wrong with this drawing, it must cost the reader this tile and no more. Nothing
    // guards the handler loop in tileSummary, so anything thrown here propagates all the way out of
    // documentSummarizer and the whole document's summary is lost — every other tile with it. The
    // shapes a stored drawing can take are not worth enumerating; failing to one sentence is.
    console.error("Error summarizing drawing tile:", error, tile);
    return "This tile contains a malformed drawing.";
  }
}

/**
 * The id is part of the phrase on purpose: drawing-to-table.ts prints an `id` column for every
 * shape, so a reader can take the id from a sparrow straight to the row describing the shape.
 */
export function describeDrawingObject(
  { tile, objectId, objectType }: AnnotationDescriberParams
): string | undefined {
  const objects: any[] = tile?.content?.objects ?? [];
  const object = objects.find(candidate => candidate?.id === objectId);
  if (!object) { return undefined; }
  const kind = object.type ?? objectType ?? "object";
  const text = typeof object.text === "string" && object.text.trim() ? ` reading "${object.text}"` : "";
  return `${kind} ${objectId}${text}`;
}
