import type {  DocumentContentSnapshotType } from "src/models/document/document-content";
import type { ITileModelSnapshotOut } from "src/models/tiles/tile-model";
import { slateToMarkdown } from "./slate-to-markdown";
import { jsonToMarkdownWithDescriptions } from "./json-to-markdown";

export interface INormalizedTile {
  model: ITileModelSnapshotOut;
  number: number;
}

export interface INormalizedRow {
  tiles: INormalizedTile[];
  number: number;
}

export interface NormalizedSection {
  rows: INormalizedRow[];
  sectionId?: string;
}

export interface NormalizedModel {
  sections: NormalizedSection[];
}

export default function aiSummarizer(content: any): string {
  const stringContent = stringifyContent(content);
  const parsedContent = parseContent(stringContent);
  const normalizedModel = normalize(parsedContent);
  const summarizedContent = summarize(normalizedModel);
  return summarizedContent;
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
  const {rowOrder, rowMap, tileMap} = model;

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

  // Implement normalization logic here if needed
  return {
    sections,
  };
}

export function summarize(normalizedModel: NormalizedModel): string {
  const {sections} = normalizedModel;
  if (sections.length === 0) {
    return documentSummary(
      "This is an empty CLUE document with no content."
    );
  }

  if (sections.length === 1 && !sections[0].sectionId) {
    return documentSummary(
      "The CLUE document consists of one or more rows, with one or more tiles within each row.",
       rowsSummary(sections[0].rows, "rowWithoutSection")
    );
  }

  return documentSummary(
    // eslint-disable-next-line max-len
    "The CLUE document consists of one or more sections containing one or more rows, with one or more tiles within each row.",
    sectionsSummary(normalizedModel)
  );
}

export const headingLevels = {
  documentSummary: 1,
  section: 2,
  row: 3,
  tile: 4,
  rowWithoutSection: 2,
  tileWithoutSection: 3,
} as const;
export type HeadingLevel = keyof typeof headingLevels;

export function heading(headingLevel: HeadingLevel): string {
  const level = headingLevels[headingLevel];
  if (!level) {
    throw new Error("Invalid heading level");
  }
  return "#".repeat(level) + " ";
}

export function documentSummary(preamble: string, summary: string = ""): string {
  const maybeTileInfo = summary.length > 0
    ? " Tiles are either static UI elements or interactive elements " +
      "that students can use."
    : "";
  const layoutInfo = summary.length > 0
    ? "The markdown below summarizes the CLUE document's structure and content.  "
    : "";
  return (
    `${heading("documentSummary")} CLUE Document Summary\n\n` +
    `${layoutInfo}${preamble}${maybeTileInfo}\n\n` +
    `${summary}\n`
  );
}

export function sectionsSummary(normalizedModel: NormalizedModel): string {
  const summaries = normalizedModel.sections.map((section, index) => {
    const maybeSectionId = section.sectionId ? ` (${section.sectionId})` : "";
    return `${heading("section")} Section ${index + 1}${maybeSectionId}\n\n${rowsSummary(section.rows, "row")}`;
  });
  return summaries.join("\n\n");
}

export function rowsSummary(rows: INormalizedRow[], headingLevel: HeadingLevel): string {
  const summaries = rows.map((row) => {
    const tileSummaries = tilesSummary(row.tiles, headingLevel === "rowWithoutSection" ? "tileWithoutSection" : "tile");
    return `${heading(headingLevel)} Row ${row.number}\n\n${tileSummaries}`;
  });
  return summaries.join("\n\n");
}

export function tilesSummary(tiles: INormalizedTile[], headingLevel: HeadingLevel): string {
  return tiles.map((tile) => {
    const maybeTitle = tile.model.title ? ` (${tile.model.title})` : "";
    return `${heading(headingLevel)} Tile ${tile.number}${maybeTitle}\n\n${tileSummary(tile)}`;
  }).join("\n\n");
}

export function tileSummary(tile: INormalizedTile): string {
  const content: any = tile.model.content;
  const {type} = content;
  let result: any = "(no content available)";
  let textFormat = "Markdown";

  switch (type) {
    case "Image":
      result = "This tile contains a static image. No additional information is available.";
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

      // eslint-disable-next-line max-len
      result = `This tile contains the following ${textFormat} text content delimited here by a code fence:\n\n\`\`\`\n${result || ""}\n\`\`\``;
      break;

    default:
      result = jsonToMarkdownWithDescriptions(content);
      result = `This tile contains ${type.toLowerCase()} content.\n\n${result.description}`;
      break;
  }

  return result;
}
