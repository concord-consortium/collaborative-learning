import { cloneDeep } from "lodash";
import { getSnapshot } from "mobx-state-tree";
import { DisplayUserType } from "../stores/user-types";
import { ITileModelSnapshotIn } from "../tiles/tile-model";
import { DocumentContentModel, DocumentContentModelType, INewTileOptions } from "./document-content";

/*
 * For ease of authoring, CLUE documents and tiles generally support an import format that is
 * simpler to author/edit than the full-blown serialization format. For instance, in most cases
 * objects ids are not required in authored content and will be added automatically during the
 * import process. The acceptable import format for tile-specific content is generally
 * determined by the tile itself.
 */

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

interface OriginalTileLayoutModel {
  height?: number;
}

interface OriginalSectionHeaderContent {
  isSectionHeader: true;
  sectionId: string;
}

function isOriginalSectionHeaderContent(content: IAuthoredTileContent | OriginalSectionHeaderContent)
          : content is OriginalSectionHeaderContent {
  return !!content?.isSectionHeader && !!content.sectionId;
}

interface OriginalTileModel {
  id?: string;
  display?: DisplayUserType;
  layout?: OriginalTileLayoutModel;
  content: IAuthoredTileContent | OriginalSectionHeaderContent;
}
interface OriginalAuthoredTileModel extends OriginalTileModel {
  content: IAuthoredTileContent;
}
function isOriginalAuthoredTileModel(tile: OriginalTileModel): tile is OriginalAuthoredTileModel {
  return !!(tile.content as IAuthoredTileContent)?.type && !tile.content.isSectionHeader;
}

export type OriginalTilesSnapshot = Array<OriginalTileModel | OriginalTileModel[]>;

function addImportedTileInNewRow(
          content: DocumentContentModelType,
          tile: OriginalAuthoredTileModel,
          options: INewTileOptions) {
  const id = tile.id || content.getNextTileId(tile.content.type);
  const tileSnapshot = { id, ...tile };
  return content.addTileSnapshotInNewRow(tileSnapshot as ITileModelSnapshotIn, options);
}

function addImportedTileInExistingRow(
          content: DocumentContentModelType,
          tile: OriginalAuthoredTileModel,
          options: INewTileOptions) {
  const id = tile.id || content.getNextTileId(tile.content.type);
  const tileSnapshot = { id, ...tile };
  return content.addTileSnapshotInExistingRow(tileSnapshot as ITileModelSnapshotIn, options);
}

function migrateTile(content: DocumentContentModelType, tile: OriginalTileModel) {
  const { layout, ...newTile } = cloneDeep(tile);
  const tileHeight = layout?.height;
  if (isOriginalSectionHeaderContent(newTile.content)) {
    const { sectionId } = newTile.content;
    content.setImportContext(sectionId);
    content.addSectionHeaderRow(sectionId);
  }
  else if (isOriginalAuthoredTileModel(newTile)) {
    addImportedTileInNewRow(content, newTile, { rowIndex: content.rowCount, rowHeight: tileHeight });
  }
}

function migrateRow(content: DocumentContentModelType, tiles: OriginalTileModel[]) {
  let insertRowIndex = content.rowCount;
  tiles.forEach((tile, tileIndex) => {
    const { layout, ...newTile } = cloneDeep(tile);
    const tileHeight = layout?.height;
    const options = { rowIndex: insertRowIndex, rowHeight: tileHeight };
    if (isOriginalAuthoredTileModel(newTile)) {
      if (tileIndex === 0) {
        const newRowInfo = addImportedTileInNewRow(content, newTile, options);
        const newRowIndex = content.getRowIndex(newRowInfo.rowId);
        (newRowIndex >= 0) && (insertRowIndex = newRowIndex);
      }
      else {
        addImportedTileInExistingRow(content, newTile, options);
      }
    }
  });
}

export function migrateSnapshot(snapshot: any): any {
  const docContent = DocumentContentModel.create();
  const tilesOrRows: OriginalTilesSnapshot = snapshot.tiles;
  tilesOrRows.forEach(tileOrRow => {
    if (Array.isArray(tileOrRow)) {
      migrateRow(docContent, tileOrRow);
    }
    else {
      migrateTile(docContent, tileOrRow);
    }
  });
  return getSnapshot(docContent);
}
