import stringify from "json-stringify-pretty-compact";
import { getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { cloneDeep, each } from "lodash";

import { DocumentContentModelWithAnnotations } from "./document-content-with-annotations";
import { TileRowModelType, TileRowSnapshotOutType } from "./tile-row";
import { IArrowAnnotation, isArrowAnnotation } from "../annotations/arrow-annotation";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { ITileModelSnapshotOut } from "../tiles/tile-model";
import { uniqueId } from "../../utilities/js-utils";
import { comma, StringBuilder } from "../../utilities/string-builder";

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
        if (annotation.sourceObject?.tileId) {
          annotation.sourceObject.tileId = tileIdMap[annotation.sourceObject.tileId];
        }
        if (annotation.targetObject?.tileId) {
          annotation.targetObject.tileId = tileIdMap[annotation.targetObject.tileId];
        }
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
}));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
