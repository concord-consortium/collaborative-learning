import { getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { cloneDeep, each } from "lodash";

import { DocumentContentModelWithAnnotations } from "./document-content-with-annotations";
import { TileRowSnapshotOutType } from "./tile-row";
import { isArrowAnnotationSnapshot } from "../annotations/arrow-annotation";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { ITileModelSnapshotOut } from "../tiles/tile-model";
import { uniqueId } from "../../utilities/js-utils";

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
      if (isArrowAnnotationSnapshot(annotation)) {
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
}))
.views(self => ({
  publish() {
    return JSON.stringify(self.snapshotWithUniqueIds());
  },
}));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
