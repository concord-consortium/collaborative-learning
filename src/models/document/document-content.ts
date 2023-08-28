import stringify from "json-stringify-pretty-compact";
import { getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { cloneDeep, each } from "lodash";

import { IDragTilesData, NewRowTileArray, PartialSharedModelEntry, PartialTile } from "./document-content-types";
import { DocumentContentModelWithAnnotations } from "./document-content-with-annotations";
import { IDropRowInfo, TileRowModelType, TileRowSnapshotOutType } from "./tile-row";
import {
  ArrowAnnotation, IArrowAnnotation, isArrowAnnotation, updateArrowAnnotationTileIds
} from "../annotations/arrow-annotation";
import { sharedModelFactory, UnknownSharedModel } from "../shared/shared-model-manager";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { IDragTileItem, IDropTileItem, ITileModelSnapshotOut } from "../tiles/tile-model";
import { uniqueId } from "../../utilities/js-utils";
import { comma, StringBuilder } from "../../utilities/string-builder";

// Imports related to hard coding shared model duplication
import {
  getSharedDataSetSnapshotWithUpdatedIds, getUpdatedSharedDataSetIds, isSharedDataSetSnapshot, SharedDataSet,
  UpdatedSharedDataSetIds, updateSharedDataSetSnapshotWithNewTileIds
} from "../shared/shared-data-set";

/**
 * The DocumentContentModel is the combination of 3 parts:
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
export const DocumentContentModel = DocumentContentModelWithAnnotations.named("DocumentContent")
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
      // TODO: Figure out why linting is failing
      // if ("providerId" in sharedModel && typeof sharedModel.providerId === "string") {
      //   sharedModel.providerId = tileIdMap[sharedModel.providerId];
      if ("providerId" in sharedModel) {
        const providedSharedModel = sharedModel as any;
        if (typeof providedSharedModel.providerId === "string") {
          providedSharedModel.providerId = tileIdMap[providedSharedModel.providerId];
        }
      }
    });
    // TODO: Give the shared models new ids

    // Update annotations with new tile ids
    each(snapshot.annotations, (annotation, id) => {
      // TODO Move into functions for specific annotation types
      if (isArrowAnnotation(annotation)) {
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
  },
  getAnnotationsUsedByTiles(tileIds: string[]) {
    // TODO Make generic to handle any type of annotation, not just arrow annotations
    const annotations: Record<string, IArrowAnnotation> = {};
    Array.from(self.annotations.values()).forEach(annotation => {
      if (tileIds.includes(annotation.sourceObject?.tileId ?? "")
        && tileIds.includes(annotation.targetObject?.tileId ?? "")
      ) {
        annotations[annotation.id] = annotation;
      }
    });
    return annotations;
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

    if (sharedModels.length > 0) {
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
    sharedModelEntries: PartialSharedModelEntry[],
    annotations: IArrowAnnotation[],
    rowInfo: IDropRowInfo,
    insertTileFunction: (updatedTiles: IDropTileItem[], rowInfo: IDropRowInfo) => NewRowTileArray
  ) {
    // Update shared models with new ids
    const updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds> = {};
    const newSharedModelEntries: PartialSharedModelEntry[] = [];
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
      }
    });

    // Update tile content with new shared model ids
    const tileIdMap: Record<string, string> = {};
    const updatedTiles: IDropTileItem[] = [];
    tiles.forEach(tile => {
      const oldContent = JSON.parse(tile.tileContent);
      const tileContent = cloneDeep(oldContent);
      tileIdMap[tile.tileId] = uniqueId();

      // Find the shared models for this tile
      const tileSharedModelEntries =
        sharedModelEntries.filter(entry => entry.tiles?.map(t => t.id).includes(tile.tileId));

      // Update the tile's references to its shared models
      const updateFunction = getTileContentInfo(tile.tileType)?.updateContentWithNewSharedModelIds;
      if (updateFunction) {
        tileContent.content = updateFunction(oldContent.content, tileSharedModelEntries, updatedSharedModelMap);
      }

      // Save the updated tile so we can add it to the document
      updatedTiles.push({ ...tile, newTileId: tileIdMap[tile.tileId], tileContent: JSON.stringify(tileContent) });
    });

    // Add copied tiles to document
    const results = insertTileFunction(updatedTiles, rowInfo);

    // Increment default titles when necessary
    results.forEach((result, i) => {
      if (result?.tileId) {
        const { oldTitle, newTitle } = self.updateDefaultTileTitle(result.tileId);

        // If the tile title needed to be updated, we assume we should also update the data set's name
        if (newTitle && sharedModelEntries) {
          newSharedModelEntries.forEach(sharedModelEntry => {
            if (isSharedDataSetSnapshot(sharedModelEntry.sharedModel)) {
              const sharedDataSet = sharedModelEntry.sharedModel;
              const oldName = sharedDataSet.dataSet?.name;
              if (sharedDataSet.dataSet && oldName === oldTitle) {
                sharedDataSet.dataSet.name = newTitle;
              }
            }
          });
        }
      }
    });

    // Update tile ids for shared models and add copies to document
    newSharedModelEntries.forEach(sharedModelEntry => {
      const updatedTileIds: string[] = sharedModelEntry.tiles.map((oldTile: PartialTile) => tileIdMap[oldTile.id])
        .filter((tileId: string | undefined) => tileId !== undefined);
      if (isSharedDataSetSnapshot(sharedModelEntry.sharedModel)) {
        const updatedSharedModel = { ...sharedModelEntry.sharedModel };
        updateSharedDataSetSnapshotWithNewTileIds(updatedSharedModel, tileIdMap);
        const newSharedModelEntry =
          self.addSharedModel(SharedDataSet.create(updatedSharedModel));
        updatedTileIds.forEach(tileId => newSharedModelEntry.tiles.push(tileId));
      }
    });

    // Update tile ids for annotations and add copies to document
    annotations.forEach(annotation => {
      if (isArrowAnnotation(annotation)) {
        const newAnnotationSnapshot = cloneDeep(getSnapshot(annotation));
        newAnnotationSnapshot.id = uniqueId();
        updateArrowAnnotationTileIds(newAnnotationSnapshot, tileIdMap);
        self.addArrow(ArrowAnnotation.create(newAnnotationSnapshot));
      }
    });

    // TODO: Make sure logging is correct
    self.logCopyTileResults(tiles, results);
  }
}))
.actions(self => ({
  handleDragCopyTiles(dragTiles: IDragTilesData, rowInfo: IDropRowInfo) {
    const { tiles, sharedModels } = dragTiles;

    // Convert IDragSharedModelItems to partial SharedModelEnries
    const sharedModelEntries: PartialSharedModelEntry[] = [];
    sharedModels.forEach(dragSharedModel => {
      try {
        const content = JSON.parse(dragSharedModel.content);
        const Model = sharedModelFactory(content);
        const sharedModel = Model !== UnknownSharedModel ? Model.create(content) : undefined;
        if (sharedModel) {
          sharedModelEntries.push({
            sharedModel,
            tiles: dragSharedModel.tileIds.map(tileId => ({ id: tileId }))
          });
        }
      } catch (e) {
        console.warn(`Unable to copy shared model with content`, dragSharedModel.content);
      }
    });

    self.copyTiles(tiles, sharedModelEntries, [], rowInfo, self.userCopyTiles);
  },
  duplicateTiles(tiles: IDragTileItem[]) {
    // Determine the row to add the duplicated tiles into
    const rowIndex = self.getRowAfterTiles(tiles);

    // Find shared models used by tiles being duplicated
    const tileIds = tiles.map(tile => tile.tileId);
    const sharedModelEntries = Object.values(self.getSharedModelsUsedByTiles(tileIds));
    const annotations = Object.values(self.getAnnotationsUsedByTiles(tileIds));

    self.copyTiles(
      tiles,
      sharedModelEntries,
      annotations,
      { rowInsertIndex: rowIndex },
      (t: IDropTileItem[], rowInfo: IDropRowInfo) => self.copyTilesIntoNewRows(t, rowInfo.rowInsertIndex)
    );
  }
}));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
