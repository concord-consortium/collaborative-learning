import {
  INormalizedRow, INormalizedTile, TileHandler, TileHandlerBaseParams, TileHandlerParams, TilesHandlerParams
} from "./ai-summarizer-types";
import { heading } from "./ai-summarizer-utils";
import { generateTileDescription } from "./generate-tile-description";
import { handleDataflowTile } from "./tile-summarizers/handle-dataflow-tile";
import { handleDrawingTile } from "./tile-summarizers/handle-drawing-tile";
import { handleGraphTile } from "./tile-summarizers/handle-graph-tile";
import { handleImageTile } from "./tile-summarizers/handle-image-tile";
import { handleSimulatorTile } from "./tile-summarizers/handle-simulator-tile";
import { handleTableTile } from "./tile-summarizers/handle-table-tile";
import { handleTextTile } from "./tile-summarizers/handle-text-tile";

export function handlePlaceholderTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Placeholder") { return undefined; }
  return "";
}

// This handler is not in its own file because it recursively uses tileSummary.
export function handleQuestionTile({
  dataSets, tile, headingLevel, tileMap, options
}: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Question") { return undefined; }

  const { rowOrder, rowMap } = tile.model.content;

  let result = `This is a question for students to answer. Its question id is \`${tile.model.content.questionId}\`. ` +
    "This question id can be used to match up student responses to the same question.\n\n";

  if (!rowOrder || rowOrder.length < 2) {
    result += "This question does not contain any response tiles.\n\n";
  }

  // The prompt is not stored explicitly in the question tile.
  // We have to look at the rowOrder and get the first row
  // Then get that row from the rowMap and get its first tile
  const firstRowId = rowOrder?.[0];
  const firstRow = rowMap?.[firstRowId];
  const promptTileId = firstRow?.tiles?.[0]?.tileId;
  const promptTile = promptTileId ? tileMap?.[promptTileId] : null;
  if (promptTile && promptTile.content) {
    result += heading(headingLevel, "Question Prompt");
    result += tileSummary({
      dataSets,
      tile: { model: promptTile, number: 0 },
      tileMap,
      headingLevel,
      options: { minimal: true }
    });
    result += "\n\n";
  }

  if (!rowOrder || rowOrder.length < 2) {
    return result;
  }
  const responseRows = rowOrder.slice(1).map((rowId: string) => rowMap?.[rowId]).filter(Boolean);

  result += heading(headingLevel, "Question Response");

  // Create normalized rows and tiles for the question responses
  let tileNumber = 1;
  let rowNumber = 1;
  const normalizedResponseRows: INormalizedRow[] = responseRows.map((r: any) => ({
    tiles: r.tiles.map((t: any) => {
      const tileModel = tileMap ? tileMap[t.tileId] : null;
      return {
        model: tileModel,
        number: tileNumber++,
      } as INormalizedTile;
    }),
    number: rowNumber++,
  }));
  result += rowsSummary({
    dataSets,
    rows: normalizedResponseRows,
    rowHeadingPrefix: "Response ",
    tileMap,
    headingLevel: headingLevel + 1,
    options
  });

  return result;
}

export const defaultTileHandlers: TileHandler[] = [
  handleDataflowTile,
  handleDrawingTile,
  handleGraphTile,
  handleImageTile,
  handlePlaceholderTile,
  handleQuestionTile,
  handleSimulatorTile,
  handleTableTile,
  handleTextTile,
];

export function tileSummary(params: TileHandlerParams): string {
  const { tile, options } = params;
  const handlers = options.tileHandlers || defaultTileHandlers;

  for (const handler of handlers) {
    const summary = handler(params);
    if (summary !== undefined) {
      return summary;
    }
  }

  // If none of the handlers returned a result, generate a generic description of the tile content.
  let result: string;
  try {
    result = generateTileDescription(tile.model.content);
  } catch (error) {
    console.error("Error generating description for tile content:", error, tile);
    result = "An error occurred while generating the description.";
  }
  return `This tile contains ${tile.model.content.type.toLowerCase()} content.` +
    `\n\n${result}${options.includeModel ? `\n\n${JSON.stringify(tile)}` : ""}`;
}

function tileTitle(tile: INormalizedTile): string {
  return tile.model?.title ? ` (${tile.model.title})` : "";
}

export function tilesSummary({dataSets, tiles, tileMap, headingLevel, options}: TilesHandlerParams): string {
  return tiles.map((tile) => {
    const summary = tileSummary({
      dataSets,
      tile,
      tileMap,
      headingLevel: headingLevel + 1,
      options
    });
    if (summary) {
      return heading(headingLevel, `Tile ${tile.number}${tileTitle(tile)}`) + summary;
    }
    return "";
  })
  .filter((summary) => summary.length > 0)
  .join("\n\n");
}

interface RowsSummaryParams extends TileHandlerBaseParams {
  rows: INormalizedRow[];
  rowHeadingPrefix?: string;
}
export function rowsSummary({
  dataSets, rows, rowHeadingPrefix, tileMap, headingLevel, options
}: RowsSummaryParams): string {
  const summaries = rows.map((row) => {
    let rowHeading = "";
    let tileHeadingLevel = headingLevel;
    if (!options.minimal) {
      tileHeadingLevel = headingLevel + 1;
      rowHeading = heading(headingLevel, `${rowHeadingPrefix || ""}Row ${row.number}`);
    }
    return rowHeading + tilesSummary({
      dataSets,
      tiles: row.tiles,
      tileMap,
      headingLevel: tileHeadingLevel,
      options
    });
  });
  return summaries.join("\n\n");
}
