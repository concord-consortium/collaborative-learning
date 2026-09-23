/**
 * A curriculum-only alternative to the default drawing handler (drawing-to-table.ts): text object
 * contents and image filenames, and nothing else -- no ids, coordinates, colors, or shape geometry.
 *
 * A drawing used as a labeled diagram (an annotated picture, a set of callout boxes) has geometry
 * that's presentation, not content -- sent through the default handler's one-row-per-shape table,
 * it can bury the handful of sentences a digest is trying to summarize. This drops that geometry,
 * which a runtime consumer (Ideas, highlights citing an object by id) still needs, so it must
 * never become anyone's default. It's only reached by an explicit `tileHandlers` list a caller
 * opts into (assemble-unit.ts).
 */
import { DrawingObjectSnapshot } from "../../drawing/drawing-object-snapshot";
import { TileHandlerParams } from "../ai-summarizer-types";
import { pluralize } from "../ai-summarizer-utils";
import { imageFilename } from "./handle-image-tile";

const kEmptyDrawing = "This tile contains a drawing.";

export function handleDrawingTileLabels({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  try {
    return summarizeLabels(tile.model.content);
  } catch (error) {
    // Same failure contract as handleDrawingTile: nothing guards the handler loop in tileSummary,
    // so an uncaught error here would take down the whole document's summary, not just this tile.
    console.error("Error summarizing drawing tile labels:", error, tile);
    return "This tile contains a malformed drawing.";
  }
}

function summarizeLabels(content: { objects?: DrawingObjectSnapshot[], changes?: unknown[] }): string {
  // Same legacy-format check as drawing-to-table.ts, for the same reason: refuse to describe an
  // unreadable drawing as an empty one.
  if (Array.isArray(content.changes) && content.changes.length > 0) {
    return "This tile contains a drawing stored in a legacy format that this summary cannot read.";
  }

  const texts: string[] = [];
  const images: string[] = [];
  collectLabels(content.objects ?? [], texts, images);

  if (texts.length === 0 && images.length === 0) {
    return kEmptyDrawing;
  }

  const parts = [kEmptyDrawing];
  if (texts.length > 0) {
    parts.push(`Text in the drawing: ${texts.map(t => JSON.stringify(t)).join(", ")}.`);
  }
  if (images.length > 0) {
    const word = pluralize(images.length, "Image", "Images");
    parts.push(`${word} in the drawing: ${images.join(", ")}.`);
  }
  return parts.join(" ");
}

// Recurses into groups -- a label inside a group is still a label a reader needs, and this handler
// carries no id/parent columns for a reader to use to look one up separately the way the geometry
// table's rows do.
function collectLabels(objects: DrawingObjectSnapshot[], texts: string[], images: string[]): void {
  for (const o of objects) {
    if (o.type === "text" && o.text) {
      texts.push(o.text);
    } else if (o.type === "image") {
      const filename = imageFilename(o);
      if (filename) { images.push(filename); }
    }
    if (o.objects?.length) {
      collectLabels(o.objects, texts, images);
    }
  }
}
