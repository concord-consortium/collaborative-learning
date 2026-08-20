
// We can't load actual interfaces from src/models in this context.
export type DocumentContentSnapshotType = any;
export type ITileModelSnapshotOut = any;

// Per-unit Dataflow Live Output config, mirrored onto tile content so the (snapshot-only) summarizer
// can describe it. Defined here rather than in src/plugins so both the summarizer and the model share
// one type — the backend summarizer can't import from src/plugins.
export interface IDataflowOutputConfig {
  servoInputMode?: string;       // "proportion" when set; absent = degrees
  allowedOutputTypes?: string[]; // restricted Live Output type names; absent = full list
}

export interface NormalizedSection {
  rows: INormalizedRow[];
  sectionId?: string;
}

export interface NormalizedAttribute {
  formula?: string;
  id: string;
  name: string;
  values: string[];
}

export interface NormalizedDataSet {
  id: string;
  providerId: string;
  name: string;
  tileIds: string[];
  attributes: NormalizedAttribute[];
  numCases: number;
  data: string[][];
  sharedDataSetId?: string;
}

export interface NormalizedVariable {
  description?: string;
  displayName?: string;
  expression?: string;
  id: string;
  name?: string;
  unit?: string;
  value?: number;
}

export interface INormalizedTile {
  model: ITileModelSnapshotOut;
  number: number;
  sharedDataSet?: NormalizedDataSet
}

export interface INormalizedRow {
  tiles: INormalizedTile[];
  number: number;
}

export interface NormalizedModel {
  sections: NormalizedSection[];
  dataSets: NormalizedDataSet[];
  variables: NormalizedVariable[];
}

export type TileMap = Record<string, ITileModelSnapshotOut>;

export interface TileHandlerBaseParams {
  dataSets: NormalizedDataSet[];
  headingLevel: number;
  options: AiSummarizerOptions;
  tileMap?: TileMap;
}
export interface TileHandlerParams extends TileHandlerBaseParams {
  tile: INormalizedTile;
}
export interface TilesHandlerParams extends TileHandlerBaseParams {
  tiles: INormalizedTile[];
}
export interface TileHandler {
  (params: TileHandlerParams): string|undefined;
}

export interface AiSummarizerOptions {
  includeModel?: boolean; // If true, include the full JSON model in the output
  minimal?: boolean;      // If true, skip all boilerplate and headers and just return the text content
  tileHandlers?: TileHandler[];
  /**
   * How much of each data set to write out.
   *
   * `full` (the default, and what every caller got before this existed) describes the data set and
   * then prints every case as a markdown table. `schema-only` keeps the heading, the attributes
   * table, the formulas and the case count, and leaves the case data out — the shape of the data
   * without the data itself. A large table can be most of a document's summary, and whether the
   * model needs the rows to categorize a design is exactly the sort of thing worth measuring.
   */
  dataSetTables?: "full" | "schema-only";
}
