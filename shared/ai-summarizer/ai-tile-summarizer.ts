import { programToGraphviz } from "../dataflow-to-graphviz";
import { generateTileDescription } from "../generate-tile-description";
import { slateToMarkdown } from "../slate-to-markdown";
import {
  AiSummarizerOptions, INormalizedRow, INormalizedTile, TileHandler, TileHandlerParams, TileMap
} from "./ai-summarizer-types";
import { heading } from "./ai-summarizer-utils";

export function handleTextTile({ tile, options }: TileHandlerParams): string|undefined {
  const content: any = tile.model.content;
  if (content.type !== "Text") { return undefined; }
  let textFormat = "Markdown";
  let result: string;
  switch (content.format) {
    case "slate":
      try {
        result = slateToMarkdown(content.text);
      } catch (error) {
        console.error("Error deserializing slate content:", error);
        result = content.text;
      }
      break;

    case "markdown":
      result = content.text;
      break;

    default:
      textFormat = content.format || "plain";
      result = content.text;
      break;
  }

  return options.minimal ? `\`\`\`text\n${result || ""}\n\`\`\``
    : `This tile contains the following ${textFormat} text content delimited below by a text code fence:` +
      `\n\n\`\`\`text\n${result || ""}\n\`\`\``;
}

export function handleImageTile({ tile, options }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Image") { return undefined; }
  return options.minimal ? "" : "This tile contains a static image. No additional information is available.";
}

export function handleGraphTile({ tile }: TileHandlerParams): string|undefined {
  const { content } = tile.model;
  if (content.type !== "Graph") { return undefined; }

  let result = `This tile contains a graph`;
  const { sharedDataSet } = tile;
  if (sharedDataSet) {
    result += ` which uses the "${sharedDataSet.name}" (${sharedDataSet.id}) data set.`;
  }
  const { axes, layers, plotType, xAttributeLabel, yAttributeLabel } = content;
  result += ` The graph is rendered as a ${plotType}.`;

  const config = layers[0]?.config;
  if (config) {
    const xAttributeID = config._attributeDescriptions?.x?.attributeID;
    const xVariable = sharedDataSet?.attributes.find((attr: any) => attr.id === xAttributeID);
    const xVariableName = xVariable?.name ?? "an unknown variable";
    result += `\n\n${xVariableName} is plotted on the x axis.`;
    const xAxis = axes.bottom ?? axes.top;
    if (xAxis) {
      result += ` This axis ranges from ${xAxis.min} to ${xAxis.max}.`;
      if (xAttributeLabel) result += ` It is labeled "${xAttributeLabel}".`;
    }

    const yAttributeID = config._yAttributeDescriptions?.[0]?.attributeID;
    if (yAttributeID) {
      const yVariable = sharedDataSet?.attributes.find((attr: any) => attr.id === yAttributeID);
      const yVariableName = yVariable?.name ?? "an unknown variable";
      result += `\n\n${yVariableName} is plotted on the y axis.`;
      const yAxis = axes.left ?? axes.rightNumeric ?? axes.rightCat;
      if (yAxis) {
        result += ` This axis ranges from ${yAxis.min} to ${yAxis.max}.`;
        if (yAttributeLabel) result += ` It is labeled "${yAttributeLabel}".`;
      }
    }
  }

  // TODO: Add information about adornments
  return result;
}

export function handleTableTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Table") { return undefined; }
  let result = `This tile contains a table`;
  if (tile.sharedDataSet) {
    result += ` which uses the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }
  return result;
}

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the drawing,
// which can be used in contexts where it is possible to import React libraries.
export function handleDrawingTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  return "This tile contains a drawing.";
}

export function handleDataflowTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Dataflow") { return undefined; }
  let result = "This tile contains a dataflow diagram.";
  if (!tile.model.content.program) return result;

  result += "\n```dot\n" + programToGraphviz(tile.model.content.program) + "\n```";
  return result;
}

export function handleQuestionTile({ tile, headingLevel, tileMap, options }: TileHandlerParams): string|undefined {
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
    rows: normalizedResponseRows,
    rowHeadingPrefix: "Response ",
    tileMap,
    headingLevel: headingLevel + 1,
    options
  });

  return result;
}

export function handlePlaceholderTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Placeholder") { return undefined; }
  return "";
}

export const defaultTileHandlers: TileHandler[] = [
  handleDataflowTile,
  handleDrawingTile,
  handleGraphTile,
  handleImageTile,
  handlePlaceholderTile,
  handleQuestionTile,
  handleTableTile,
  handleTextTile,
];

interface TileSummaryParams {
  tile: INormalizedTile;
  tileMap?: TileMap;
  headingLevel: number;
  options: AiSummarizerOptions;
}
export function tileSummary(params: TileSummaryParams): string {
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

interface TilesSummaryParams {
  tiles: INormalizedTile[];
  tileMap?: TileMap;
  headingLevel: number;
  options: AiSummarizerOptions;
}
export function tilesSummary({tiles, tileMap, headingLevel, options}: TilesSummaryParams): string {
  return tiles.map((tile) => {
    const summary = tileSummary({
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

interface RowsSummaryParams {
  rows: INormalizedRow[];
  rowHeadingPrefix?: string;
  tileMap?: TileMap;
  headingLevel: number;
  options: AiSummarizerOptions;
}
export function rowsSummary({rows, rowHeadingPrefix, tileMap, headingLevel, options}: RowsSummaryParams): string {
  const summaries = rows.map((row) => {
    let rowHeading = "";
    let tileHeadingLevel = headingLevel;
    if (!options.minimal) {
      tileHeadingLevel = headingLevel + 1;
      rowHeading = heading(headingLevel, `${rowHeadingPrefix || ""}Row ${row.number}`);
    }
    return rowHeading + tilesSummary({
      tiles: row.tiles,
      tileMap,
      headingLevel: tileHeadingLevel,
      options
    });
  });
  return summaries.join("\n\n");
}
