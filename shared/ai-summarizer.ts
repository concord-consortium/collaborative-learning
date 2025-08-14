/* eslint-disable max-len */

/*
Creates markdown versions of CLUE documents, suitable for feeding to AI models.
TODO: Support more tile types.
TODO: Support tiles embedded in Questions.
*/

import { slateToMarkdown } from "./slate-to-markdown";
import { generateTileDescription } from "./generate-tile-description";

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

export interface TileHandler {
  (tile: INormalizedTile, options: AiSummarizerOptions): string|undefined;
}

export const defaultTileHandlers: TileHandler[] = [
  handleTextTile,
  handleImageTile,
  handleTableTile,
  handleDrawingTile,
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
  const normalizedModel = normalize(parsedContent);
  const summarizedContent = summarize(normalizedModel, options);
  return summarizedContent;
}

/** Return a stringified version of the given CLUE curriculum document's text. */
export function summarizeCurriculum(content: any): string {
  if ("tiles" in content) {
    return summarizeCurriculum(content.tiles);
  }
  if (Array.isArray(content)) {
    return content.map(summarizeCurriculum).join("\n\n");
  }
  if ("content" in content) {
    const normalizedTile: INormalizedTile = {
      model: content,
      number: 0,
    };
    return tileSummary(normalizedTile, { includeModel: false, minimal: true });
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

export function normalize(model: DocumentContentSnapshotType): NormalizedModel {
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
    sections,
    dataSets,
  };
}

export function summarize(normalizedModel: NormalizedModel, options: AiSummarizerOptions): string {
  const {sections, dataSets} = normalizedModel;
  if (sections.length === 0) {
    return documentSummary(
      options.minimal ? "" : "This is an empty CLUE document with no content.",
      dataSets,
      "",
      options
    );
  }

  if (sections.length === 1 && !sections[0].sectionId) {
    return documentSummary(
      options.minimal ? "" : "The CLUE document consists of one or more rows, with one or more tiles within each row.",
      dataSets,
      rowsSummary(sections[0].rows, "rowWithoutSection", options),
      options
    );
  }

  return documentSummary(
    options.minimal ? "" : "The CLUE document consists of one or more sections containing one or more rows, with one or more tiles within each row.",
    dataSets,
    sectionsSummary(normalizedModel, options),
    options
  );
}

export const headingLevels = {
  documentSummary: 1,
  section: 2,
  row: 3,
  tile: 4,
  rowWithoutSection: 2,
  tileWithoutSection: 3,
  dataSets: 2,
  dataSet: 3,
} as const;
export type HeadingLevel = keyof typeof headingLevels;

export const minimalHeadingLevels: Record<HeadingLevel, number|undefined> = {
  documentSummary: 1,
  section: 2,
  tile: 3,
  tileWithoutSection: 2,
  dataSet: 2,
  dataSets: undefined,
  row: undefined,
  rowWithoutSection: undefined,
} as const;

export function heading(headingLevel: HeadingLevel, headingText: string, options: AiSummarizerOptions): string {
  const level = options.minimal ? minimalHeadingLevels[headingLevel] : headingLevels[headingLevel];
  if (!level) {
    return "";
  }
  return "#".repeat(level) + ` ${headingText}\n\n`;
}

export function documentSummary(preamble: string, dataSets: NormalizedDataSet[], summary: string = "", options: AiSummarizerOptions): string {
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
    ? "\n" + heading("dataSets", "Data Sets", options) +
      dataSets.map((dataSet) => {
        if (dataSet.tileIds.length === 0) { // Don't output if unused
          return "";
        }
        return heading("dataSet", dataSet.name, options) +
          `This data set has an id of ${dataSet.id} and is used in ${dataSet.tileIds.length} ${pluralize(dataSet.tileIds.length, "tile", "tiles")} ` +
          `and contains ${dataSet.attributes.length} ${pluralize(dataSet.attributes.length, "attribute", "attributes")} ` +
          `(${dataSet.attributes.map(a => a.name).join(", ")}).` +
          ` There are ${dataSet.numCases} ${pluralize(dataSet.numCases, "case", "cases")} in this data set, shown below in a Markdown table.\n\n` +
          `${generateMarkdownTable(dataSet.attributes.map(a => a.name), dataSet.data)}\n`;
      }).join("\n\n")
    : "";

  if (options.minimal) {
    return heading("documentSummary", "CLUE Document Summary", options) +
      `${summary}\n` +
      `${dataSetSummary}`;
  } else {
    return (
      heading("documentSummary", "CLUE Document Summary", options) +
      `${layoutInfo}${preamble}${maybeTileInfo}${maybeDataSetInfo}\n\n` +
      `${summary}\n` +
      `${dataSetSummary}\n`
    );
  }
}

export function sectionsSummary(normalizedModel: NormalizedModel, options: AiSummarizerOptions): string {
  const summaries = normalizedModel.sections.map((section, index) => {
    const maybeSectionId = section.sectionId ? ` (${section.sectionId})` : "";
    return heading("section", `Section ${index + 1}${maybeSectionId}`, options) +
      rowsSummary(section.rows, "row", options);
  });
  return summaries.join("\n\n");
}

export function rowsSummary(rows: INormalizedRow[], headingLevel: HeadingLevel, options: AiSummarizerOptions): string {
  const summaries = rows.map((row) => {
    const tileSummaries = tilesSummary(
      row.tiles,
      headingLevel === "rowWithoutSection" ? "tileWithoutSection" : "tile",
      options
    );
    if (options.minimal) {
      return tileSummaries;
    } else {
      return heading(headingLevel, `Row ${row.number}`, options) + tileSummaries;
    }
  });
  return summaries.join("\n\n");
}

function tileTitle(tile: INormalizedTile): string {
  return tile.model?.title ? ` (${tile.model.title})` : "";
}

export function tilesSummary(tiles: INormalizedTile[], headingLevel: HeadingLevel, options: AiSummarizerOptions): string {
  return tiles.map((tile) => {
    const summary = tileSummary(tile, options);
    if (summary) {
      return heading(headingLevel, `Tile ${tile.number}${tileTitle(tile)}`, options) + summary;
    }
    return "";
  })
  .filter((summary) => summary.length > 0)
  .join("\n\n");
}

function handleTextTile(tile: INormalizedTile, options: AiSummarizerOptions): string|undefined {
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

function handleImageTile(tile: INormalizedTile, options: AiSummarizerOptions): string|undefined {
  if (tile.model.content.type !== "Image") { return undefined; }
  return options.minimal ? "" : "This tile contains a static image. No additional information is available.";
}

function handleTableTile(tile: INormalizedTile, options: AiSummarizerOptions): string|undefined {
  if (tile.model.content.type !== "Table") { return undefined; }
  let result = `This tile contains a table`;
  if (tile.sharedDataSet) {
    result += ` which uses the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }
  return result;
}

// There is an alternative drawing tile handler in `ai-summarizer.ts` that outputs the SVG of the drawing,
// which can be used in contexts where it is possible to import React libraries.
function handleDrawingTile(tile: INormalizedTile, options: AiSummarizerOptions): string|undefined {
  if (tile.model.content.type !== "Drawing") { return undefined; }
  return "This tile contains a drawing.";
}

function handlePlaceholderTile(tile: INormalizedTile, options: AiSummarizerOptions): string|undefined {
  if (tile.model.content.type !== "Placeholder") { return undefined; }
  return "";
}

export function tileSummary(tile: INormalizedTile, options: AiSummarizerOptions): string {
  const handlers = options.tileHandlers || defaultTileHandlers;

  for (const handler of handlers) {
    const summary = handler(tile, options);
    if (summary !== undefined) {
      return summary;
    }
  }

  // If none of the handlers returned a result, generate a generic description of the tile content.
  let result: string;
  try {
    result = generateTileDescription(tile.model.content);
  } catch (error) {
    console.error("Error generating description for tile content:", error);
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

  const escapePipe = (text: string) => text.replace(/\|/g, "\\|");
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
