import { types, getSnapshot, Instance, SnapshotIn, SnapshotOut } from "mobx-state-tree";
import { defaultDrawingContent, kDrawingDefaultHeight, StampModelType } from "../tools/drawing/drawing-content";
import { defaultGeometryContent, kGeometryDefaultHeight, GeometryContentModelType, mapTileIdsInGeometrySnapshot
        } from "../tools/geometry/geometry-content";
import { defaultImageContent } from "../tools/image/image-content";
import { defaultPlaceholderContent } from "../tools/placeholder/placeholder-content";
import { defaultTableContent, kTableDefaultHeight, TableContentModelType, mapTileIdsInTableSnapshot
        } from "../tools/table/table-content";
import { defaultTextContent } from "../tools/text/text-content";
import { ToolContentUnionType } from "../tools/tool-types";
import { createToolTileModelFromContent, ToolTileModel, ToolTileModelType, ToolTileSnapshotOutType } from "../tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType, TileRowSnapshotOutType } from "../document/tile-row";
import { cloneDeep, each } from "lodash";
import * as uuid from "uuid/v4";
import { Logger, LogEventName } from "../../lib/logger";
import { DocumentsModelType } from "../stores/documents";
import { getParentWithTypeName } from "../../utilities/mst-utils";
import { IDropRowInfo } from "../../components/document/document-content";
import { DocumentTool, IDocumentAddTileOptions } from "./document";
import { safeJsonParse } from "../../utilities/js-utils";

export interface INewTileOptions {
  rowHeight?: number;
  rowIndex?: number;
  action?: LogEventName;
  loggingMeta?: {};
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
        if (row.tileCount !== 1) return false;
        const tileId = row.getTileIdAtIndex(0);
        const tile = tileId && self.tileMap.get(tileId);
        return tile ? tile.isPlaceholder : false;
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
      snapshotWithUniqueIds() {
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

        each(snapshot.tileMap, (tile, id) => {
          const tileContent = tile.content;
          switch (tileContent.type) {
            case "Geometry":
              const geometryContentSnapshot: SnapshotOut<GeometryContentModelType> = tileContent;
              mapTileIdsInGeometrySnapshot(geometryContentSnapshot, idMap);
              break;
            case "Table":
              const tableContentSnapshot: SnapshotOut<TableContentModelType> = tileContent;
              mapTileIdsInTableSnapshot(tableContentSnapshot, idMap);
              break;
          }
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
    afterCreate() {
      self.rowMap.forEach(row => {
        row.updateLayout(self.tileMap);
      });
    },
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
        const tile = ToolTileModel.create({ content: defaultPlaceholderContent(beforeSectionId) });
        self.addNewTileInNewRowAtIndex(tile, rowIndex);
      }
    }
  }))
  .actions(self => ({
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

      const action = o.action || LogEventName.CREATE_TILE;
      Logger.logTileEvent(action, tile, o.loggingMeta);

      return { rowId: row.id, tileId: tile.id };
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
      const content = defaultPlaceholderContent(sectionId);
      return self.addTileInNewRow(content, { rowIndex: self.rowCount });
    },
    addGeometryTile(options?: INewGeometryTileOptions) {
      const result = self.addTileInNewRow(
                            defaultGeometryContent(),
                            { rowHeight: kGeometryDefaultHeight, ...options });
      if (options && options.addSidecarNotes) {
        const { rowId } = result;
        const row = self.rowMap.get(rowId);
        if (row) {
          const tile = createToolTileModelFromContent(defaultTextContent());
          self.insertNewTileInRow(tile, row, 1);
          result.additionalTileIds = [ tile.id ];
        }
      }
      return result;
    },
    addTableTile(options?: INewTileOptions) {
      return self.addTileInNewRow(
                    defaultTableContent(),
                    { rowHeight: kTableDefaultHeight, ...options });
    },
    addTextTile(options?: INewTextTileOptions) {
      return self.addTileInNewRow(defaultTextContent(options && options.text), options);
    },
    addImageTile(options?: INewImageTileOptions) {
      return self.addTileInNewRow(defaultImageContent(options && options.url), options);
    },
    addDrawingTile(options?: INewTileOptions) {
      let defaultStamps: StampModelType[];
      const documents = getParentWithTypeName(self, "Documents") as DocumentsModelType;
      if (documents && documents.unit) {
        defaultStamps = getSnapshot(documents.unit.defaultStamps);
      } else {
        defaultStamps = [];
      }
      return self.addTileInNewRow(
                    defaultDrawingContent({stamps: defaultStamps}),
                    { rowHeight: kDrawingDefaultHeight, ...options });
    },
    copyTileIntoNewRow(serializedTile: string, originalTileId: string, rowIndex: number, originalRowHeight?: number) {
      const snapshot = safeJsonParse(serializedTile);
      if (snapshot) {
        const newRowOptions: INewTileOptions = {
          rowIndex,
          action: LogEventName.COPY_TILE,
          loggingMeta: {
            originalTileId
          }
        };
        if (originalRowHeight) {
          newRowOptions.rowHeight = originalRowHeight;
        }
        self.addTileInNewRow(snapshot.content, newRowOptions);
      }
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
        Logger.logTileEvent(LogEventName.DELETE_TILE, self.tileMap.get(tileId));

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
      moveTile(tileId: string, rowInfo: IDropRowInfo) {
        const srcRowId = self.findRowContainingTile(tileId);
        if (!srcRowId) return;
        const srcRowIndex = self.getRowIndex(srcRowId);
        const { rowInsertIndex, rowDropIndex, rowDropLocation } = rowInfo;
        if ((rowDropIndex != null) && (rowDropLocation === "left")) {
          self.moveTileToRow(tileId, rowDropIndex, 0);
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
  });

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

export function cloneContentWithUniqueIds(content?: DocumentContentModelType): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds());
}
