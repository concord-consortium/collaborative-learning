import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";
import {
  IDocumentImportSnapshot, isOriginalAuthoredTileModel, isOriginalSectionHeaderContent, OriginalTileModel
} from "./document-content-import-types";
import { TileRowModel, TileRowModelType } from "./tile-row";

function migrateTile(content: DocumentContentModelType, tile: OriginalTileModel) {
  if (isOriginalSectionHeaderContent(tile.content)) {
    const { sectionId } = tile.content;
    content.setImportContext(sectionId);
    content.addSectionHeaderRow(sectionId);
  }
  else if (isOriginalAuthoredTileModel(tile)) {
    const row = TileRowModel.create({});
    content.insertRow(row);
    content.addImportedTileToRow(tile, row);
  }
}

function migrateRow(content: DocumentContentModelType, tiles: OriginalTileModel[]) {
  let row: TileRowModelType | undefined;
  tiles.forEach((tile) => {
    // If this is a section header then skip it
    if (!isOriginalAuthoredTileModel(tile)) return;

    if (!row) {
      row = TileRowModel.create({});
      content.insertRow(row);
    }

    content.addImportedTileToRow(tile, row);
  });
}

export function migrateSnapshot(snapshot: IDocumentImportSnapshot): any {
  const docContent = DocumentContentModel.create();
  const { tiles: tilesOrRows, sharedModels, annotations } = snapshot;

  // Add just the shared model first without its tile references
  // When the tiles are added next they might refer to objects in
  // the shared model, so those shared model objects need to exist first.
  sharedModels?.forEach((entry) => {
    const {sharedModel} = entry;
    const id = sharedModel.id;
    if (!id) {
      /* istanbul ignore next */
      console.warn("cannot import a shared model without an id", sharedModel);
      return;
    }
    const newEntry = {sharedModel};
    docContent.addSharedModelFromImport(id, newEntry);
  });

  tilesOrRows.forEach(tileOrRow => {
    if (Array.isArray(tileOrRow)) {
      migrateRow(docContent, tileOrRow);
    }
    else {
      migrateTile(docContent, tileOrRow);
    }
  });

  // Now add the tile references these references are in
  // the `tiles` and `provider` properties. This is done with a basic
  // applySnapshot. The content of the shared model should not have changed
  // so this will just add the tiles and provider properties.
  sharedModels?.forEach((originalEntry) => {
    const id = originalEntry.sharedModel.id;
    if (!id) {
      /* istanbul ignore next */
      console.warn("cannot setup a shared model without an id", originalEntry.sharedModel);
      return;
    }

    const importedEntry = docContent.sharedModelMap.get(id);
    if (!importedEntry) {
      /* istanbul ignore next */
      console.warn("cannot find shared model on the second pass of import", originalEntry.sharedModel);
      return;
    }
    applySnapshot(importedEntry, originalEntry);
  });

  annotations?.forEach(entry => {
    const id = entry.id;
    if (!id) {
      /* istanbul ignore next */
      console.warn("cannot import an annotation without an id", entry);
      return;
    }
    docContent.addAnnotationFromImport(id, entry);
  });

  return getSnapshot(docContent);
}
