import stringify from "json-stringify-pretty-compact";
import { applySnapshot, getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { cloneDeep, each } from "lodash";
import { IDragTilesData,
         IDocumentContentAddTileOptions } from "./document-content-types";
import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import { IDropRowInfo, TileRowModel, TileRowModelType, TileRowSnapshotOutType } from "./tile-row";
import {
  ArrowAnnotation, IArrowAnnotationSnapshot, isArrowAnnotationSnapshot, updateArrowAnnotationTileIds
} from "../annotations/arrow-annotation";
import { sharedModelFactory, UnknownSharedModel } from "../shared/shared-model-manager";
import { SharedModelType } from "../shared/shared-model";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { IDragTileItem, IDropTileItem, ITileModel,
         ITileModelSnapshotOut } from "../tiles/tile-model";
import { uniqueId } from "../../utilities/js-utils";
import { comma, StringBuilder } from "../../utilities/string-builder";
import { SharedModelEntrySnapshotType } from "./shared-model-entry";

// Imports related to hard coding shared model duplication
import {
  getSharedDataSetSnapshotWithUpdatedIds, getUpdatedSharedDataSetIds, isSharedDataSetSnapshot,
  UpdatedSharedDataSetIds, updateSharedDataSetSnapshotWithNewTileIds
} from "../shared/shared-data-set";
import { IClueObjectSnapshot } from "../annotations/clue-object";


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

    snapshot.rowMap = (rowMap => {
      const _rowMap: { [id: string]: TileRowSnapshotOutType } = {};
      each(rowMap, (row, id) => {
        tileIdMap[id] = row.id = uniqueId();
        row.tiles = row.tiles.map(tileLayout => {
          tileLayout.tileId = tileIdMap[tileLayout.tileId];
          return tileLayout;
        });
        _rowMap[row.id] = row;
      });
      return _rowMap;
    })(snapshot.rowMap);

    snapshot.rowOrder = snapshot.rowOrder.map(rowId => tileIdMap[rowId]);

    return snapshot;
  }
}))
.views(self => ({
  exportRowsAsJson(rows: (TileRowModelType | undefined)[], options?: IDocumentExportOptions) {
    const builder = new StringBuilder();
    builder.pushLine("{");
    builder.pushLine(`"tiles": [`, 2);

    const includedTileIds: string[] = [];
    const exportRowCount = rows.length;
    rows.forEach((row, rowIndex) => {
      const isLastRow = rowIndex === exportRowCount - 1;
      // export each exportable tile
      const tileExports = row?.tiles.map((tileInfo, tileIndex) => {
        const isLastTile = tileIndex === row.tiles.length - 1;
        const showComma = row.tiles.length > 1 ? !isLastTile : !isLastRow;
        const rowHeight = self.rowHeightToExport(row, tileInfo.tileId);
        const rowHeightOption = rowHeight ? { rowHeight } : undefined;
        includedTileIds.push(tileInfo.tileId);
        return self.exportTileAsJson(tileInfo, { ...options, appendComma: showComma, ...rowHeightOption });
      }).filter(json => !!json);
      if (tileExports?.length) {
        // multiple tiles in a row are exported in an array
        if (tileExports.length > 1) {
          builder.pushLine("[", 4);
          tileExports.forEach(tileExport => {
            tileExport && builder.pushBlock(tileExport, 6);
          });
          builder.pushLine(`]${comma(!isLastRow)}`, 4);
        }
        // single tile rows are exported directly
        else if (tileExports[0]) {
          builder.pushBlock(tileExports[0], 4);
        }
      }
    });
    const sharedModels = Object.values(self.getSharedModelsUsedByTiles(includedTileIds));
    const hasSharedModels = sharedModels.length > 0;
    const annotations = Object.values(self.getAnnotationsUsedByTiles(includedTileIds));
    const hasAnnotations = annotations.length > 0;

    const tilesComma = hasSharedModels || hasAnnotations ? "," : "";
    builder.pushLine(`]${tilesComma}`, 2);

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
      const {rowId, sectionId} = copySpec.tilePositions[tile.tileId];
      let targetRow = targetRowMap.get(rowId);
      let insertedRowIndex = self.defaultInsertRow;
      const insertingRow = !targetRow;

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

      if (targetRow) {
        const rowIndex = self.getRowIndex(targetRow.id);
        self.copyTilesIntoExistingRow([tile], {
          rowInsertIndex: 0, // this is ignored
          rowDropIndex: rowIndex,
          rowDropLocation: "right"
        });
      }
    });
  },
}))
.views(self => ({
  exportAsJson(options?: IDocumentExportOptions) {
    // identify rows with exportable tiles
    const rowsToExport = self.rowOrder.map(rowId => {
      const row = self.getRow(rowId);
      return row && !row.isSectionHeader && !row.isEmpty && !self.isPlaceholderRow(row) ? row : undefined;
    }).filter(row => !!row);

    return self.exportRowsAsJson(rowsToExport, options);
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
            sections[section] = self.exportRowsAsJson(rows.filter(r => !!r), options);
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
      sections[section] = self.exportRowsAsJson(rows.filter(r => !!r), options);
    }

    return sections;
  }
}))
.actions(self => ({
  // Copies tiles and shared models into the specified row, giving them all new ids
  copyTiles(
    tiles: IDragTileItem[],
    sharedModelEntries: SharedModelEntrySnapshotType[],
    annotations: IArrowAnnotationSnapshot[],
    rowInfo?: IDropRowInfo,
    copySpec?: ICopySpec
  ) {
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

    // Update tile content with new shared model ids
    const tileIdMap: Record<string, string> = {};
    const updatedTiles: IDropTileItem[] = [];
    tiles.forEach(tile => {
      const oldContent = JSON.parse(tile.tileContent);
      const tileContent = cloneDeep(oldContent);
      tileIdMap[tile.tileId] = uniqueId();

      // Remove any title that shouldn't be there (eg, copying from legacy curriculum)
      const typeInfo = getTileContentInfo(tile.tileType);
      if (tileContent.title && typeInfo?.useContentTitle) {
        tileContent.title = undefined;
      }

      // Find the shared models for this tile
      const tileSharedModelEntries = findTileSharedModelEntries(tile.tileId);

      // Update the tile's references to its shared models
      const updateFunction = typeInfo?.updateContentWithNewSharedModelIds;
      if (updateFunction) {
        tileContent.content = updateFunction(oldContent.content, tileSharedModelEntries, updatedSharedModelMap);
      }

      // Save the updated tile so we can add it to the document
      updatedTiles.push({ ...tile, newTileId: tileIdMap[tile.tileId], tileContent: JSON.stringify(tileContent) });
    });

    // Add copied tiles to document
    if (copySpec) {
      self.copyTilesWithSpec(updatedTiles, copySpec);
    } else if (rowInfo) {
      self.userCopyTiles(updatedTiles, rowInfo);
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
        const uniqueName = name && self.getUniqueSharedModelName(name);
        if (updatedSharedModel.sharedModel.dataSet?.name && uniqueName) {
          updatedSharedModel.sharedModel.dataSet.name = uniqueName;
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
  },
  // Returns all tile ids that are linked to the selected tiles, including
  // shared models and annotations.  This keeps looping until no more tiles
  // are added to the set to ensure that all "chained" tiles are included.
  getAllLinkedTileIds(selectedTileIds: string[]) {
    const uniqueTileIds = new Set<string>([...selectedTileIds]);
    let startingTileIds = selectedTileIds;
    let endingTileIds = selectedTileIds;
    do {
      startingTileIds = Array.from(uniqueTileIds);
      const sharedModelEntries = Object.values(self.getSharedModelsUsedByTiles(startingTileIds));
      const annotations = Object.values(self.getAnnotationsUsedByTiles(startingTileIds, true));

      sharedModelEntries.forEach(entry => {
        entry.tiles.map(tile => uniqueTileIds.add(tile.id));
      });
      annotations.forEach(annotation => {
        if (annotation.sourceObject?.tileId) {
          uniqueTileIds.add(annotation.sourceObject.tileId);
        }
        if (annotation.targetObject?.tileId) {
          uniqueTileIds.add(annotation.targetObject.tileId);
        }
      });

      endingTileIds = Array.from(uniqueTileIds);
    } while (endingTileIds.length > startingTileIds.length);

    return endingTileIds;
  },
  // orders tileIds by the order of the rows they are in and the order of the tiles within each row
  orderTileIds(tileIds: string[]) {
    const sortInfo =
      tileIds.map(tileId => {
        const rowId = self.findRowContainingTile(tileId);
        const row = rowId ? self.rowMap.get(rowId) : undefined;
        return row
          ? { tileId, rowIndex: self.getRowIndex(row.id), tileIndex: row.tiles.findIndex(t => t.tileId === tileId) }
          : undefined;
      }).filter(info => !!info) as {tileId: string; rowIndex: number; tileIndex: number;}[];

    sortInfo.sort((a, b) => {
      if (a.rowIndex !== b.rowIndex) {
        return a.rowIndex - b.rowIndex;
      }
      return a.tileIndex - b.tileIndex;
    });

    return sortInfo.map(info => info.tileId);
  },
}))
.actions(self => ({
  handleDragCopyTiles(dragTiles: IDragTilesData, rowInfo: IDropRowInfo) {
    const { tiles, sharedModels, annotations } = dragTiles;

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

    self.copyTiles(tiles, sharedModelEntries, annotations, rowInfo);
  },
  duplicateTiles(tiles: IDragTileItem[]) {
    // New tiles go into a row after the last copied tile
    const rowIndex = self.getRowAfterTiles(tiles);

    // Find shared models used by tiles being duplicated
    const tileIds = tiles.map(tile => tile.tileId);
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
      { rowInsertIndex: rowIndex }
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
    const targetRowId = self.findRowContainingTile(target.id);
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
    const linkedTileIds = self.getAllLinkedTileIds(selectedTileIds);
    const tileIds = self.orderTileIds(linkedTileIds);
    const tiles = self.getDragTileItems(tileIds);
    const tilePositions = tileIds.reduce<Record<string, ITileCopyPosition>>((acc, tileId) => {
      const rowId = self.findRowContainingTile(tileId)!;
      acc[tileId] = { rowId, sectionId: sectionId ?? self.getSectionIdForTile(tileId) };
      return acc;
    }, {});
    const sharedModelEntries = Object.values(self.getSharedModelsUsedByTiles(tileIds)).map(sme => getSnapshot(sme));
    const annotations = Object.values(self.getAnnotationsUsedByTiles(tileIds, true));

    return {
      tiles,
      tilePositions,
      sharedModelEntries,
      annotations,
    };
  },
  applyCopySpec(copySpec: ICopySpec) {
    self.copyTiles(
      copySpec.tiles, copySpec.sharedModelEntries, copySpec.annotations, undefined, copySpec
    );
  },
}));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
