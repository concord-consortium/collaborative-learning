/*
 * For ease of authoring, CLUE documents and tiles generally support an import format that is
 * simpler to author/edit than the full-blown serialization format. For instance, in most cases
 * objects ids are not required in authored content and will be added automatically during the
 * import process. The acceptable import format for tile-specific content is generally
 * determined by the tile itself.
 */

import { SharedModelEntrySnapshotType } from "./shared-model-entry";
import { IArrowAnnotationSnapshot } from "../annotations/arrow-annotation";
import { DisplayUserType } from "../stores/user-types";

// authored content is converted to current content on the fly
export interface IAuthoredBaseTileContent {
  type: string;
}

export interface IAuthoredTileContent extends IAuthoredBaseTileContent {
  [key: string]: any;
}

export interface IAuthoredTile {
  content: IAuthoredTileContent;
}

export interface IAuthoredDocumentContent {
  tiles: Array<IAuthoredTile | IAuthoredTile[]>;
}

export interface OriginalTileLayoutModel {
  height?: number;
}

export interface OriginalSectionHeaderContent {
  isSectionHeader: true;
  sectionId: string;
}

export function isOriginalSectionHeaderContent(content: IAuthoredTileContent | OriginalSectionHeaderContent)
          : content is OriginalSectionHeaderContent {
  return !!content?.isSectionHeader && !!content.sectionId;
}

export interface OriginalTileModel {
  id?: string;
  title?: string;
  display?: DisplayUserType;
  layout?: OriginalTileLayoutModel;
  content: IAuthoredTileContent | OriginalSectionHeaderContent;
}
export interface OriginalAuthoredTileModel extends OriginalTileModel {
  content: IAuthoredTileContent;
}
export function isOriginalAuthoredTileModel(tile: OriginalTileModel): tile is OriginalAuthoredTileModel {
  return !!(tile.content as IAuthoredTileContent)?.type && !tile.content.isSectionHeader;
}

export type OriginalTilesSnapshot = Array<OriginalTileModel | OriginalTileModel[]>;

export interface IDocumentImportSnapshot {
  annotations?: IArrowAnnotationSnapshot[];
  sharedModels?: SharedModelEntrySnapshotType[];
  tiles: OriginalTilesSnapshot;
}

export function isImportDocument(snap: any): snap is IDocumentImportSnapshot {
  return snap?.tiles != null;
}
