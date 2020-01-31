import { types, getSnapshot, Instance, SnapshotIn } from "mobx-state-tree";
import { kDrawingToolID, StampModelType } from "../tools/drawing/drawing-content";
import { kGeometryToolID } from "../tools/geometry/geometry-content";
import { kImageToolID } from "../tools/image/image-content";
import { kPlaceholderToolID } from "../tools/placeholder/placeholder-content";
import { kTableToolID } from "../tools/table/table-content";
import { kTextToolID } from "../tools/text/text-content";
import { getToolContentInfoById } from "../tools/tool-content-info";
import { ToolContentUnionType } from "../tools/tool-types";
import { createToolTileModelFromContent, ToolTileModel, ToolTileModelType, ToolTileSnapshotOutType } from "../tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType, TileRowSnapshotOutType } from "../document/tile-row";
import { cloneDeep, each } from "lodash";
import * as uuid from "uuid/v4";
import { Logger, LogEventName } from "../../lib/logger";
import { IDragTileItem } from "../../models/tools/tool-tile";
import { DocumentsModelType } from "../stores/documents";
import { getParentWithTypeName } from "../../utilities/mst-utils";
import { DocumentTool, IDocumentAddTileOptions } from "./document";
import { safeJsonParse } from "../../utilities/js-utils";

export interface INewTileOptions {
  rowHeight?: number;
  rowIndex?: number;
}

export interface INewGeometryTileOptions extends INewTileOptions {
  addSidecarNotes?: boolean;
}

export interface INewTextTileOptions extends INewTileOptions {
  text?: string;
}

export interface INewImageTileOptions extends INewTileOptions {
  url?: string;
}

export interface INewRowTile {
  rowId: string;
  tileId: string;
  additionalTileIds?: string[];
}
export type NewRowTileArray = Array<INewRowTile | undefined>;

export interface IDropRowInfo {
  rowInsertIndex: number;
  rowDropIndex?: number;
  rowDropLocation?: string;
  updateTimestamp?: number;
}

export interface IDocumentContentAddTileOptions extends IDocumentAddTileOptions {
  insertRowInfo?: IDropRowInfo;
}

export interface ITileCountsPerSection {
  [key: string]: number;
}

export const DocumentContentModel = types
  .model("DocumentContent", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
    tileMap: types.map(ToolTileModel),
  })
  .preProcessSnapshot(snapshot => {
    return snapshot && (snapshot as any).tiles
            ? migrateSnapshot(snapshot)
            : snapshot;
  })
  .volatile(self => ({
    visibleRows: [] as string[],
    highlightPendingDropLocation: -1
  }))
  .views(self => {
    // used for drag/drop self-drop detection, for instance
    const contentId = uuid();

    function rowContainsTile(rowId: string, tileId: string) {
      const row = self.rowMap.get(rowId);
      return row
              ? row.tiles.findIndex(tile => tile.tileId === tileId) >= 0
              : false;
    }

    return {
      get isEmpty() {
        return self.tileMap.size === 0;
      },
      get contentId() {
        return contentId;
      },
      get firstTile(): ToolTileModelType | undefined {
        for (const rowId of self.rowOrder) {
          const row = rowId ? self.rowMap.get(rowId) : undefined;
          const tileId = row?.getTileIdAtIndex(0);
          const tile = tileId ? self.tileMap.get(tileId) : undefined;
          if (tile) return tile;
        }
      },
      getTile(tileId: string) {
        return tileId ? self.tileMap.get(tileId) : undefined;
      },
      getTileContent(tileId: string): ToolContentUnionType | undefined {
        const tile = self.tileMap.get(tileId);
        return tile && tile.content;
      },
      get rowCount() {
        return self.rowOrder.length;
      },
      getRow(rowId: string) {
        return self.rowMap.get(rowId);
      },
      getRowByIndex(index: number) {
        return self.rowMap.get(self.rowOrder[index]);
      },
      getRowIndex(rowId: string) {
        return self.rowOrder.findIndex(_rowId => _rowId === rowId);
      },
      findRowContainingTile(tileId: string) {
        return self.rowOrder.find(rowId => rowContainsTile(rowId, tileId));
      },
      numTilesInRow(rowId: string) {
        const row = self.rowMap.get(rowId);
        return row ? row.tiles.length : 0;
      },
      isPlaceholderRow(row: TileRowModelType) {
        // Note that more than one placeholder tile in a row shouldn't happen
        // in theory, but it has been known to happen as a result of bugs.
        return (row.tileCount > 0) &&
                row.tiles.every((entry, index) => {
                  const tileId = row.getTileIdAtIndex(index);
                  const tile = tileId && self.tileMap.get(tileId);
                  return tile ? tile.isPlaceholder : false;
                });
      },
      getRowsInSection(sectionId: string): TileRowModelType[] {
        let sectionRowIndex: number | undefined;
        let nextSectionRowIndex: number | undefined;
        self.rowOrder.forEach((rowId, i) => {
          const row = self.rowMap.get(rowId);
          if (row && (sectionRowIndex == null) && (sectionId === row.sectionId)) {
            sectionRowIndex = i;
          }
          else if (row && (sectionRowIndex != null) && (nextSectionRowIndex == null) && row.isSectionHeader) {
            nextSectionRowIndex = i;
          }
        });
        if (sectionRowIndex == null) return [];
        if (nextSectionRowIndex == null) nextSectionRowIndex = self.rowOrder.length;
        const rows = self.rowOrder.map(rowId => self.rowMap.get(rowId));
        const rowsInSection = rows.filter((row, i) => !!row && (i > sectionRowIndex!) && (i < nextSectionRowIndex!));
        return rowsInSection as TileRowModelType[];
      },
      get indexOfLastVisibleRow() {
        // returns last visible row or last row
        if (!self.rowOrder.length) return -1;
        const lastVisibleRowId = self.visibleRows.length
                                  ? self.visibleRows[self.visibleRows.length - 1]
                                  : self.rowOrder[self.rowOrder.length - 1];
        return  self.rowOrder.indexOf(lastVisibleRowId);
      },
      snapshotWithUniqueIds(asTemplate = false) {
        const snapshot = cloneDeep(getSnapshot(self));
        const idMap: { [id: string]: string } = {};

        snapshot.tileMap = (tileMap => {
          const _tileMap: { [id: string]: ToolTileSnapshotOutType } = {};
          each(tileMap, (tile, id) => {
            idMap[id] = tile.id = uuid();
            _tileMap[tile.id] = tile;
          });
          return _tileMap;
        })(snapshot.tileMap);

        each(snapshot.tileMap, tile => {
          getToolContentInfoById(tile.content.type)
            ?.snapshotPostProcessor?.(tile.content, idMap, asTemplate);
        });

        snapshot.rowMap = (rowMap => {
          const _rowMap: { [id: string]: TileRowSnapshotOutType } = {};
          each(rowMap, (row, id) => {
            idMap[id] = row.id = uuid();
            row.tiles = row.tiles.map(tileLayout => {
              tileLayout.tileId = idMap[tileLayout.tileId];
              return tileLayout;
            });
            _rowMap[row.id] = row;
          });
          return _rowMap;
        })(snapshot.rowMap);

        snapshot.rowOrder = snapshot.rowOrder.map(rowId => idMap[rowId]);

        return snapshot;
      }
    };
  })
  .views(self => ({
    getSectionTypeForPlaceholderRow(row: TileRowModelType) {
      if (!self.isPlaceholderRow(row)) return;
      const tile = self.getTile(row.tiles[0].tileId);
      return tile && tile.placeholderSectionId;
    },
    get defaultInsertRow() {
      // next tile comes after the last visible row with content
      for (let i = self.indexOfLastVisibleRow; i >= 0; --i) {
        const row = self.getRowByIndex(i);
        if (row && !row.isSectionHeader && !self.isPlaceholderRow(row)) {
          return i + 1;
        }
      }
      // if no tiles have content, insert after the first non-header row
      for (let i = 0; i < self.rowCount; ++i) {
        const row = self.getRowByIndex(i);
        if (row && !row.isSectionHeader) {
          return i;
        }
      }
      // if all else fails, revert to last visible row
      return self.indexOfLastVisibleRow + 1;
    },
    getTilesInSection(sectionId: string) {
      const tiles: ToolTileModelType[] = [];
      const rows = self.getRowsInSection(sectionId);
      rows.forEach(row => {
        row.tiles
          .map(tileLayout => self.tileMap.get(tileLayout.tileId))
          .forEach(tile => tile && !tile.isPlaceholder && tiles.push(tile));
      });
      return tiles;
    },
    publish() {
      return JSON.stringify(self.snapshotWithUniqueIds());
    }
  }))
  .views(self => ({
    getTileCountsPerSection(sectionIds: string[]): ITileCountsPerSection {
      const counts: ITileCountsPerSection = {};
      sectionIds.forEach(sectionId => {
        counts[sectionId] = self.getTilesInSection(sectionId).length;
      });
      return counts;
    }
  }))
  .actions(self => ({
    insertRow(row: TileRowModelType, index?: number) {
      self.rowMap.put(row);
      if ((index != null) && (index < self.rowOrder.length)) {
        self.rowOrder.splice(index, 0, row.id);
      }
      else {
        self.rowOrder.push(row.id);
      }
    },
    deleteRow(rowId: string) {
      self.rowOrder.remove(rowId);
      self.rowMap.delete(rowId);
    },
    insertNewTileInRow(tile: ToolTileModelType, row: TileRowModelType, tileIndexInRow?: number) {
      row.insertTileInRow(tile, tileIndexInRow);
      self.tileMap.put(tile);
    },
    deleteTilesFromRow(row: TileRowModelType) {
      row.tiles
        .map(layout => layout.tileId)
        .forEach(tileId => {
          row.removeTileFromRow(tileId);
          self.tileMap.delete(tileId);
        });
    },
    setVisibleRows(rows: string[]) {
      self.visibleRows = rows;
    }
  }))
  .actions(self => ({
    addSectionHeaderRow(sectionId: string) {
      self.insertRow(TileRowModel.create({ isSectionHeader: true, sectionId }));
    },
    addNewTileInNewRowAtIndex(tile: ToolTileModelType, rowIndex: number) {
      const row = TileRowModel.create({});
      self.insertRow(row, rowIndex);
      self.insertNewTileInRow(tile, row);
      return row;
    }
  }))
  .actions(self => ({
    removeNeighboringPlaceholderRows(rowIndex: number) {
      const beforeRow = rowIndex > 0 ? self.getRowByIndex(rowIndex - 1) : undefined;
      const afterRow = rowIndex < self.rowCount - 1 ? self.getRowByIndex(rowIndex + 1) : undefined;
      if (afterRow && self.isPlaceholderRow(afterRow)) {
        self.deleteRow(afterRow.id);
      }
      if (beforeRow && self.isPlaceholderRow(beforeRow)) {
        self.deleteRow(beforeRow.id);
      }
    },
    addPlaceholderRowIfAppropriate(rowIndex: number) {
      const beforeRow = (rowIndex > 0) && self.getRowByIndex(rowIndex - 1);
      const afterRow = (rowIndex < self.rowCount) && self.getRowByIndex(rowIndex);
      if ((beforeRow && beforeRow.isSectionHeader) && (!afterRow || afterRow.isSectionHeader)) {
        const beforeSectionId = beforeRow.sectionId;
        const placeholderContentInfo = getToolContentInfoById(kPlaceholderToolID);
        const tile = ToolTileModel.create({ content: placeholderContentInfo?.defaultContent(beforeSectionId) });
        self.addNewTileInNewRowAtIndex(tile, rowIndex);
      }
    }
  }))
  .actions(self => ({
    afterCreate() {
      self.rowMap.forEach(row => {
        row.updateLayout(self.tileMap);
      });
      // fix any "collapsed" sections
      for (let i = 1; i < self.rowCount; ++i) {
        self.addPlaceholderRowIfAppropriate(i);
      }
    },
    addTileInNewRow(content: ToolContentUnionType, options?: INewTileOptions): INewRowTile {
      const tile = createToolTileModelFromContent(content);
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRow;
      }
      const row = self.addNewTileInNewRowAtIndex(tile, o.rowIndex);
      self.removeNeighboringPlaceholderRows(o.rowIndex);
      if (o.rowHeight) {
        row.setRowHeight(o.rowHeight);
      }
      return { rowId: row.id, tileId: tile.id };
    },
    addTileInExistingRow(content: ToolContentUnionType, options: INewTileOptions): INewRowTile | undefined {
      const tile = createToolTileModelFromContent(content);
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRow;
      }
      const row = self.getRowByIndex(o.rowIndex);
      if (row) {
        self.insertNewTileInRow(tile, row);
        self.removeNeighboringPlaceholderRows(o.rowIndex);
        if (o.rowHeight) {
          row.setRowHeight(Math.max((row.height || 0), o.rowHeight));
        }
        return { rowId: row.id, tileId: tile.id };
      }
    },
    deleteRowAddingPlaceholderRowIfAppropriate(rowId: string) {
      const rowIndex = self.getRowIndex(rowId);
      self.deleteRow(rowId);
      self.addPlaceholderRowIfAppropriate(rowIndex);
    },
    showPendingInsertHighlight(show: boolean) {
      self.highlightPendingDropLocation = show ? self.defaultInsertRow : -1;
    }
  }))
  .actions((self) => ({
    addPlaceholderTile(sectionId?: string) {
      const placeholderContentInfo = getToolContentInfoById(kPlaceholderToolID);
      const content = placeholderContentInfo?.defaultContent(sectionId);
      return self.addTileInNewRow(content, { rowIndex: self.rowCount });
    },
    addGeometryTile(options?: INewGeometryTileOptions) {
      const geometryContentInfo = getToolContentInfoById(kGeometryToolID);
      const result = self.addTileInNewRow(
                            geometryContentInfo?.defaultContent(),
                            { rowHeight: geometryContentInfo?.defaultHeight, ...options });
      if (options?.addSidecarNotes) {
        const { rowId } = result;
        const row = self.rowMap.get(rowId);
        const textContentInfo = getToolContentInfoById(kTextToolID);
        if (row && textContentInfo) {
          const tile = createToolTileModelFromContent(textContentInfo.defaultContent());
          self.insertNewTileInRow(tile, row, 1);
          result.additionalTileIds = [ tile.id ];
        }
      }
      return result;
    },
    addTableTile(options?: INewTileOptions) {
      const tableContentInfo = getToolContentInfoById(kTableToolID);
      return self.addTileInNewRow(
                    tableContentInfo?.defaultContent(),
                    { rowHeight: tableContentInfo?.defaultHeight, ...options });
    },
    addTextTile(options?: INewTextTileOptions) {
      const textContentInfo = getToolContentInfoById(kTextToolID);
      return self.addTileInNewRow(textContentInfo?.defaultContent(options?.text), options);
    },
    addImageTile(options?: INewImageTileOptions) {
      const imageContentInfo = getToolContentInfoById(kImageToolID);
      return self.addTileInNewRow(imageContentInfo?.defaultContent(options?.url), options);
    },
    addDrawingTile(options?: INewTileOptions) {
      let defaultStamps: StampModelType[];
      const documents = getParentWithTypeName(self, "Documents") as DocumentsModelType;
      if (documents && documents.unit) {
        defaultStamps = getSnapshot(documents.unit.defaultStamps);
      } else {
        defaultStamps = [];
      }
      const drawingContentInfo = getToolContentInfoById(kDrawingToolID);
      return self.addTileInNewRow(
                    drawingContentInfo?.defaultContent({stamps: defaultStamps}),
                    { rowHeight: drawingContentInfo.defaultHeight, ...options });
    },
    copyTilesIntoNewRows(tiles: IDragTileItem[], rowIndex: number) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        let rowDelta = 0;
        let lastRowIndex = -1;
        tiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const content = safeJsonParse(tile.tileContent).content;
          if (content) {
            const rowOptions: INewTileOptions = {
              rowIndex: rowIndex + rowDelta
            };
            if (tile.rowHeight) {
              rowOptions.rowHeight = tile.rowHeight;
            }
            if (tile.rowIndex !== lastRowIndex) {
              result = self.addTileInNewRow(content, rowOptions);
              if (lastRowIndex !== -1) {
                rowDelta++;
              }
              lastRowIndex = tile.rowIndex;
            }
            else {
              result = self.addTileInExistingRow(content, rowOptions);
            }
          }
          results.push(result);
        });
      }
      return results;
    },
    moveRowToIndex(rowIndex: number, newRowIndex: number) {
      if (newRowIndex === 0) {
        const dstRowId = self.rowOrder[0];
        const dstRow = dstRowId && self.rowMap.get(dstRowId);
        if (dstRow && dstRow.isSectionHeader) {
          return;
        }
      }
      const rowId = self.rowOrder[rowIndex];
      self.rowOrder.splice(rowIndex, 1);
      self.rowOrder.splice(newRowIndex <= rowIndex ? newRowIndex : newRowIndex - 1, 0, rowId);
      self.addPlaceholderRowIfAppropriate(newRowIndex <= rowIndex ? rowIndex + 1 : rowIndex);
      self.removeNeighboringPlaceholderRows(self.getRowIndex(rowId));
    },
    moveTileToRow(tileId: string, rowIndex: number, tileIndex?: number) {
      const srcRowId = self.findRowContainingTile(tileId);
      const srcRow = srcRowId && self.rowMap.get(srcRowId);
      const dstRowId = self.rowOrder[rowIndex];
      const dstRow = dstRowId && self.rowMap.get(dstRowId);
      const tile = self.getTile(tileId);
      if (srcRow && dstRow && tile && !dstRow.isSectionHeader) {
        if (srcRow === dstRow) {
          // move a tile within a row
          const srcIndex = srcRow.indexOfTile(tileId);
          const dstIndex = tileIndex != null ? tileIndex : dstRow.tiles.length;
          dstRow.moveTileInRow(tileId, srcIndex, dstIndex);
        }
        else {
          // move a tile from one row to another
          if (self.isPlaceholderRow(dstRow)) {
            self.deleteTilesFromRow(dstRow);
          }
          dstRow.insertTileInRow(tile, tileIndex);
          if (srcRow.height && tile.isUserResizable &&
              (!dstRow.height || (srcRow.height > dstRow.height))) {
            dstRow.height = srcRow.height;
          }
          srcRow.removeTileFromRow(tileId);
          if (!srcRow.tiles.length) {
            self.deleteRowAddingPlaceholderRowIfAppropriate(srcRow.id);
          }
        }
      }
    },
    moveTileToNewRow(tileId: string, rowIndex: number) {
      const srcRowId = self.findRowContainingTile(tileId);
      const srcRow = srcRowId && self.rowMap.get(srcRowId);
      const tile = self.getTile(tileId);
      if (!srcRowId || !srcRow || !tile) return;

      // create tile, insert tile, insert row
      const rowSpec: TileRowSnapshotType = {};
      if (tile.isUserResizable) {
        rowSpec.height = srcRow.height;
      }
      const dstRow = TileRowModel.create(rowSpec);
      dstRow.insertTileInRow(tile);
      self.insertRow(dstRow, rowIndex);
      self.removeNeighboringPlaceholderRows(rowIndex);

      // remove tile from source row
      srcRow.removeTileFromRow(tileId);
      if (!srcRow.tiles.length) {
        self.deleteRowAddingPlaceholderRowIfAppropriate(srcRowId);
      }
      else {
        if (!srcRow.isUserResizable) {
          srcRow.height = undefined;
        }
      }
    }
  }))
  .actions(self => {
    const actions = {
      deleteTile(tileId: string) {
        const rowsToDelete: TileRowModelType[] = [];
        self.rowMap.forEach(row => {
          // remove from row
          if (row.hasTile(tileId)) {
            const tile = self.getTile(tileId);
            tile && tile.willRemoveFromDocument();
            row.removeTileFromRow(tileId);
          }
          // track empty rows
          if (row.isEmpty) {
            rowsToDelete.push(row);
          }
        });
        // remove empty rows
        rowsToDelete.forEach(row => {
          self.deleteRowAddingPlaceholderRowIfAppropriate(row.id);
        });
        // delete tile
        self.tileMap.delete(tileId);
      },
      moveTile(tileId: string, rowInfo: IDropRowInfo, tileIndex: number = 0) {
        const srcRowId = self.findRowContainingTile(tileId);
        if (!srcRowId) return;
        const srcRowIndex = self.getRowIndex(srcRowId);
        const { rowInsertIndex, rowDropIndex, rowDropLocation } = rowInfo;
        if ((rowDropIndex != null) && (rowDropLocation === "left")) {
          self.moveTileToRow(tileId, rowDropIndex, tileIndex);
          return;
        }
        if ((rowDropIndex != null) && (rowDropLocation === "right")) {
          self.moveTileToRow(tileId, rowDropIndex);
          return;
        }
        if ((srcRowIndex >= 0)) {
          // if only one tile in source row, move the entire row
          if (self.numTilesInRow(srcRowId) === 1) {
            if (rowInsertIndex !== srcRowIndex) {
              self.moveRowToIndex(srcRowIndex, rowInsertIndex);
            }
          }
          else {
            self.moveTileToNewRow(tileId, rowInsertIndex);
          }
        }
      },
      addTile(tool: DocumentTool, options?: IDocumentContentAddTileOptions) {
        const {addSidecarNotes, url, insertRowInfo} = options || {};
        // for historical reasons, this function initially places new rows at
        // the end of the content and then moves them to the desired location.
        const addTileOptions = { rowIndex: self.rowCount };
        let tileInfo;
        switch (tool) {
          case "text":
            tileInfo = self.addTextTile(addTileOptions);
            break;
          case "table":
            tileInfo = self.addTableTile(addTileOptions);
            break;
          case "geometry":
            tileInfo = self.addGeometryTile({ addSidecarNotes, ...addTileOptions });
            break;
          case "image":
            tileInfo = self.addImageTile({ url, ...addTileOptions });
            break;
          case "drawing":
            tileInfo = self.addDrawingTile(addTileOptions);
            break;
        }

        // TODO: For historical reasons, this function initially places new rows at the end of the content
        // and then moves them to their desired locations from there using the insertRowInfo to specify the
        // desired destination. The underlying addTileInNewRow() function has a separate mechanism for specifying
        // the location of newly created rows. It would be better to eliminate the redundant insertRowInfo
        // specification used by this function and instead just use the one from addTileInNewRow().
        if (tileInfo && insertRowInfo) {
          // Move newly-create tile(s) into requested row. If we have created more than one tile, e.g. the sidecar text
          // for the graph tool, we need to insert the tiles one after the other. If we are inserting on the left, we
          // have to reverse the order of insertion. If we are inserting into a new row, the first tile is inserted
          // into a new row and then the sidecar tiles into that same row. This makes the logic rather verbose...
          const { rowDropLocation } = insertRowInfo;

          let tileIdsToMove;
          if (tileInfo.additionalTileIds) {
            tileIdsToMove = [tileInfo.tileId, ...tileInfo.additionalTileIds];
            if (rowDropLocation && rowDropLocation === "left") {
              tileIdsToMove = tileIdsToMove.reverse();
            }
          } else {
            tileIdsToMove = [tileInfo.tileId];
          }

          const moveSubsequentTilesRight = !rowDropLocation
                                           || rowDropLocation === "bottom"
                                           || rowDropLocation === "top";

          let firstTileId: string | undefined;
          tileIdsToMove.forEach((id, i) => {
            if (i === 0) {
              firstTileId = id;
            }
            else {
              if (moveSubsequentTilesRight) {
                const newRowId = firstTileId && self.findRowContainingTile(firstTileId);
                const newRowIndex = newRowId ? self.getRowIndex(newRowId) : undefined;
                insertRowInfo.rowDropLocation = "right";
                if (newRowIndex != null) {
                  insertRowInfo.rowInsertIndex = insertRowInfo.rowDropIndex = newRowIndex;
                }
              }
            }
            actions.moveTile(id, insertRowInfo);
          });
        }
        return tileInfo;
      }
    };
    return actions;
  })
  .actions(self => ({
    mergeRow(srcRow: TileRowModelType, rowInfo: IDropRowInfo) {
      const rowId = srcRow.id;
      srcRow.tiles.forEach((tile, index) => {
        self.moveTile(tile.tileId, rowInfo, index);
      });
      self.deleteRow(rowId);
    },
    moveTilesToNewRowAtIndex(rowTiles: IDragTileItem[], rowIndex: number) {
      rowTiles.forEach((tile, index) => {
        if (index === 0) {
          self.moveTileToNewRow(tile.tileId, rowIndex);
        }
        else {
          self.moveTileToRow(tile.tileId, rowIndex);
        }
      });
    },
    moveTilesToExistingRowAtIndex(rowTiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      rowTiles.forEach((tile, index) => {
        self.moveTile(tile.tileId, rowInfo, index);
      });
    }
  }))
  .actions(self => ({
    moveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      if (tiles.length > 0) {
        // organize tiles by row
        const tileRows: {[index: number]: IDragTileItem[]} = {};
        tiles.forEach(tile => {
          tileRows[tile.rowIndex] = tileRows[tile.rowIndex] || [];
          tileRows[tile.rowIndex].push(tile);
        });

        // move each row
        const { rowInsertIndex, rowDropLocation } = rowInfo;
        Object.values(tileRows).forEach(rowTiles => {
          const rowIndex = rowTiles[0].rowIndex;
          const row = self.getRowByIndex(rowIndex);
          if (row?.tiles.length === rowTiles.length) {
            if ((rowDropLocation === "left") || (rowDropLocation === "right")) {
              // entire row is being merged with an existing row
              const dstRow = rowInfo.rowDropIndex ? self.getRowByIndex(rowInfo.rowDropIndex) : undefined;
              if ((rowIndex !== rowInfo.rowDropIndex) && (dstRow && !dstRow.isSectionHeader)) {
                self.mergeRow(row, rowInfo);
              }
            }
            else {
              // entire row is being moved to a new row
              if ((rowInsertIndex < rowIndex) || (rowInsertIndex > rowIndex + 1)) {
                self.moveRowToIndex(rowIndex, rowInsertIndex);
              }
            }
          }
          else {
            if ((rowDropLocation === "left") || (rowDropLocation === "right")) {
              // part of row is being moved to an existing row
              self.moveTilesToExistingRowAtIndex(rowTiles, rowInfo);
            }
            else {
              // part of row is being moved to a new row
              self.moveTilesToNewRowAtIndex(rowTiles, rowInsertIndex);
            }
          }
        });
      }
    }
  }))
  .actions(self => ({
    userAddTile(tool: DocumentTool, options?: IDocumentContentAddTileOptions) {
      const result = self.addTile(tool, options);
      const newTile = result?.tileId && self.getTile(result.tileId);
      if (newTile) {
        Logger.logTileEvent(LogEventName.CREATE_TILE, newTile);
      }
      return result;
    },
    userDeleteTile(tileId: string) {
      Logger.logTileEvent(LogEventName.DELETE_TILE, self.getTile(tileId));
      self.deleteTile(tileId);
    },
    userMoveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      tiles.forEach(tile => Logger.logTileEvent(LogEventName.MOVE_TILE, self.getTile(tile.tileId)));
      self.moveTiles(tiles, rowInfo);
    },
    userCopyTiles(tiles: IDragTileItem[], rowIndex: number) {
      const results = self.copyTilesIntoNewRows(tiles, rowIndex);
      results.forEach((result, i) => {
        const newTile = result?.tileId && self.getTile(result.tileId);
        if (result && newTile) {
          const originalTileId = tiles[i].tileId;
          Logger.logTileEvent(LogEventName.COPY_TILE, newTile, { originalTileId });
        }
      });
      return results;
    }
  }));

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
  tiles: IAuthoredTile[];
}

function migrateSnapshot(snapshot: any): any {
  interface OriginalTileLayoutModel {
    height?: number;
  }

  interface OriginalToolTileModel {
    layout?: OriginalTileLayoutModel;
    content: any;
  }

  const docContent = DocumentContentModel.create();
  const tiles: OriginalToolTileModel[] = snapshot.tiles;
  tiles.forEach(tile => {
    const newTile = cloneDeep(tile);
    const tileHeight = newTile.layout && newTile.layout.height;
    const { isSectionHeader, sectionId } = newTile.content;
    if (isSectionHeader && sectionId) {
      docContent.addSectionHeaderRow(sectionId);
    }
    else {
      const options = { rowIndex: docContent.rowCount, rowHeight: tileHeight };
      docContent.addTileInNewRow(newTile.content, options);
    }
  });
  return getSnapshot(docContent);
}

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
