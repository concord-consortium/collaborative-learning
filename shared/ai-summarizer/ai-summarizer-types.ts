
// We can't load actual interfaces from src/models in this context.
export type DocumentContentSnapshotType = any;
export type ITileModelSnapshotOut = any;

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

export interface AiSummarizerOptions {
  includeModel?: boolean; // If true, include the full JSON model in the output
  minimal?: boolean;      // If true, skip all boilerplate and headers and just return the text content
  tileHandlers?: TileHandler[];
}
