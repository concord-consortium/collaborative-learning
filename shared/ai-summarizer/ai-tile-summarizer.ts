import { slateToMarkdown } from "../slate-to-markdown";
import {
  INormalizedRow, INormalizedTile, TileHandler, TileHandlerBaseParams, TileHandlerParams, TilesHandlerParams
} from "./ai-summarizer-types";
import { heading, pluralize } from "./ai-summarizer-utils";
import { programToGraphviz } from "./dataflow-to-graphviz";
import { generateTileDescription } from "./generate-tile-description";

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

export function handleGraphTile({ dataSets, tile }: TileHandlerParams): string|undefined {
  const { content } = tile.model;
  if (content.type !== "Graph") { return undefined; }

  // Basic info
  let result = `This tile contains a graph.`;
  const { adornments, axes, layers, plotType, xAttributeLabel, yAttributeLabel } = content;
  result += ` The graph is rendered as a ${plotType}.`;

  // Axes
  const xAxis = axes.bottom ?? axes.top;
  if (xAxis) {
    const labelPart = xAttributeLabel ? `is labeled "${xAttributeLabel}" and ` : "";
    result += ` The x axis ${labelPart}ranges from ${xAxis.min} to ${xAxis.max}.`;
  }
  const yAxis = axes.left ?? axes.rightNumeric ?? axes.rightCat;
  if (yAxis) {
    const labelPart = yAttributeLabel ? `is labeled "${yAttributeLabel}" and ` : "";
    result += ` The y axis ${labelPart}ranges from ${yAxis.min} to ${yAxis.max}.`;
  }

  // Datasets
  const pluralDataset = pluralize(layers.length, "dataset", "datasets");
  result += `\n\nThe graph displays data from ${layers.length} ${pluralDataset}.`;
  const oneDatasetWord = pluralize(layers.length, " It", "\n\nOne");
  layers.forEach((layer: any) => {
    const { config, editable } = layer;
    if (config) {
      const dataSet = dataSets.find(ds => ds.id === config.dataset);

      if (dataSet) {
        result += `${oneDatasetWord} is the "${dataSet.name}" (${dataSet.id}) data set.`;
        if (editable) result += ` This dataset contains manually entered data points.`;

        const xAttributeID = config._attributeDescriptions?.x?.attributeID;
        const xVariable = dataSet.attributes.find((attr: any) => attr.id === xAttributeID);
        const xVariableName = xVariable?.name ?? "An unknown variable";
        result += ` ${xVariableName} is plotted on the x axis and`;

        const yAttributeID = config._yAttributeDescriptions?.[0]?.attributeID;
        const yVariable = dataSet.attributes.find((attr: any) => attr.id === yAttributeID);
        const yVariableName = yVariable?.name ?? "An unknown variable";
        result += ` ${yVariableName} is plotted on the y axis for this dataset.`;
      }
    }
  });

  // Movable lines
  const movableLines = adornments?.find((adornment: any) => adornment.type === "Movable Line");
  if (movableLines) {
    const lines = Object.values(movableLines.lines);
    if (lines.length > 0) {
      const existenceWord = pluralize(lines.length, "is", "are");
      const lineWord = pluralize(lines.length, "line", "lines");
      result += `\n\nThere ${existenceWord} ${lines.length} movable ${lineWord} on this graph.`;
      const oneLineWord = pluralize(lines.length, "It", "One line");
      lines.forEach((line: any) => {
        result += ` ${oneLineWord} has a slope of ${line.slope} and a y-intercept of ${line.intercept}.`;
      });
    }
  }

  // TODO: Add information about more adornments
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
