import { IArrowAnnotation } from "../annotations/arrow-annotation";
import { SharedModelSnapshotType } from "../shared/shared-model";
import { IDragSharedModelItem } from "../shared/shared-model-manager";
import { IDragTileItem } from "../tiles/tile-model";
import { IDropRowInfo } from "./tile-row";

export interface IDocumentAddTileOptions {
  title?: string;
  addSidecarNotes?: boolean;
  url?: string;
}

export interface INewTileOptions {
  locationInRow?: string;
  rowHeight?: number;
  rowId?: string; // The id of the row to add the tile to
  rowIndex?: number; // The position to add a new row
  tileId?: string;
  title?: string;
}

export interface INewRowTile {
  rowId: string;
  tileId: string;
  additionalTileIds?: string[];
}
export type NewRowTileArray = Array<INewRowTile | undefined>;

export interface IDocumentContentAddTileOptions extends IDocumentAddTileOptions {
  insertRowInfo?: IDropRowInfo;
}

export interface IDragToolCreateInfo {
  toolId: string;
  title?: string;
}

export interface ITileCountsPerSection {
  [key: string]: number;
}

export interface IDragTilesData {
  sourceDocId: string;
  tiles: IDragTileItem[];
  sharedModels: IDragSharedModelItem[];
  annotations: IArrowAnnotation[];
}

export interface PartialTile {
  id: string;
}
export interface PartialSharedModelEntry {
  sharedModel: SharedModelSnapshotType;
  tiles: PartialTile[];
}
