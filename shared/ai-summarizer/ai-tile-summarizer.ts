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

// The prompt is summarized directly rather than through tilesSummary, so it needs its id line
// added here. Emitted even though the prompt is summarized minimally: a drawing used as a prompt
// gives every object an id, and those are unusable without the tile's id to go with them.
// Always minimal. imageFilenames is always forwarded: it doesn't change how anything is described,
// only whether an image tile names its file instead of going silent. tileHandlers is forwarded
// only when the caller says to (forwardTileHandlers) -- a custom handler changes how a tile gets
// described, e.g. rendering full SVG for a drawing, which is a real risk for a runtime document
// (documentSummarizerWithDrawings's own SVG handler) but not for questionBodyFromInlineTiles below,
// whose only caller is the curriculum summarizer.
function questionPromptSummary({
  dataSets, tileMap, headingLevel, options, promptTile, forwardTileHandlers
}: TileHandlerBaseParams & { promptTile: any; forwardTileHandlers?: boolean }): string {
  if (!promptTile?.content) { return ""; }
  return heading(headingLevel, "Question Prompt") +
    tileIdLine({ model: promptTile, number: 0 } as INormalizedTile) +
    tileSummary({
      dataSets,
      tile: { model: promptTile, number: 0 },
      tileMap,
      headingLevel,
      options: {
        minimal: true,
        imageFilenames: options.imageFilenames,
        ...(forwardTileHandlers ? { tileHandlers: options.tileHandlers } : {})
      }
    }) +
    "\n\n";
}

// A curriculum section's authored JSON inlines the question's child tiles directly, in a `tiles`
// array using the same shape as the outer content.tiles: a bare object is a one-tile row, an
// array is a multi-tile row.
function questionBodyFromInlineTiles(
  { dataSets, tileMap, headingLevel, options }: TileHandlerParams, inlineTiles: any[]
): string {
  if (inlineTiles.length === 0) {
    return "This question does not contain any response tiles.\n\n";
  }

  const [promptItem, ...responseItems] = inlineTiles;
  const promptTile = Array.isArray(promptItem) ? promptItem[0] : promptItem;

  let result = responseItems.length === 0 ? "This question does not contain any response tiles.\n\n" : "";
  result += questionPromptSummary({ dataSets, tileMap, headingLevel, options, promptTile, forwardTileHandlers: true });

  if (responseItems.length === 0) {
    return result;
  }

  let tileNumber = 1;
  let rowNumber = 1;
  const normalizedResponseRows: INormalizedRow[] = responseItems.map((item: any) => ({
    tiles: (Array.isArray(item) ? item : [item]).map((t: any) => ({
      model: t,
      number: tileNumber++,
    } as INormalizedTile)),
    number: rowNumber++,
  }));
  result += heading(headingLevel, "Question Response");
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

// A runtime document has rows/tiles already expanded into rowOrder/rowMap/tileMap -- RowList does
// that expansion once an authored `tiles` array is loaded into MST, so a live document never has
// the inlined shape questionBodyFromInlineTiles handles.
function questionBodyFromRows({ dataSets, tile, headingLevel, tileMap, options }: TileHandlerParams): string {
  const { rowOrder, rowMap } = tile.model.content;
  let result = "";
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
  result += questionPromptSummary({ dataSets, tileMap, headingLevel, options, promptTile });

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

// This handler is not in its own file because it recursively uses tileSummary.
export function handleQuestionTile(params: TileHandlerParams): string|undefined {
  const { tile } = params;
  if (tile.model.content.type !== "Question") { return undefined; }

  const intro = `This is a question for students to answer. Its question id is \`${tile.model.content.questionId}\`. ` +
    "This question id can be used to match up student responses to the same question.\n\n";

  const inlineTiles = tile.model.content.tiles;
  const body = Array.isArray(inlineTiles)
    ? questionBodyFromInlineTiles(params, inlineTiles)
    : questionBodyFromRows(params);

  return intro + body;
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

// The id is a separate line rather than part of the heading: headings are matched by prefix in
// tests and read by people, and anything that wants to refer to an object inside this tile needs
// the tile id alongside the object id.
function tileIdLine(tile: INormalizedTile): string {
  return tile.model?.id ? `This tile's id is \`${tile.model.id}\`.\n\n` : "";
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
      return heading(headingLevel, `Tile ${tile.number}${tileTitle(tile)}`) + tileIdLine(tile) + summary;
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
