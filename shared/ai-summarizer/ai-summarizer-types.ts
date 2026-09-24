
// We can't load actual interfaces from src/models in this context.
export type DocumentContentSnapshotType = any;

// The parts of a document's sharedModelMap that normalize() reads. DocumentContentSnapshotType is
// `any` above because shared/ cannot import the real MST snapshot type without pulling in code
// that reaches React — so rather than casting through `any` at each access, this describes
// structurally just what is consumed here.
export interface SharedVariableSnapshot {
  description?: string;
  displayName?: string;
  expression?: string;
  id: string;
  labels?: string[];
  name?: string;
  unit?: string;
  value?: number;
}

export interface SharedAttributeSnapshot {
  id: string;
  name: string;
  units?: string;
  values?: string[];
  formula?: { display?: string };
}

export interface SharedModelMapEntry {
  sharedModel?: {
    type?: string;
    id?: string;
    providerId?: string;
    // Optional even on a SharedDataSet: a malformed entry should cost the reader that model
    // rather than throwing and losing the whole document's summary.
    dataSet?: {
      id: string;
      // Authored, not guaranteed -- a curriculum SharedDataSet entry can omit it (see
      // NormalizedDataSet.name below, which carries the same optionality through).
      name?: string;
      attributes?: SharedAttributeSnapshot[];
      cases?: unknown[];
    };
    variables?: SharedVariableSnapshot[];
  };
  tiles?: string[];
}
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
  // What the column is measured in, when the author gave it one. A bare "39" is not the same
  // reading as "39 mV", and the student's own table shows the unit.
  units?: string;
  values: string[];
}

export interface NormalizedDataSet {
  id: string;
  providerId: string;
  // Authored, not guaranteed -- a curriculum SharedDataSet entry can omit it.
  name?: string;
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
  // What the variable is FOR, as the shared model records it: "input" or "output", plus the
  // binding that names the device — "sensor:emg-reading", "live-output:Grabber". Without these a
  // variable is a number with a name, and nothing downstream can tell the reading a Dataflow
  // program consumes from the position it controls. Also carries rendering hints
  // ("decimalPlaces:0", "__volatile__"); a consumer keeps what it needs.
  labels?: string[];
  name?: string;
  // The shared model this variable belongs to, and the tiles referencing that model. Variables
  // arrive as one flat list across every shared model, so without these a consumer cannot tell
  // which variables belong together or which tiles read them. NormalizedDataSet already carries
  // the same linkage.
  sharedModelId?: string;
  tileIds?: string[];
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
   * How much of each data set to write out, in the document-level "Data Sets" summary at the end
   * (documentSummary in ai-summarizer.ts). `full` (the default) prints every case as an uncapped
   * markdown table; `schema-only` keeps the heading, attributes, and case count but leaves the case
   * data out.
   *
   * A Table tile backed by a shared data set (the modern, runtime shape) shows row data (capped at
   * TABLE_MARKDOWN_ROW_CAP) only when this is explicitly "full" -- unset or "schema-only" both
   * leave it silent, unlike the document-level summary above. A legacy, curriculum-authored table
   * (columns stored directly on the tile) reads this option differently; see handle-table-tile.ts.
   */
  dataSetTables?: "full" | "schema-only";
  /**
   * If true, an image tile in `minimal` mode is summarized as `(image: filename.png)` instead of
   * the empty string, so a reader can see where a section relied on a picture the summarizer
   * cannot otherwise describe. Off by default so existing student-document summaries are unchanged.
   */
  imageFilenames?: boolean;
}
