import { uniqueId } from "../../utilities/js-utils";
import { cloneTileSnapshotWithNewId, IDragTileItem, ITilePosition } from "../tiles/tile-model";
import { IDragTilesData } from "./document-content-types";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { DEBUG_DROP } from "../../lib/debug";
import { DocumentContentModelWithAnnotations } from "./document-content-with-annotations";

/**
 * This is one part of the DocumentContentModel, which is split into four parts of more manageable size:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithAnnotations
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModel
 *
 * This file should contain the any properties, views, and actions that are
 * related to dragging and dropping tiles.
 *
 * TODO: move tile dropping actions from BaseDocumentContentModel here
 * TODO: consider extending this to include tile copying since that is fundamental
 * part of dragging and dropping.
 */
export const DocumentContentModelWithTileDragging = DocumentContentModelWithAnnotations
.named("DocumentContentModelWithTileDragging")
.views(self => ({
  /** Return an array of ITilePosition objects for the given tile ids.
   * These are sorted into document order, regardless of the order of the tileIds.
   */
  getTilePositions(tileIds: string[]): ITilePosition[] {
    const positions = tileIds.map(tileId => {
      const rowList = self.getRowListContainingTileIds([tileId])!;
      const row = self.findRowContainingTile(tileId);
      const rowIndex = row && rowList.getRowIndex(row.id) || 0;
      const tileIndex = row?.indexOfTile(tileId) || 0;
      return { tileId, rowList, rowIndex, tileIndex };
    });
    const allTileIds = self.getAllTileIds(true);
    positions.sort((a, b) => {
      const aIndex = allTileIds.indexOf(a.tileId);
      const bIndex = allTileIds.indexOf(b.tileId);
      return aIndex - bIndex;
    });
    return positions;
  }
}))
.views(self => ({
  getDragTileItems(tileIds: string[]) {
    const dragTileItems: IDragTileItem[] = [];

    const idMap: { [id: string]: string } = {};
    tileIds.forEach(tileId => idMap[tileId] = uniqueId());

    const tilePositions = self.getTilePositions(tileIds);

    tilePositions.forEach((tilePosition) => {
      if (!tilePosition) return;
      const { tileId, rowList, rowIndex, tileIndex } = tilePosition;
      // Note: previously this function would be passed the tileModel being
      // dragged. It would accept a tileId if it matched the tileModel.id even if
      // `documentContent.getTile(tileId)` did not return a tile model. This seems
      // like it would mask an error and also complicates the code.
      const srcTile = self.getTile(tileId);
      if (!srcTile) {
        return;
      }

      // Note: previously this would look up the "contentId" of the srcTile using
      // `getContentIdFromNode`. If it didn't exist or was different from
      // `documentContent.contentId` the tile would be skipped. This contentId is
      // found by looking up the contentDocument parent of the tile and getting is
      // `contentId`. Because srcTile is found via `documentContent.getTile` this
      // should guarantee that the contentId return by `getContentIdFromNode`
      // always matches the dragSrcContentId.
      const rowHeight = rowList.getRowByIndex(rowIndex)?.height;
      const clonedTile = cloneTileSnapshotWithNewId(srcTile, idMap[srcTile.id]);
      getTileContentInfo(clonedTile.content.type)?.contentSnapshotPostProcessor?.(clonedTile.content, idMap);
      dragTileItems.push({
        rowList,
        rowIndex, rowHeight, tileIndex,
        tileId: srcTile.id,
        tileContent: JSON.stringify(clonedTile),
        tileType: srcTile.content.type
      });
    });

    return dragTileItems;
  }
}))
.views(self => ({
  /**
   *
   * @param documentContent
   * @param tileIds
   * @returns
   */
  getDragTiles(tileIds: string[]): IDragTilesData {

    const sharedManager = self.tileEnv?.sharedModelManager;

    // This is an ephemeral id DocumentContent#contentId
    // it is like an instance id for the document content it
    // will change on each load of the document
    const sourceDocId = self.contentId;

    const dragTiles: IDragTilesData = {
      sourceDocId,
      tiles: self.getDragTileItems(tileIds),
      sharedModels: sharedManager?.getSharedModelDragDataForTiles(tileIds) ?? [],
      annotations: Object.values(self.getAnnotationsUsedByTiles(tileIds))
    };

    return dragTiles;
  }
}));

/* istanbul ignore next: this only used for debugging */
export function logDataTransfer(_dataTransfer: DataTransfer) {
  if (!DEBUG_DROP) {
    return;
  }

  const dataTransfer = {} as any;
  dataTransfer.dropEffect = _dataTransfer.dropEffect;
  dataTransfer.effectAllowed = _dataTransfer.effectAllowed;
  dataTransfer.types = _dataTransfer.types.map(type => type);

  dataTransfer.items = {} as any;
  for (const _item of _dataTransfer.items) {
    const item = {
      kind: _item.kind,
      type: _item.type,
      stringValue: undefined as string | undefined
    };
    // This is asynchronous, however Chrome's console.log will update any objects printed to console
    // if it is changed after being logged. However you have to ask for all of the values "synchronously"
    // otherwise the browser clears out the dataTransfer and any delayed requests will return nothing.
    // In other words doing an `await` between each getAsString call will fail.
    //
    // Because the incoming _dataTransfer.items are cleared out after this function returns
    // _item.type will become undefined or an empty string after the function returns
    // So we have to make sure not to refer `_item` in the asynchronous callback below.
    _item.getAsString((value) => item.stringValue = value);

    dataTransfer.items[item.type] = item;
  }

  // As far as I can tell getData(type) is the same as the value passed to callback of getAsString
  dataTransfer.dataValues = {} as Record<string,string>;
  for (const type of dataTransfer.types) {
    dataTransfer.dataValues[type] = _dataTransfer.getData(type);
  }

  // eslint-disable-next-line no-console
  console.log("Dropped", dataTransfer);
}
