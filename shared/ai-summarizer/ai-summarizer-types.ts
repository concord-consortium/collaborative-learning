
// We can't load actual interfaces from src/models in this context.
export type DocumentContentSnapshotType = any;
export type ITileModelSnapshotOut = any;

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
}
