/* eslint-disable max-len */

/*
Creates markdown versions of CLUE documents, suitable for feeding to AI models.
TODO: Support more tile types.
*/

import {
  AiSummarizerOptions, DocumentContentSnapshotType, INormalizedTile, NormalizedDataSet,
  NormalizedModel, NormalizedSection, NormalizedVariable, TileMap
} from "./ai-summarizer-types";
import {
  generateAttributesMarkdownTable, generateMarkdownTable, generateVariablesMarkdownTable, heading, pluralize
} from "./ai-summarizer-utils";
import { rowsSummary, tileSummary } from "./ai-tile-summarizer";

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
export function summarizeCurriculum(
  content: any, dataSets: NormalizedDataSet[] = [], headingLevel = 1, tileMap?: TileMap
): string {
  if ("tiles" in content) {
    return summarizeCurriculum(content.tiles, dataSets, headingLevel, tileMap);
  }

  if (Array.isArray(content)) {
    return content.map(contentItem => summarizeCurriculum(contentItem, dataSets, headingLevel, tileMap)).join("\n\n");
  }

  if ("content" in content) {
    const normalizedTile: INormalizedTile = {
      model: content,
      number: 0,
    };
    return tileSummary({
      dataSets,
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
  const variables: NormalizedVariable[] = [];
  const { rowOrder, rowMap, tileMap, sharedModelMap } = model || {};

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
        const { attributes, cases, name } = sharedModel.dataSet;
        const dataSet: NormalizedDataSet = {
          id: sharedModel.dataSet.id,
          providerId: sharedModel.providerId,
          name,
          tileIds: (entry as any).tiles.map((tile: any) => `${tile}`),
          attributes: (attributes || []).map((attr: any) => ({
            id: attr.id,
            name: attr.name,
            values: attr.values || [],
            formula: attr.formula?.display || undefined
          })),
          numCases: cases.length,
          data: [],
          sharedDataSetId: id
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
      } else if (sharedModel?.type === "SharedVariables") {
        sharedModel.variables.forEach((v: any) => (variables.push({
          description: v.description,
          displayName: v.displayName,
          expression: v.expression,
          id: v.id,
          name: v.name,
          unit: v.unit,
          value: v.value
        })));
      }
    }
  }

  // Implement normalization logic here if needed
  return {
    normalizedModel: {
      sections,
      dataSets,
      variables,
    },
    tileMap: tileMap as TileMap | undefined,
  };
}

export function summarize(normalizedModel: NormalizedModel, tileMap: TileMap | undefined, options: AiSummarizerOptions): string {
  const { sections, dataSets, variables } = normalizedModel;
  if (sections.length === 0) {
    return documentSummary(
      options.minimal ? "" : "This is an empty CLUE document with no content.",
      dataSets,
      variables,
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
      variables,
      rowsSummary({
        dataSets,
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
    variables,
    sectionsSummary({normalizedModel, tileMap, options, headingLevel: 2}),
    options,
    1
  );
}

export function documentSummary(preamble: string, dataSets: NormalizedDataSet[], variables: NormalizedVariable[], summary: string = "", options: AiSummarizerOptions, headingLevel: number = 1): string {
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

        let formulaSummary = "";
        dataSet.attributes.forEach(attr => {
          if (attr.formula) {
            formulaSummary += `- Column "${attr.name}" is calculated by the formula \`${attr.formula}\`.\n`;
          }
        });
        if (formulaSummary.length > 0) formulaSummary += "\n";

        const tileWord = pluralize(dataSet.tileIds.length, "tile", "tiles");
        const attributeWord = pluralize(dataSet.attributes.length, "attribute", "attributes");
        const caseWord = pluralize(dataSet.numCases, "case", "cases");
        return heading(headingLevel + 2, dataSet.name) +
          `This data set has an id of ${dataSet.id} and is used in ${dataSet.tileIds.length} ${tileWord}.\n` +
          `It contains ${dataSet.attributes.length} ${attributeWord}, described in the following Markdown table.\n\n` +
          `${generateAttributesMarkdownTable(dataSet.attributes)}\n\n` +
          formulaSummary +
          `There are ${dataSet.numCases} ${caseWord} in this data set, shown below in a Markdown table.\n\n` +
          `${generateMarkdownTable(dataSet.attributes.map(a => a.name), dataSet.data)}\n`;
      }).join("\n\n")
    : "";
  const variablsSummary = summary.length > 0 && variables.length > 0
    ? `\n${heading(headingLevel + 1, "Shared Variables")}` +
      `The document contains ${variables.length} ${pluralize(variables.length, "variable", "variables")}:\n\n` +
      `${generateVariablesMarkdownTable(variables)}\n\n`
    : "";

  const extra = options.minimal ? "" : `${layoutInfo}${preamble}${maybeTileInfo}${maybeDataSetInfo}\n\n`;
  return (
    heading(headingLevel, "CLUE Document Summary") +
    extra +
    summary + "\n" +
    dataSetSummary + "\n" +
    variablsSummary + "\n" +
    heading(headingLevel, "End of CLUE Document Summary")
  );
}

interface SectionsSummaryParams {
  normalizedModel: NormalizedModel;
  tileMap?: TileMap;
  options: AiSummarizerOptions;
  headingLevel: number;
}
export function sectionsSummary({normalizedModel, tileMap, options, headingLevel}: SectionsSummaryParams): string {
  const { dataSets } = normalizedModel;
  const summaries = normalizedModel.sections.map((section, index) => {
    const maybeSectionId = section.sectionId ? ` (${section.sectionId})` : "";
    return heading(headingLevel, `Section ${index + 1}${maybeSectionId}`) +
      rowsSummary({
        dataSets,
        rows: section.rows,
        tileMap,
        headingLevel: headingLevel + 1,
        options
      });
  });
  return summaries.join("\n\n");
}

/* eslint-enable max-len */
