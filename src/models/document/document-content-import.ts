import { cloneDeep } from "lodash";
import { getSnapshot } from "mobx-state-tree";
import { ITileModelSnapshotIn } from "../tiles/tile-model";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";
import { INewTileOptions } from "./document-content-types";
import {
  IDocumentImportSnapshot, isOriginalAuthoredTileModel, isOriginalSectionHeaderContent,
  OriginalAuthoredTileModel, OriginalTileModel
} from "./document-content-import-types";

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

// FIXME: this does not handle tiles that refer to shared models correctly.
// The tiles are created first and if they have references to the shared
// model, then those references will be broken because the shared model
// doesn't exist yet. Many tiles use "afterAttach" to work with their sharedModel
// so that is also going to be run before the actual shared model is added.
// For example the diagram-view might try to create a shared variables model when it is
// first attached. However in practice this might not be an issue because the
// the shared model manager might not be ready yet at this point, so the reaction
// in after attach will wait for the shared model manager to be ready.
export function migrateSnapshot(snapshot: IDocumentImportSnapshot): any {
  const docContent = DocumentContentModel.create();
  const { tiles: tilesOrRows, sharedModels, annotations } = snapshot;
  tilesOrRows.forEach(tileOrRow => {
    if (Array.isArray(tileOrRow)) {
      migrateRow(docContent, tileOrRow);
    }
    else {
      migrateTile(docContent, tileOrRow);
    }
  });

  sharedModels?.forEach((entry) => {
    const id = entry.sharedModel.id;
    if (!id) {
      console.warn("cannot import a shared model without an id", entry.sharedModel);
      return;
    }
    docContent.addSharedModelFromImport(id, entry);
  });

  annotations?.forEach(entry => {
    const id = entry.id;
    if (!id) {
      console.warn("cannot import an annotation without an id", entry);
      return;
    }
    docContent.addAnnotationFromImport(id, entry);
  });

  return getSnapshot(docContent);
}
