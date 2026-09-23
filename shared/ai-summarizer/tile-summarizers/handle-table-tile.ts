import { AiSummarizerOptions, NormalizedAttribute, NormalizedDataSet, TileHandlerParams } from "../ai-summarizer-types";
import { generateMarkdownTable, pluralize } from "../ai-summarizer-utils";

// After this many rows a table is truncated with a "...and N more rows" note. Applies regardless
// of AiSummarizerOptions.dataSetTables -- unlike the document-level "Data Sets" summary, "full"
// here only decides whether row data is shown at all, not whether it's capped.
export const TABLE_MARKDOWN_ROW_CAP = 20;

interface InlineTableColumn {
  name: string;
  values?: Array<string | number>;
}

export function handleTableTile({ tile, dataSets, options }: TileHandlerParams): string|undefined {
  const content: any = tile.model.content;
  if (content.type !== "Table") { return undefined; }

  // The legacy/curriculum-authored shape stores column data directly on the tile; the modern
  // runtime shape stores it in a SharedDataSet the tile refers to (never both).
  const inlineColumns: InlineTableColumn[] | undefined = content.columns;
  if (inlineColumns && inlineColumns.length > 0) {
    return `This tile contains a table.\n\n${summarizeInlineColumns(inlineColumns, options)}`;
  }

  // `tile.sharedDataSet` is set by normalize() for a runtime document; a curriculum section has no
  // such pre-linking step, so fall back to the same check normalize() uses to set it: the table
  // tile's own id among the data set's referencing tiles. providerId (the id of the tile that
  // created the data set) is a second-choice fallback in case tileIds is ever incomplete.
  const sharedDataSet = tile.sharedDataSet || dataSets.find(ds =>
    ds.tileIds.includes(tile.model.id) || ds.providerId === tile.model.id
  );
  if (sharedDataSet) {
    // dataSet.name can be missing -- see NormalizedDataSet.
    const nameClause = sharedDataSet.name
      ? ` which uses the "${sharedDataSet.name}" (${sharedDataSet.id}) data set`
      : ` which uses data set ${sharedDataSet.id}`;
    // Unlike the document-level "Data Sets" summary (ai-summarizer.ts), where an omitted
    // `dataSetTables` means "full", this tile stays silent about the data set's contents unless
    // `dataSetTables` is explicitly "full" or "schema-only".
    if (!options.dataSetTables) {
      return `This tile contains a table${nameClause}.`;
    }
    return `This tile contains a table${nameClause}.\n\n${summarizeDataSet(sharedDataSet, options)}`;
  }

  return "This tile contains a table";
}

function summarizeInlineColumns(columns: InlineTableColumn[], options: AiSummarizerOptions): string {
  const headers = columns.map(col => col.name);
  const rowCount = columns.reduce((max, col) => Math.max(max, col.values?.length ?? 0), 0);

  if (options.dataSetTables === "schema-only") {
    return schemaSummary(headers, rowCount);
  }

  const rows: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(columns.map(col => `${col.values?.[i] ?? ""}`));
  }
  return renderCappedTable(headers, rows);
}

function summarizeDataSet(dataSet: NormalizedDataSet, options: AiSummarizerOptions): string {
  const headers = dataSet.attributes.map((attr: NormalizedAttribute) => attr.name);
  if (options.dataSetTables === "schema-only") {
    return schemaSummary(headers, dataSet.numCases);
  }
  return renderCappedTable(headers, dataSet.data);
}

function schemaSummary(headers: string[], rowCount: number): string {
  const columnWord = pluralize(headers.length, "column", "columns");
  const rowWord = pluralize(rowCount, "row", "rows");
  return `It has ${headers.length} ${columnWord} (${headers.join(", ")}) and ${rowCount} ${rowWord}.`;
}

function renderCappedTable(headers: string[], rows: string[][]): string {
  if (rows.length <= TABLE_MARKDOWN_ROW_CAP) {
    return generateMarkdownTable(headers, rows);
  }
  const shown = rows.slice(0, TABLE_MARKDOWN_ROW_CAP);
  const remaining = rows.length - TABLE_MARKDOWN_ROW_CAP;
  return `${generateMarkdownTable(headers, shown)}\n\n...and ${remaining} more ${pluralize(remaining, "row", "rows")}.`;
}
