// One projection per tile type, for the packet's tiles[] array.
//
// These are not the ai-summarizer's markdown handlers, and the difference is deliberate: those
// produce prose for a model reading a document ("This tile contains a table which uses the ..."),
// while a packet field is read by code that has to address what it finds. Where the underlying
// work is the same — slate to markdown, a drawing to a table, a simulation key to its description
// — this calls the summarizer's own function rather than reimplementing it.
//
// What a tile does NOT carry is as considered as what it does. A Table tile holds column widths;
// its rows live in a SharedDataSet and are projected there. Sending the widths would suggest we
// had described the table when we had not.

import { drawingToTable } from "../ai-summarizer/tile-summarizers/drawing-to-table";
import { getSimulationData } from "../simulations/simulations";
import { slateToMarkdown } from "../slate-to-markdown";

export type ProjectedTileType = "Text" | "Simulator" | "Table" | "Dataflow" | "Other";

export interface ProjectedTile {
  tile_id: string;
  type: ProjectedTileType;
  title?: string;
  content: Record<string, unknown>;
  shared_model_ids?: string[];
}

function projectText(content: any): Record<string, unknown> {
  if (content.format === "slate") {
    try {
      return { text: slateToMarkdown(content.text) };
    } catch {
      // A tile we cannot read costs the reader that tile. Saying so beats sending the raw slate
      // JSON, which reads as content the student wrote.
      return { text: "", note: "This tile's text could not be read." };
    }
  }
  // Anything else goes through as authored, named by its format so a reader knows not to treat
  // markup as prose the student typed.
  const text = Array.isArray(content.text) ? content.text.join("\n") : `${content.text ?? ""}`;
  return { format: content.format || "plain", text };
}

function projectSimulator(content: any): Record<string, unknown> {
  const out: Record<string, unknown> = { simulation: content.simulation };
  // Absent rather than invented: a key we do not recognize gets no description at all, so the
  // reader can tell "no simulation by that name" from "a simulation with no description".
  const description = getSimulationData(content.simulation)?.description;
  if (description) out.description = description;
  return out;
}

function projectOther(content: any): Record<string, unknown> {
  const kind = content.type;
  if (kind === "Image") {
    return { kind, url: content.url };
  }
  if (kind === "Drawing") {
    let rendering: string;
    try {
      rendering = drawingToTable(content);
    } catch {
      rendering = "This drawing was malformed and could not be read.";
    }
    return { kind, rendering };
  }
  // A type we have no projection for is still worth naming. An empty content object says "this
  // tile is here and we did not describe it", which is not the same as leaving it out.
  return { kind };
}

/**
 * Projects one tile. Returns undefined for tiles that should not appear in the packet at all.
 *
 * `content` is a tile content snapshot; `tileId` and `title` come from the enclosing TileModel.
 */
export function projectTile(
  content: any, tileId: string, title?: string
): ProjectedTile | undefined {
  if (!content?.type) return undefined;
  // Placeholders are the empty scaffolding of an auto-sectioned document, not student work.
  // Sending them would describe a workspace fuller than the one the student sees.
  if (content.type === "Placeholder") return undefined;

  let type: ProjectedTileType;
  let projected: Record<string, unknown>;
  switch (content.type) {
    case "Text":
      type = "Text";
      projected = projectText(content);
      break;
    case "Simulator":
      type = "Simulator";
      projected = projectSimulator(content);
      break;
    case "Table":
      type = "Table";
      projected = {};
      break;
    default:
      type = "Other";
      projected = projectOther(content);
      break;
  }

  const tile: ProjectedTile = { tile_id: tileId, type, content: projected };
  if (title) tile.title = title;
  return tile;
}
