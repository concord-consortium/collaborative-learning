import { cloneDeep } from "lodash";
import { getSnapshot } from "mobx-state-tree";
import { SectionModelType } from "../curriculum/section";
import { DisplayUserType } from "../stores/user-types";
import { ToolTileSnapshotInType } from "../tools/tool-tile";
import { DocumentContentModel, DocumentContentModelType, INewTileOptions } from "./document-content";

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

interface OriginalToolTileModel {
  id?: string;
  display?: DisplayUserType;
  layout?: OriginalTileLayoutModel;
  content: IAuthoredTileContent | OriginalSectionHeaderContent;
}
interface OriginalAuthoredToolTileModel extends OriginalToolTileModel {
  content: IAuthoredTileContent;
}
function isOriginalAuthoredToolTileModel(tile: OriginalToolTileModel): tile is OriginalAuthoredToolTileModel {
  return !!(tile.content as IAuthoredTileContent)?.type && !tile.content.isSectionHeader;
}

type OriginalTilesSnapshot = Array<OriginalToolTileModel | OriginalToolTileModel[]>;

function addImportedTileInNewRow(
          content: DocumentContentModelType,
          tile: OriginalAuthoredToolTileModel,
          options: INewTileOptions) {
  const id = tile.id || content.getNextTileId(tile.content.type);
  const tileSnapshot = { id, ...tile };
  return content.addTileSnapshotInNewRow(tileSnapshot as ToolTileSnapshotInType, options);
}

function addImportedTileInExistingRow(
          content: DocumentContentModelType,
          tile: OriginalAuthoredToolTileModel,
          options: INewTileOptions) {
  const id = tile.id || content.getNextTileId(tile.content.type);
  const tileSnapshot = { id, ...tile };
  return content.addTileSnapshotInExistingRow(tileSnapshot as ToolTileSnapshotInType, options);
}

function migrateTile(content: DocumentContentModelType, tile: OriginalToolTileModel) {
  const { layout, ...newTile } = cloneDeep(tile);
  const tileHeight = layout?.height;
  if (isOriginalSectionHeaderContent(newTile.content)) {
    const { sectionId } = newTile.content;
    content.setImportContext(sectionId);
    content.addSectionHeaderRow(sectionId);
  }
  else if (isOriginalAuthoredToolTileModel(newTile)) {
    addImportedTileInNewRow(content, newTile, { rowIndex: content.rowCount, rowHeight: tileHeight });
  }
}

function migrateRow(content: DocumentContentModelType, tiles: OriginalToolTileModel[]) {
  let insertRowIndex = content.rowCount;
  tiles.forEach((tile, tileIndex) => {
    const { layout, ...newTile } = cloneDeep(tile);
    const tileHeight = layout?.height;
    const options = { rowIndex: insertRowIndex, rowHeight: tileHeight };
    if (isOriginalAuthoredToolTileModel(newTile)) {
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

export function createDefaultSectionedContent(sections: SectionModelType[]) {
  const tiles: OriginalToolTileModel[] = [];
  // for blank sectioned documents, default content is a section header row and a placeholder
  // tile for each section that is present in the template (the passed sections)
  sections.forEach(section => {
    tiles.push({ content: { isSectionHeader: true, sectionId: section.type }});
    tiles.push({ content: { type: "Placeholder", sectionId: section.type }});
  });
  // cast required because we're using the import format
  return DocumentContentModel.create({ tiles } as any);
}
