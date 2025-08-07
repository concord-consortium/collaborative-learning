/* eslint-disable max-len */

// TODO: This is a slightly-modified copy of the shared/ai-summarizer.ts file.
// Importing from shared fails in the offline script context.
// Doug suggests: create an npm script to build/package the ai-summarizer.ts file into a standalone bundle with
// a .d.ts file emitted so that you could then import it as javascript into the scripts folder.
// That would fix all the module import errors.


import type {  DocumentContentSnapshotType } from "../../src/models/document/document-content";
import type { ITileModelSnapshotOut } from "../../src/models/tiles/tile-model";
import { slateToMarkdown } from "./slate-to-markdown";
import { generateTileDescription } from "./generate-tile-description";

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

export interface AiSummarizerOptions {
  includeModel?: boolean,
  minimal?: boolean
}

export function aiSimpleSummarizer(content: any, options: AiSummarizerOptions): string {
  const stringContent = stringifyContent(content);
  const parsedContent = parseContent(stringContent);
  const normalizedModel = normalize(parsedContent);
  const summarizedContent = summarize(normalizedModel, options);
  return summarizedContent;
}

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
    const summary = tileSummary(normalizedTile, { includeModel: false, minimal: true });
    if (summary.length > 0) {
      const tileHeading = `## Tile: ${tileTitle(normalizedTile)}`;
      return(tileHeading + "\n\n" + summary);
    }
    return "";
  } else {
    console.error("Unparsable content", content);
    return "";
  }
}

export function summarizeTiles(content: any): string[] {
  const stringContent = stringifyContent(content);
  const parsedContent = parseContent(stringContent);
  const { sections, dataSets } = normalize(parsedContent);

  const summaries: string[] = [];
  for (const section of sections) {
    for (const row of section.rows) {
      for (const tile of row.tiles) {
        const summary = tileSummary(tile, { includeModel: false });
        if (summary.length > 0) {
          const tileHeading = `## Tile: ${tileTitle(tile)}`;
          summaries.push(tileHeading + "\n\n" + summary);
        }
      }
    }
  }
  for (const dataSet of dataSets) {
    const summary = `## Dataset: ${dataSet.name}\n\n${generateMarkdownTable(dataSet.attributes.map(a => a.name), dataSet.data)}\n\n`;
    summaries.push(summary);
  }
  return summaries;
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
  const {rowOrder, rowMap, tileMap, sharedModelMap } = model;

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
          .map((tile) => tileMap[tile.tileId])
          .filter(Boolean)
          .filter((tile) => tile.content.type !== "Placeholder")
          .map((tile) => ({model: tile, number: 0})) as INormalizedTile[];
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
      const sharedModel: any = entry.sharedModel;
      if (sharedModel?.type === "SharedDataSet") {
        const {attributes, cases, name} = sharedModel.dataSet;
        const dataSet: NormalizedDataSet = {
          id,
          providerId: sharedModel.providerId,
          name,
          tileIds: (entry.tiles || []).map((tile) => `${tile}`),
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
    return "";
  }

  if (sections.length === 1 && !sections[0].sectionId) {
    return documentSummary(
      dataSets,
      rowsSummary(sections[0].rows, "rowWithoutSection", options)
    );
  }

  return documentSummary(
    dataSets,
    sectionsSummary(normalizedModel, options)
  );
}

export const headingLevels = {
  documentSummary: 2,
  section: 3,
  row: 4,
  tile: 5,
  rowWithoutSection: 3,
  tileWithoutSection: 4,
  dataSets: 3,
  dataSet: 4,
} as const;
export type HeadingLevel = keyof typeof headingLevels;

export function heading(headingLevel: HeadingLevel): string {
  const level = headingLevels[headingLevel];
  if (!level) {
    throw new Error("Invalid heading level");
  }
  return "#".repeat(level);
}

export function documentSummary(dataSets: NormalizedDataSet[], summary: string = ""): string {
  if (summary.trim() === "") {
    return "";
  }

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
    ? `\n${heading("dataSets")} Data Sets\n\n` +
      dataSets.map((dataSet) => {
        if (dataSet.tileIds.length === 0) {
          return "";
        }
        return `${heading("dataSet")} ${dataSet.name}\n\n` +
          `This data set has an id of ${dataSet.id} and is used in ${dataSet.tileIds.length} ${pluralize(dataSet.tileIds.length, "tile", "tiles")} ` +
          `and contains ${dataSet.attributes.length} ${pluralize(dataSet.attributes.length, "attribute", "attributes")} ` +
          `(${dataSet.attributes.map(a => a.name).join(", ")}).` +
          ` There are ${dataSet.numCases} ${pluralize(dataSet.numCases, "case", "cases")} in this data set, shown below in a Markdown table.\n\n` +
          `${generateMarkdownTable(dataSet.attributes.map(a => a.name), dataSet.data)}\n`;
      }).join("\n\n")
    : "";

  return (
    `${layoutInfo}${maybeTileInfo}${maybeDataSetInfo}\n\n` +
    `${summary}\n` +
    `${dataSetSummary}\n`
  );
}

export function sectionsSummary(normalizedModel: NormalizedModel, options: AiSummarizerOptions): string {
  const summaries = normalizedModel.sections.map((section, index) => {
    const maybeSectionId = section.sectionId ? ` (${section.sectionId})` : "";
    const summary = rowsSummary(section.rows, "row", options);
    if (summary.length > 0) {
      return `${heading("section")} Section ${index + 1}${maybeSectionId}\n\n${summary}`;
    }
    return "";
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
    return tileSummaries;
  });
  return summaries.filter((summary) => summary.length > 0).join("\n\n");
}

function tileTitle(tile: INormalizedTile): string {
  if (!tile.model) {
    console.log("No model for tile", tile);
  }
  return tile.model.title ? ` (${tile.model.title})` : "";
}

export function tilesSummary(tiles: INormalizedTile[], headingLevel: HeadingLevel, options: AiSummarizerOptions): string {
  return tiles.map((tile) => {
    const summary = tileSummary(tile, options);
    if (summary) {
      const tileHeading = `${heading(headingLevel)} Tile ${tile.number}${tileTitle(tile)}`;
      return `${tileHeading}\n\n${summary}`;
    }
    return "";
  })
  .filter((summary) => summary.length > 0)
  .join("\n\n");
}

export function tileSummary(tile: INormalizedTile, options: AiSummarizerOptions): string {
  const content: any = tile.model.content;
  const {type} = content;
  let result: any = "(no content available)";
  let textFormat = "Markdown";

  switch (type) {
    case "Image":
      result = options.minimal ? "" : "This tile contains a static image. No additional information is available.";
      break;

    case "Text":

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

      result = options.minimal ? `\`\`\`text\n${result || ""}\n\`\`\``
       : `This tile contains the following ${textFormat} text content delimited below by a text code fence:\n\n\`\`\`text\n${result || ""}\n\`\`\``;
      break;

    case "Table":
      result = `This tile contains a table`;
      if (tile.sharedDataSet) {
        result += ` which uses the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
      }
      break;

    case "Drawing":
      result = options.minimal ? "" : `This tile contains a drawing.`;
      break;

    case "Placeholder":
      result = '';
      break;

    default:
      try {
        result = generateTileDescription(content);
      } catch (error) {
        console.error("Error generating description for tile content:", error);
        result = "An error occurred while generating the description.";
      }
      result = `This tile contains ${type.toLowerCase()} content.\n\n${result}${options.includeModel ? `\n\n${JSON.stringify(tile)}` : ""}`;
      break;
  }

  return result;
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
