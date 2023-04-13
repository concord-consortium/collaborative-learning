import { uniqueId } from "../../utilities/js-utils";
import { cloneTileSnapshotWithNewId, IDragTileItem, ITileModel, ITilePosition } from "../tiles/tile-model";
import { DocumentContentModelType, IDragTilesData } from "./document-content";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { DEBUG_DROP } from "../../lib/debug";

// TODO: move the drop tile logic here too

export function getTilePositions(tileIds: string[], documentContent?: DocumentContentModelType) {
  if (!documentContent) return [];
  return tileIds.map(tileId => {
    const rowId = documentContent.findRowContainingTile(tileId);
    const rowIndex = rowId && documentContent.getRowIndex(rowId) || 0;
    const row = rowId ? documentContent.getRow(rowId) : undefined;
    const tileIndex = row?.tiles.findIndex(t => t.tileId === tileId) || 0;
    return { tileId, rowIndex, row, tileIndex };
  });
}

export function getDragTileItems(documentContent: DocumentContentModelType, tileIds: string[]) {
  const dragTileItems: IDragTileItem[] = [];

  const idMap: { [id: string]: string } = {};
  tileIds.forEach(tileId => idMap[tileId] = uniqueId());

  const tilePositions = getTilePositions(tileIds, documentContent);

  tilePositions.forEach(({ tileId, rowIndex, row, tileIndex }) => {
    // Note: previously this function would be passed the tileModel being
    // dragged. It would accept a tileId if it matched the tileModel.id even if
    // `documentContent.getTile(tileId)` did not return a tile model. This seems
    // like it would mask an error and also complicates the code.
    const srcTile = documentContent.getTile(tileId);
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
    const rowHeight = row?.height;
    const clonedTile = cloneTileSnapshotWithNewId(srcTile, idMap[srcTile.id]);
    getTileContentInfo(clonedTile.content.type)?.contentSnapshotPostProcessor?.(clonedTile.content, idMap);
    dragTileItems.push({
      rowIndex, rowHeight, tileIndex,
      tileId: srcTile.id,
      tileContent: JSON.stringify(clonedTile),
      tileType: srcTile.content.type
    });
  });

  return dragTileItems;
}

// Sorts the given tile positions in top->bottom, left->right order IN PLACE!
export function orderTilePositions(tilePositions: ITilePosition[]) {
  tilePositions.sort((a, b) => {
    if (a.rowIndex < b.rowIndex) return -1;
    if (a.rowIndex > b.rowIndex) return 1;
    if (a.tileIndex < b.tileIndex) return -1;
    if (a.tileIndex > b.tileIndex) return 1;
    return 0;
  });
  return tilePositions;
}

/**
 *
 * @param documentContent
 * @param model this parameter will be removed when support is added for shared
 * models of multiple tiles
 * @param tileIds
 * @returns
 */
export function getDragTiles(
  documentContent: DocumentContentModelType,
  model: ITileModel,
  tileIds: string[]): IDragTilesData {

  const sharedManager = documentContent.tileEnv?.sharedModelManager;

  // This is an ephemeral id DocumentContent#contentId
  // it is like an instance id for the document content it
  // will change on each load of the document
  const sourceDocId = documentContent.contentId;

  const dragTiles: IDragTilesData = {
    sourceDocId,
    tiles: getDragTileItems(documentContent, tileIds),
    sharedModels: sharedManager?.getTileSharedModels(model.content) ?? []
  };

  // create a sorted array of selected tiles
  orderTilePositions(dragTiles.tiles);

  return dragTiles;
}

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
