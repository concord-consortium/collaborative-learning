import stringify from "json-stringify-pretty-compact";
import { applySnapshot, getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { cloneDeep, each } from "lodash";
import { IDragTilesData,
         IDocumentContentAddTileOptions } from "./document-content-types";
import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import { IDropRowInfo, TileRowModel, TileRowModelType, TileRowSnapshotOutType, TileRowSnapshotType } from "./tile-row";
import {
  ArrowAnnotation, IArrowAnnotationSnapshot, isArrowAnnotationSnapshot, updateArrowAnnotationTileIds
} from "../annotations/arrow-annotation";
import { sharedModelFactory, UnknownSharedModel } from "../shared/shared-model-manager";
import { SharedModelType } from "../shared/shared-model";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { IDragTileItem, IDropTileItem, isContainerTile, ITileModel,
         ITileModelSnapshotIn,
         ITileModelSnapshotOut } from "../tiles/tile-model";
import { uniqueId } from "../../utilities/js-utils";
import { StringBuilder } from "../../utilities/string-builder";
import { SharedModelEntrySnapshotType } from "./shared-model-entry";

// Imports related to hard coding shared model duplication
import {
  getSharedDataSetSnapshotWithUpdatedIds, getUpdatedSharedDataSetIds, isSharedDataSetSnapshot,
  UpdatedSharedDataSetIds, updateSharedDataSetSnapshotWithNewTileIds
} from "../shared/shared-data-set";
import { IClueObjectSnapshot } from "../annotations/clue-object";
import { isRowListSnapshotIn, isRowListSnapshotOut } from "./row-list";


export interface ITileCopyPosition {
  rowId: string;
  sectionId?: string;
}
export interface ICopySpec {
  tiles: IDragTileItem[]
  tilePositions: Record<string, ITileCopyPosition>,
  sharedModelEntries: SharedModelEntrySnapshotType[],
  annotations: IArrowAnnotationSnapshot[],
}

// Replace IDs found in the rowMap with new IDs, stored in an id map.
const updateRowMap = (rowMap: Record<string, TileRowSnapshotOutType>, tileIdMap: Record<string, string>) => {
  const updatedRowMap: { [id: string]: TileRowSnapshotOutType; } = {};
  each(rowMap, (row, id) => {
    tileIdMap[id] = row.id = uniqueId();
    row.tiles = row.tiles.map(tileLayout => {
      tileLayout.tileId = tileIdMap[tileLayout.tileId];
      return tileLayout;
    });
    updatedRowMap[row.id] = row;
  });
  return updatedRowMap;
};

/**
 * The DocumentContentModel builds on the combination of 3 other parts:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModelWithAnnotations
 *
 * These three parts were split out so we could reduce the size of a single
 * document content model file. This splitting is constrained by a couple
 * of factors:
 * - the code needs to support actions that can apply "atomically" to the
 *   MST tree. This requires the actions are defined on a model in the tree.
 * - the code in each split out part should be able to use Typescript to
 *   to make sure it is working with the core or base document content model
 *   correctly.
 *
 * In the future it might make sense to switch to a types.compose(...) approach
 * this way multiple document content features can be put in different files
 * without having each feature depend on another feature.
 *
 * Note: the name "DocumentContent" is important because it is used in other
 * parts of the code to find a MST parent with this name.
 */
export const DocumentContentModel = DocumentContentModelWithTileDragging.named("DocumentContent")
.views(self => ({
  snapshotWithUniqueIds(asTemplate = false) {
    const snapshot = cloneDeep(getSnapshot(self));
    const tileIdMap: { [id: string]: string } = {};
    const annotationIdMap: { [id: string]: string } = {};

    snapshot.tileMap = (tileMap => {
      const _tileMap: { [id: string]: ITileModelSnapshotOut } = {};
      each(tileMap, (tile, id) => {
        tileIdMap[id] = tile.id = uniqueId();
        _tileMap[tile.id] = tile;
      });
      return _tileMap;
    })(snapshot.tileMap);

    // Update the sharedModels with new tile ids
    each(snapshot.sharedModelMap, (sharedModelEntry, id) => {
      const _tiles = cloneDeep(sharedModelEntry.tiles);
      sharedModelEntry.tiles = [];
      _tiles.forEach(tile => {
        sharedModelEntry.tiles.push(tileIdMap[tile]);
      });
      // Update references to provider
      if (sharedModelEntry.provider) {
        sharedModelEntry.provider = tileIdMap[sharedModelEntry.provider];
      }
      const sharedModel = sharedModelEntry.sharedModel;
      if ("providerId" in sharedModel && typeof sharedModel.providerId === "string") {
        sharedModel.providerId = tileIdMap[sharedModel.providerId];
      }
    });
    // TODO: Give the shared models new ids

    // Update annotations with new tile ids
    each(snapshot.annotations, (annotation, id) => {
      // TODO Move into functions for specific annotation types
      if (isArrowAnnotationSnapshot(annotation)) {
        updateArrowAnnotationTileIds(annotation, tileIdMap);
      }
      annotationIdMap[annotation.id] = uniqueId();
      annotation.id = annotationIdMap[annotation.id];
    });

    each(snapshot.tileMap, tile => {
      getTileContentInfo(tile.content.type)
        ?.contentSnapshotPostProcessor?.(tile.content, tileIdMap, asTemplate);
    });

    snapshot.rowMap = updateRowMap(snapshot.rowMap, tileIdMap);
    snapshot.rowOrder = snapshot.rowOrder.map(rowId => tileIdMap[rowId]);
    // Also update any rowMaps found nested inside tile content
    each(snapshot.tileMap, tile => {
      const tileContent = tile.content;
      if (isRowListSnapshotOut(tileContent)) {
        tileContent.rowMap = updateRowMap(tileContent.rowMap, tileIdMap);
        tileContent.rowOrder = tileContent.rowOrder.map(rowId => tileIdMap[rowId]);
      }
    });

    return snapshot;
  }
}))
.views(self => ({
  exportRowsModelsAndAnnotationsAsJson(rows: (TileRowModelType | undefined)[], options?: IDocumentExportOptions) {
    const builder = new StringBuilder();
    builder.pushLine("{");

    const includedTileIds = rows.flatMap(row => row?.tileIds ?? []);
    const sharedModels = Object.values(self.getSharedModelsUsedByTiles(includedTileIds));
    const hasSharedModels = sharedModels.length > 0;
    const annotations = Object.values(self.getAnnotationsUsedByTiles(includedTileIds));
    const hasAnnotations = annotations.length > 0;

    const tilesComma = hasSharedModels || hasAnnotations;
    builder.pushBlock(self.exportRowsAsJson(rows, self.tileMap, { ...options, appendComma: tilesComma }), 2);

    if (hasSharedModels) {
      builder.pushLine(`"sharedModels": [`, 2);
      sharedModels.forEach((sharedModel, index) => {
        const sharedModelLines = stringify(sharedModel).split("\n");
        sharedModelLines.forEach((sharedModelLine, lineIndex) => {
          const lineComma =
            lineIndex === sharedModelLines.length - 1 && index < sharedModels.length - 1
            ? "," : "";
          builder.pushLine(`${sharedModelLine}${lineComma}`, 4);
        });
      });
      const sharedModelsComma = hasAnnotations ? "," : "";
      builder.pushLine(`]${sharedModelsComma}`, 2);
    }

    if (hasAnnotations) {
      builder.pushLine(`"annotations": [`, 2);
      annotations.forEach((annotation, index) => {
        const annotationLines = stringify(annotation).split("\n");
        annotationLines.forEach((annotationLine, lineIndex) => {
          const lineComma =
            lineIndex === annotationLines.length - 1 && index < annotations.length - 1
            ? "," : "";
          builder.pushLine(`${annotationLine}${lineComma}`, 4);
        });
      });
      builder.pushLine(`]`, 2);
    }

    builder.pushLine("}");
    return builder.build();
  },
  publish() {
    return JSON.stringify(self.snapshotWithUniqueIds());
  },
  copyTilesWithSpec(updatedTiles: IDropTileItem[], copySpec: ICopySpec) {
    const targetRowMap = new Map<string, TileRowModelType>();

    updatedTiles.forEach(tile => {
      const { rowId, sectionId } = copySpec.tilePositions[tile.tileId];
      let targetRow = targetRowMap.get(rowId);
      let insertedRowIndex = self.defaultInsertRowIndex;
      const insertingRow = !targetRow && !tile.embedded;

      if (sectionId) {
        const sectionRows = self.getRowsInSection(sectionId);
        if (sectionRows.length > 0) {
          // this may seem redundant, but it's not.
          // the row index to insert is the index of the document
          // row order, not the index of the section rows.
          // the +1 is to add the new row after the last row in the section.
          const lastRow = sectionRows[sectionRows.length - 1];
          insertedRowIndex = self.getRowIndex(lastRow.id) + 1;
        }
      }

      if (insertingRow) {
        targetRow = TileRowModel.create({ sectionId });
        self.insertRow(targetRow, insertedRowIndex);
        targetRowMap.set(rowId, targetRow);
      }

      self.copyTilesIntoExistingRow([tile], {
        rowInsertIndex: 0, // this is ignored
        rowDropId: targetRow?.id,
        rowDropLocation: "right"
      }, false);
    });
  },
}))
.views(self => ({
  exportAsJson(options?: IDocumentExportOptions) {
    return self.exportRowsModelsAndAnnotationsAsJson(self.exportableRows(self.tileMap), options);
  },
  exportSectionsAsJson(options?: IDocumentExportOptions) {
    const sections: Record<string, string> = {};
    let section = "";
    let rows: (TileRowModelType | undefined)[] = [];

    self.rowOrder.forEach(rowId => {
      const row = self.getRow(rowId);
      if (row) {
        if (row.isSectionHeader) {
          if (section !== "") {
            // We've finished the last section
            sections[section] = self.exportRowsModelsAndAnnotationsAsJson(rows.filter(r => !!r), options);
          }
          section = row.sectionId ?? "unknown";
          rows = [];
        } else if (!row.isEmpty && !self.isPlaceholderRow(row)) {
          rows.push(row);
        }
      }
    });
    if (section !== "") {
      // Save the final section
      sections[section] = self.exportRowsModelsAndAnnotationsAsJson(rows.filter(r => !!r), options);
    }

    return sections;
  }
}))
.actions(self => ({
  /**
   * Copies tiles and associated objects into the specified row, giving the tiles all new ids.

   * @param tiles - tiles to copy
   * @param sharedModelEntries - shared models to copy
   * @param annotations - annotations to copy
   * @param isCrossingDocuments - whether the tiles are being copied across documents
   * @param rowInfo - row to copy the tiles into
   * @param copySpec - copy specification
   */
  copyTiles(
    tiles: IDragTileItem[],
    sharedModelEntries: SharedModelEntrySnapshotType[],
    annotations: IArrowAnnotationSnapshot[],
    isCrossingDocuments: boolean,
    rowInfo?: IDropRowInfo,
    copySpec?: ICopySpec
  ) {
    // Titles should be made unique unless we are copying from another document.
    const makeTitlesUnique = !copySpec && !isCrossingDocuments;

    // Update shared models with new names and ids
    const updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds> = {};
    const newSharedModelEntries: SharedModelEntrySnapshotType[] = [];
    sharedModelEntries.forEach(sharedModelEntry => {
      // For now, only duplicate shared data sets
      if (isSharedDataSetSnapshot(sharedModelEntry.sharedModel)) {
        // Determine new ids
        const sharedDataSet = sharedModelEntry.sharedModel;
        const updatedIds = getUpdatedSharedDataSetIds(sharedDataSet);
        if (sharedDataSet.id) updatedSharedModelMap[sharedDataSet.id] = updatedIds;

        // Create a snapshot for the shared model with updated ids, which will be updated with new tile ids
        // and added to the document later
        const sharedModel = getSharedDataSetSnapshotWithUpdatedIds(sharedDataSet, updatedIds);
        newSharedModelEntries.push({
          tiles: sharedModelEntry.tiles,
          sharedModel
        });

        // Add the model (but not the tile IDs yet) to the Document so that tile references to it won't break
        // when we insert the tiles.
        if (sharedDataSet.id) {
          self.addSharedModelFromImport(sharedModel.id, {sharedModel});
        } else {
          // Not sure why this would happen?
          console.warn("Cannot duplicate shared model without an ID");
        }
      }
    });

    const findTileSharedModelEntries = (tileId: string) => {
      return sharedModelEntries.filter(entry => entry.tiles?.includes(tileId));
    };

    // Clone the tile content and update it with the new shared model ids
    const tileIdMap: Record<string, string> = {};
    const updatedTiles: IDropTileItem[] = [];
    // This sorts the tiles to put containers last.
    // The container (eg Question) tiles can then simply read the updated IDs
    // of their embedded tiles and update their references to them.
    // However, the sorting has the effect of actually putting the Question tiles
    // after other tiles that are getting copied, which is a bug.
    // TODO: This loop should be split up so that the actual order of tiles is preserved,
    // while still allowing the references to embedded tiles to be updated.
    const reorderedTiles: IDragTileItem[] = [
      ...tiles.filter(tile => !isContainerTile(tile)),
      ...tiles.filter(tile => isContainerTile(tile))
    ];
    reorderedTiles.forEach(tile => {
      const oldTile: ITileModelSnapshotIn = JSON.parse(tile.tileContent);
      const newTile: ITileModelSnapshotIn = cloneDeep(oldTile);
      tileIdMap[tile.tileId] = uniqueId();

      // Remove any title that shouldn't be there (eg, copying from legacy curriculum)
      const typeInfo = getTileContentInfo(tile.tileType);
      if (newTile.title && typeInfo?.useContentTitle) {
        newTile.title = undefined;
      }

      // Find the shared models for this tile
      const tileSharedModelEntries = findTileSharedModelEntries(tile.tileId);

      // Update the tile's references to its shared models
      const updateFunction = typeInfo?.updateContentWithNewSharedModelIds;
      if (updateFunction) {
        newTile.content = updateFunction(oldTile.content, tileSharedModelEntries, updatedSharedModelMap);
      }

      // If this is a container tile, update the references to its embedded tiles
      // Any embedded tiles that were not in our list of tiles to copy are removed.
      const oldContent = oldTile.content;
      const newContent = newTile.content;

      if (isRowListSnapshotOut(oldContent) && isRowListSnapshotIn(newContent)) {
        // These should exist for RowLists, but need to assert it to make Typescript happy
        if (!("rowOrder" in newContent && "rowMap" in newContent)) return;
        const newRowMap = {} as Record<string, TileRowSnapshotType>;
        const newRowOrder = [] as string[];
        // Iterate through rows in the oldContent.
        // Give the rows new IDs and update the tile references in the rows.
        oldContent.rowOrder.forEach(rowId => {
          const newRowId = uniqueId();
          const newRowContent: TileRowSnapshotType = {
            id: newRowId,
            tiles: oldContent.rowMap[rowId]?.tiles.flatMap(tileLayout => {
              if (tileIdMap[tileLayout.tileId]) {
                // mark the tile as embedded
                const tileInfo = updatedTiles.find(t => t.tileId === tileLayout.tileId);
                if (tileInfo) {
                  tileInfo.embedded = true;
                }
                return { ...tileLayout, tileId: tileIdMap[tileLayout.tileId] };
              } else {
                return [];
              }
            }) ?? []
          };
          if (newRowContent.tiles && newRowContent.tiles.length > 0) {
            newRowMap[newRowId] = newRowContent;
            newRowOrder.push(newRowId);
          }
        });
        newContent.rowMap = newRowMap;
        newContent.rowOrder = newRowOrder;
      }
      newTile.content = newContent;

      // Handle any special logic needed when copying
      if (typeInfo?.updateContentForCopy) {
        newTile.content = typeInfo.updateContentForCopy(newTile.content, isCrossingDocuments);
      }

      // Save the updated tile so we can add it to the document
      updatedTiles.push({ ...tile, newTileId: tileIdMap[tile.tileId], tileContent: JSON.stringify(newTile) });
    });

    // Add copied tiles to document
    if (copySpec) {
      self.copyTilesWithSpec(updatedTiles, copySpec);
    } else if (rowInfo) {
      self.userCopyTiles(updatedTiles, rowInfo, makeTitlesUnique);
    }

    // Update tile ids for shared models and add those references to document.
    // The shared datasets have already been added above.
    newSharedModelEntries.forEach(sharedModelEntry => {
      const updatedTileIds: string[] = (sharedModelEntry.tiles||[]).map((oldTile) => tileIdMap[oldTile])
        .filter((tileId: string | undefined) => tileId !== undefined);
      if (isSharedDataSetSnapshot(sharedModelEntry.sharedModel)) {
        const oldProvider = sharedModelEntry.sharedModel.providerId;
        const updatedProvider = oldProvider && tileIdMap[oldProvider];
        const updatedSharedModel = {
          sharedModel: updateSharedDataSetSnapshotWithNewTileIds(sharedModelEntry.sharedModel, tileIdMap),
          tiles: updatedTileIds,
          provider: updatedProvider };
        // Make dataset name unique.
        // We can't do this earlier since getUniqueDataSetName only considers datasets that are linked to tiles.
        const name = updatedSharedModel.sharedModel.dataSet?.name;
        const newName = makeTitlesUnique ? self.getUniqueSharedModelName(name) : name;
        if (updatedSharedModel.sharedModel.dataSet?.name && newName) {
          updatedSharedModel.sharedModel.dataSet.name = newName;
        }

        const id = sharedModelEntry.sharedModel.id;
        if (id) {
          const existingEntry = self.sharedModelMap.get(id);
          if (existingEntry) {
            applySnapshot(existingEntry, updatedSharedModel);
          } else {
            console.warn("SharedModel we created somehow disappeared");
          }
        }
      }
    });

    // Update tile and object ids for annotations and add copies to document
    const updateAnnotationObject = (object?: IClueObjectSnapshot) => {
      if (object) {
        const tile = tiles.find(t => t.tileId === object?.tileId);
        if (tile) {
          const tileSharedModelEntries = findTileSharedModelEntries(tile.tileId);
          const updateFunction = getTileContentInfo(tile.tileType)?.updateObjectReferenceWithNewSharedModelIds;
          if (updateFunction) {
            updateFunction(object, tileSharedModelEntries, updatedSharedModelMap);
          }
        }
      }
    };

    annotations.forEach(annotation => {
      if (isArrowAnnotationSnapshot(annotation)) {
        const newAnnotationSnapshot = cloneDeep(annotation);
        updateAnnotationObject(newAnnotationSnapshot.sourceObject);
        updateAnnotationObject(newAnnotationSnapshot.targetObject);
        updateArrowAnnotationTileIds(newAnnotationSnapshot, tileIdMap);
        newAnnotationSnapshot.id = uniqueId();
        self.addArrow(ArrowAnnotation.create(newAnnotationSnapshot));
      }
    });

    return updatedTiles;
  }
}))
.actions(self => ({
  handleDragCopyTiles(dragTiles: IDragTilesData, rowInfo: IDropRowInfo) {
    const { tiles, sharedModels, annotations, sourceDocId } = dragTiles;

    // Convert IDragSharedModelItems to partial SharedModelEnries
    const sharedModelEntries: SharedModelEntrySnapshotType[] = [];
    sharedModels.forEach(dragSharedModel => {
      try {
        const content = JSON.parse(dragSharedModel.content);
        const Model = sharedModelFactory(content);
        const sharedModel = Model !== UnknownSharedModel ? Model.create(content) : undefined;
        if (sharedModel) {
          sharedModelEntries.push({
            sharedModel,
            tiles: dragSharedModel.tileIds
          });
        }
      } catch (e) {
        console.warn(`Unable to copy shared model with content`, dragSharedModel.content);
      }
    });

    self.copyTiles(tiles, sharedModelEntries, annotations, sourceDocId !== self.contentId, rowInfo);
  },
  duplicateTiles(tiles: IDragTileItem[]) {
    tiles = self.addEmbeddedTilesToDragTiles(tiles);

    // Find the RowList that contains all the tiles being duplicated.
    // Might be the whole document or a Question tile.
    const tileIds = tiles.map(tile => tile.tileId);
    const rowList = self.getRowListContainingTileIds(tileIds);
    if (!rowList) {
      return;
    }
    // New tiles go into a row after the last copied tile
    const rowId = self.getLastRowForTiles(tiles) || rowList.rowOrder[rowList.rowOrder.length - 1];

    // Find shared models used by tiles being duplicated
    const sharedModelEntries = Object.values(self.getSharedModelsUsedByTiles(tileIds));
    const annotations = Object.values(self.getAnnotationsUsedByTiles(tileIds, true));

    // Make sure we are only passing snapshots to copyTiles, since they need to be cloned & modified.
    const snapshots = sharedModelEntries.map(sme => {
      return getSnapshot(sme);
    });

    self.copyTiles(
      tiles,
      snapshots,
      annotations,
      false, // duplicating within same document
      { rowDropId: rowId, rowInsertIndex: rowList.getRowIndex(rowId) + 1, rowDropLocation: "bottom" }
    );
  },
  /**
   * Create a new tile and insert it as a new row after the given tile's row.
   * @param tileType type of tile to create
   * @param target existing tile that determines the position
   * @param sharedModels shared models to connect to new tile
   * @param options IDocumentContentAddTileOptions object
   */
  addTileAfter(tileType: string, target: ITileModel, sharedModels?: SharedModelType[],
    options?: IDocumentContentAddTileOptions) {
    const targetRowId = self.findRowIdContainingTile(target.id);
    if (!targetRowId) {
      console.warn("Can't find row to add tile after");
      return;
    }
    const rowInsertIndex = self.getRowIndex(targetRowId) + 1;
    const newOptions = {...options, insertRowInfo:{rowInsertIndex}};
    // If no title is provided, and this tile should have one, then set the default
    if (!newOptions.title) {
      // No tile title is provided. Will the tile inherit one?
      const willGetTitleFromDataSet = getTileContentInfo(tileType)?.useContentTitle && sharedModels;
      if (!willGetTitleFromDataSet) {
        // Nope. Need to construct a title.
        newOptions.title = self.getUniqueTitleForType(tileType);
      }
    }
    // This addTile function happens to add the tile content to a tile model before
    // adding it to the document. This ordering is one part of a complex series
    // that means the reaction in tile content's afterAttach will be delayed until
    // after this action is complete. See the comment in IAddTilesContext for a
    // little more info
    const newRowTile = self.userAddTile(tileType, newOptions);
    const newTileId = newRowTile?.tileId;
    if (!newTileId) {
      console.warn("New tile couldn't be added");
      return;
    }
    if (!sharedModels) {
      // Nothing more to do
      return;
    }
    sharedModels.forEach(sharedModel => {
      // This will create a new entry if necessary otherwise it will just return
      // the existing entry
      const entry = self.addSharedModel(sharedModel);
      // TODO: unify the updating of the entry with BaseDocumentContent.addTileSharedModel,
      // and SharedModelEntry.addTile
      entry.tiles.push(newTileId);
    });
  },
  getCopySpec(selectedTileIds: string[], sectionId?: string): ICopySpec {
    const selectedTiles = self.getDragTileItems(selectedTileIds);
    const tiles = self.addEmbeddedTilesToDragTiles(selectedTiles);
    const tileIds = tiles.map(tile => tile.tileId);
    const tilePositions = tileIds.reduce<Record<string, ITileCopyPosition>>((acc, tileId) => {
      const rowId = self.findRowIdContainingTile(tileId)!;
      acc[tileId] = { rowId, sectionId: sectionId ?? self.getSectionIdForTile(tileId) };
      return acc;
    }, {});
    const sharedModelEntries = Object.values(self.getSharedModelsUsedByTiles(tileIds)).map(sme => getSnapshot(sme));
    const annotations = Object.values(self.getAnnotationsUsedByTiles(tileIds));

    return {
      tiles,
      tilePositions,
      sharedModelEntries,
      annotations,
    };
  },
  applyCopySpec(copySpec: ICopySpec, isCrossingDocuments: boolean) {
    return self.copyTiles(
      copySpec.tiles, copySpec.sharedModelEntries, copySpec.annotations, isCrossingDocuments, undefined, copySpec
    );
  },
}));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
