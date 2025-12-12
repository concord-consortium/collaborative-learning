/* eslint-disable max-len */

/*
Creates markdown versions of CLUE documents, suitable for feeding to AI models.
TODO: Support more tile types.
*/

import { slateToMarkdown } from "./slate-to-markdown";
import { generateTileDescription } from "./generate-tile-description";
import { programToGraphviz } from "./dataflow-to-graphviz";

// We can't load actual interfaces from src/models in this context.
type DocumentContentSnapshotType = any;
type ITileModelSnapshotOut = any;

export interface INormalizedTile {
  model: ITileModelSnapshotOut;
  number: number;
  sharedDataSet?: NormalizedDataSet
}

export interface INormalizedRow {
  tiles: INormalizedTile[];
  number: number;
}

export interface NormalizedSection {
  rows: INormalizedRow[];
  sectionId?: string;
}

export interface NormalizedDataSet {
  id: string;
  providerId: string;
  name: string;
  tileIds: string[];
  attributes: {name: string, values: string[]}[];
  numCases: number;
  data: string[][];
}

export interface NormalizedModel {
  sections: NormalizedSection[];
  dataSets: NormalizedDataSet[];
}

export type TileMap = Record<string, ITileModelSnapshotOut>;

export interface TileHandlerParams {
  tile: INormalizedTile;
  tileMap?: TileMap;
  headingLevel: number;
  options: AiSummarizerOptions;
}
export interface TileHandler {
  (params: TileHandlerParams): string|undefined;
}

export const defaultTileHandlers: TileHandler[] = [
  handleTextTile,
  handleImageTile,
  handleTableTile,
  handleDrawingTile,
  handleDataflowTile,
  handleQuestionTile,
  handlePlaceholderTile,
];

export interface AiSummarizerOptions {
  includeModel?: boolean; // If true, include the full JSON model in the output
  minimal?: boolean;      // If true, skip all boilerplate and headers and just return the text content
  tileHandlers?: TileHandler[];
}

/** Return the markdown summary of the given Document content.
 * The options object determines the style of the output:
 * - includeModel: If true, include the full JSON model in the output
 * - minimal: If true, skip a lot of the boilerplate explanations of the structure, and do not show the row
 *   and column structure at all, just the sections, tiles and their contents.
 * - tileHandlers: Override the default set of functions to translate tile types.
*/
export function documentSummarizer(content: any, options: AiSummarizerOptions): string {
  const stringContent = stringifyContent(content);
  const parsedContent = parseContent(stringContent);
  const { normalizedModel, tileMap } = normalize(parsedContent);
  const summarizedContent = summarize(normalizedModel, tileMap, options);
  return summarizedContent;
}

/**
 * Return a stringified version of the given CLUE curriculum document's text.
 *
 * This approach does not work well. The tiles are not labeled with headers like when
 * summarizing a normal document. Also rows are not handled well. They are just
 * recursively summarized with flattens everything.
 *
 * Also the authored exported format of some tiles is different than the normal format:
 * - The question tiles inline their child tiles inside of their content when exported
 * for the curriculum, so the question tile summarization would have to be updated for that.
 * - The table tile export used by authoring is different than the normal table export. It
 * seems like this code ignores the columnWidths which is the only table tile specific property.
 * Because of that table tiles are currently fine, but if someone adds new properties to the
 * table that are serialized differently in authoring and runtime, this will become a problem.
 * - The text tile export used by authoring is different from the normal text tile export. For
 * example the highlighted text is not included in the authoring export.
 */
export function summarizeCurriculum(content: any, headingLevel = 1, tileMap?: TileMap): string {
  if ("tiles" in content) {
    return summarizeCurriculum(content.tiles, headingLevel, tileMap);
  }
  if (Array.isArray(content)) {
    return content.map(contentItem => summarizeCurriculum(contentItem, headingLevel, tileMap)).join("\n\n");
  }
  if ("content" in content) {
    const normalizedTile: INormalizedTile = {
      model: content,
      number: 0,
    };
    return tileSummary({
      tile: normalizedTile,
      tileMap,
      headingLevel,
      options: { includeModel: false, minimal: true }
    });
  } else {
    console.error("Unparsable content", content);
    return "";
  }
}

export function stringifyContent(content: any): string {
  if (typeof content === "string") {
    return content;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch (error) {
    throw new Error("Invalid input to aiSummarizer");
  }
}

export function parseContent(content: string): DocumentContentSnapshotType {
  try {
    return JSON.parse(content) as DocumentContentSnapshotType;
  } catch (error) {
    throw new Error("Failed to parse content in aiSummarizer");
  }
}

export function normalize(model: DocumentContentSnapshotType) {
  const sections: NormalizedSection[] = [];
  const dataSets: NormalizedDataSet[] = [];
  const {rowOrder, rowMap, tileMap, sharedModelMap} = model || {};

  const addSection = (sectionId?: string): NormalizedSection => {
    const newSection: NormalizedSection = {
      rows: [],
      sectionId,
    };
    sections.push(newSection);
    return newSection;
  };

  if (rowOrder && rowOrder.length > 0 && rowMap && tileMap) {
    let section: NormalizedSection|undefined;

    for (const rowId of rowOrder) {
      const modelRow = rowMap[rowId];
      if (!modelRow) {
        continue; // Skip if row is not found
      }
      if (!section || modelRow.isSectionHeader) {
        section = addSection(modelRow.sectionId);
      }
      if (!modelRow.isSectionHeader && modelRow.tiles) {
        const tiles = modelRow.tiles
          .map((tile: any) => tileMap[tile.tileId])
          .filter(Boolean)
          .map((tile: any) => ({model: tile, number: 0})) as INormalizedTile[];
        section.rows.push({
          tiles,
          number: 0, // this will be set at the end
        });
      }
    }
  }

  // remove empty sections
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].rows.length === 0) {
      sections.splice(i, 1);
    }
  }

  // number the rows
  let rowNumber = 1;
  for (const section of sections) {
    section.rows.forEach((row) => {
      row.number = rowNumber++;
    });
  }

  // number the tiles
  let tileNumber = 1;
  for (const section of sections) {
    section.rows.forEach((row) => {
      row.tiles.forEach((tile) => {
        tile.number = tileNumber++;
      });
    });
  }

  // add the data sets
  if (sharedModelMap) {
    for (const [id, entry] of Object.entries(sharedModelMap)) {
      const sharedModel: any = (entry as any).sharedModel;
      if (sharedModel?.type === "SharedDataSet") {
        const {attributes, cases, name} = sharedModel.dataSet;
        const dataSet: NormalizedDataSet = {
          id,
          providerId: sharedModel.providerId,
          name,
          tileIds: (entry as any).tiles.map((tile: any) => `${tile}`),
          attributes: (attributes || []).map((attr: any) => ({name: attr.name, values: attr.values || []})),
          numCases: cases.length,
          data: [],
        };
        for (let i = 0; i < cases.length; i++) {
          const cols: string[] = [];
          for (const attr of dataSet.attributes) {
            cols.push(attr.values[i] || "");
          }
          dataSet.data.push(cols);
        }
        dataSets.push(dataSet);

        // add the data set to the tiles that reference it
        for (const section of sections) {
          section.rows.forEach((row) => {
            row.tiles.forEach((tile) => {
              if (dataSet.tileIds.includes(tile.model.id)) {
                tile.sharedDataSet = dataSet;
              }
            });
          });
        }
      }
    }
  }

  // Implement normalization logic here if needed
  return {
    normalizedModel: {
      sections,
      dataSets,
    },
    tileMap: tileMap as TileMap | undefined,
  };
}

export function summarize(normalizedModel: NormalizedModel, tileMap: TileMap | undefined, options: AiSummarizerOptions): string {
  const {sections, dataSets} = normalizedModel;
  if (sections.length === 0) {
    return documentSummary(
      options.minimal ? "" : "This is an empty CLUE document with no content.",
      dataSets,
      "",
      options,
      1
    );
  }

  // Document summary will be at heading level 1
  if (sections.length === 1 && !sections[0].sectionId) {
    // No section header, so rows use heading level 2
    return documentSummary(
      options.minimal ? "" : "The CLUE document consists of one or more rows, with one or more tiles within each row.",
      dataSets,
      rowsSummary({
        rows: sections[0].rows,
        tileMap,
        headingLevel: 2,
        options
      }),
      options,
      1
    );
  }

  // Multiple sections, so sections use heading level 2
  return documentSummary(
    options.minimal ? "" : "The CLUE document consists of one or more sections containing one or more rows, with one or more tiles within each row.",
    dataSets,
    sectionsSummary({normalizedModel, tileMap, options, headingLevel: 2}),
    options,
    1
  );
}

export function heading(level: number, headingText: string): string {
  if (!level) {
    return "";
  }
  return "#".repeat(level) + ` ${headingText}\n\n`;
}

export function documentSummary(preamble: string, dataSets: NormalizedDataSet[], summary: string = "", options: AiSummarizerOptions, headingLevel: number = 1): string {
  const maybeTileInfo = summary.length > 0
    ? " Tiles are either static UI elements or interactive elements " +
      "that students can use."
    : "";
  const layoutInfo = summary.length > 0
    ? "The markdown below summarizes the CLUE document's structure and content.  "
    : "";
  const maybeDataSetInfo = summary.length > 0 && dataSets.length > 0
    ? `  The document contains ${dataSets.length} ${pluralize(dataSets.length, "data set", "data sets")} which ${pluralize(dataSets.length, "is", "are")} listed at the end of this summary under the "Data Sets" heading.`
    : "";
  const dataSetSummary = summary.length > 0 && dataSets.length > 0
    ? "\n" + heading(headingLevel + 1, "Data Sets") +
      dataSets.map((dataSet) => {
        if (dataSet.tileIds.length === 0) { // Don't output if unused
          return "";
        }
        return heading(headingLevel + 2, dataSet.name) +
          `This data set has an id of ${dataSet.id} and is used in ${dataSet.tileIds.length} ${pluralize(dataSet.tileIds.length, "tile", "tiles")} ` +
          `and contains ${dataSet.attributes.length} ${pluralize(dataSet.attributes.length, "attribute", "attributes")} ` +
          `(${dataSet.attributes.map(a => a.name).join(", ")}).` +
          ` There are ${dataSet.numCases} ${pluralize(dataSet.numCases, "case", "cases")} in this data set, shown below in a Markdown table.\n\n` +
          `${generateMarkdownTable(dataSet.attributes.map(a => a.name), dataSet.data)}\n`;
      }).join("\n\n")
    : "";

  if (options.minimal) {
    return heading(headingLevel, "CLUE Document Summary") +
      `${summary}\n` +
      `${dataSetSummary}`;
  } else {
    return (
      heading(headingLevel, "CLUE Document Summary") +
      `${layoutInfo}${preamble}${maybeTileInfo}${maybeDataSetInfo}\n\n` +
      `${summary}\n` +
      `${dataSetSummary}\n`
    );
  }
}

interface SectionsSummaryParams {
  normalizedModel: NormalizedModel;
  tileMap?: TileMap;
  options: AiSummarizerOptions;
  headingLevel: number;
}
export function sectionsSummary({normalizedModel, tileMap, options, headingLevel}: SectionsSummaryParams): string {
  const summaries = normalizedModel.sections.map((section, index) => {
    const maybeSectionId = section.sectionId ? ` (${section.sectionId})` : "";
    return heading(headingLevel, `Section ${index + 1}${maybeSectionId}`) +
      rowsSummary({
        rows: section.rows,
        tileMap,
        headingLevel: headingLevel + 1,
        options
      });
  });
  return summaries.join("\n\n");
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

function handleTextTile({ tile, options }: TileHandlerParams): string|undefined {
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
   : `This tile contains the following ${textFormat} text content delimited below by a text code fence:\n\n\`\`\`text\n${result || ""}\n\`\`\``;
}

function handleImageTile({ tile, options }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Image") { return undefined; }
  return options.minimal ? "" : "This tile contains a static image. No additional information is available.";
}

function handleTableTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Table") { return undefined; }
  let result = `This tile contains a table`;
  if (tile.sharedDataSet) {
    result += ` which uses the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }
  return result;
}

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the drawing,
// which can be used in contexts where it is possible to import React libraries.
function handleDrawingTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  return "This tile contains a drawing.";
}

function handleDataflowTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Dataflow") { return undefined; }
  let result = "This tile contains a dataflow diagram.";
  if (!tile.model.content.program) return result;

  result += "\n```dot\n" + programToGraphviz(tile.model.content.program) + "\n```";
  return result;
}

function handleQuestionTile({ tile, headingLevel, tileMap, options }: TileHandlerParams): string|undefined {
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

function handlePlaceholderTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Placeholder") { return undefined; }
  return "";
}

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
  return `This tile contains ${tile.model.content.type.toLowerCase()} content.\n\n${result}${options.includeModel ? `\n\n${JSON.stringify(tile)}` : ""}`;
}

function pluralize(length: number, singular: string, plural: string): string {
  return length === 1 ? singular : plural;
}

function generateMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) {
    return "";
  }

  const escapePipe = (stringOrNumber: string | number) => String(stringOrNumber).replace(/\|/g, "\\|");
  const headerRow = `| ${headers.map(escapePipe).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  const dataRows = rows.map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push("");
    }
    return `| ${paddedRow.map(escapePipe).join(" | ")} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join("\n");
}

/* eslint-enable max-len */
