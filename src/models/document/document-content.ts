import { cloneDeep, each } from "lodash";
import { types, getSnapshot, Instance, SnapshotIn, getType, getEnv } from "mobx-state-tree";
import { PlaceholderContentModel } from "../tools/placeholder/placeholder-content";
import { kTextToolID } from "../tools/text/text-content";
import { getToolContentInfoById, IDocumentExportOptions } from "../tools/tool-content-info";
import { ToolContentModelType } from "../tools/tool-types";
import {
  ToolTileModel, ToolTileModelType, ToolTileSnapshotInType, ToolTileSnapshotOutType
} from "../tools/tool-tile";
import {
  TileRowModel, TileRowModelType, TileRowSnapshotType, TileRowSnapshotOutType, TileLayoutModelType
} from "../document/tile-row";
import { migrateSnapshot } from "./document-content-import";
import { IDocumentAddTileOptions } from "./document-types";
import { Logger, LogEventName } from "../../lib/logger";
import { IDragTileItem } from "../../models/tools/tool-tile";
import { safeJsonParse, uniqueId } from "../../utilities/js-utils";
import { comma, StringBuilder } from "../../utilities/string-builder";
import { SharedModel, SharedModelType, SharedModelUnion } from "../tools/shared-model";
import { IDocumentEnvironment } from "./document";

export interface INewTileOptions {
  rowHeight?: number;
  rowIndex?: number;
  locationInRow?: string;
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

export interface IDragToolCreateInfo {
  toolId: string;
  title?: string;
}

export interface ITileCountsPerSection {
  [key: string]: number;
}

// This intermediate type is added so we can store which tiles are using the
// shared model. It is also necessary so the SharedModelUnion can be evaluated
// late. If the sharedModelMap was a map directly to SharedModelUnion the late
// evaluation would happen immediately and not pick up the registered shared
// model tiles. This issue with using late and maps is documented here:
// `src/models/mst.test.ts`
export const SharedModelEntry = types.model("SharedModelEntry", {
  sharedModel: SharedModelUnion,
  provider: types.safeReference(ToolTileModel, {acceptsUndefined: true}),
  tiles: types.array(types.safeReference(ToolTileModel, {acceptsUndefined: false}))
})
.actions(self => ({
  addTile(toolTile: ToolTileModelType, isProvider?: boolean) {
    isProvider && (self.provider = toolTile);
    self.tiles.push(toolTile);
  },
  removeTile(toolTile: ToolTileModelType) {
    (toolTile.id === self.provider?.id) && (self.provider = undefined);
    self.tiles.remove(toolTile);
  }
}));
export type SharedModelEntryType = Instance<typeof SharedModelEntry>;

export const DocumentContentModel = types
  .model("DocumentContent", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
    tileMap: types.map(ToolTileModel),
    // The keys to this map should be the id of the shared model
    sharedModelMap: types.map(SharedModelEntry),
  })
  .preProcessSnapshot(snapshot => {
    return snapshot && (snapshot as any).tiles
            ? migrateSnapshot(snapshot)
            : snapshot;
  })
  .volatile(self => ({
    visibleRows: [] as string[],
    highlightPendingDropLocation: -1,
    importContextCurrentSection: "",
    importContextTileCounts: {} as Record<string, number>
  }))
  .views(self => {
    // used for drag/drop self-drop detection, for instance
    const contentId = uniqueId();

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
      getTileContent(tileId: string): ToolContentModelType | undefined {
        return self.tileMap.get(tileId)?.content;
      },
      getTileType(tileId: string) {
        return self.tileMap.get(tileId)?.content.type;
      },
      get rowCount() {
        return self.rowOrder.length;
      },
      getRow(rowId: string): TileRowModelType | undefined {
        return self.rowMap.get(rowId);
      },
      getRowByIndex(index: number): TileRowModelType | undefined {
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
      getSectionIdForTile(tileId: string) {
        let sectionId = "";
        const foundRow = self.rowOrder.find((rowId, i) => {
          const row = self.rowMap.get(rowId);
          row?.sectionId && (sectionId = row?.sectionId);
          return row?.hasTile(tileId);
        });
        return foundRow ? sectionId : undefined;
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
        const tileIdMap: { [id: string]: string } = {};

        snapshot.tileMap = (tileMap => {
          const _tileMap: { [id: string]: ToolTileSnapshotOutType } = {};
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
        });
        // TODO: Give the shared models new ids

        each(snapshot.tileMap, tile => {
          getToolContentInfoById(tile.content.type)
            ?.snapshotPostProcessor?.(tile.content, tileIdMap, asTemplate);
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
      getFirstSharedModelByType<IT extends typeof SharedModel>(
        modelType: IT, tileId?: string): IT["Type"] | undefined {
        const sharedModelEntries = Array.from(self.sharedModelMap.values());
        // Even if we use a snapshotProcessor generated type, getType will return the original
        // type. This is documented: src/models/mst.test.ts
        const firstEntry = sharedModelEntries.find(entry =>
          (getType(entry.sharedModel) === modelType) &&
          (!tileId || !!entry.tiles.find(tile => tileId === tile.id)));
        return firstEntry?.sharedModel;
      },
      getSharedModelsByType<IT extends typeof SharedModel>(type: string): IT["Type"][] {
        const sharedModelEntries = Array.from(self.sharedModelMap.values());
        return sharedModelEntries.map(entry => entry.sharedModel).filter(model => model.type === type);
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
    getTilesInDocumentOrder(): string[] {
      // Returns list of tile ids in the document from top to bottom, left to right
      const tiles: string[] = [];
      self.rowOrder.forEach(rowId => {
        const row = self.getRow(rowId);
        if (row) {
           tiles.push(...row.tiles.map(tile=>tile.tileId));
        }
      });
      return tiles;
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
    getTilesOfType(type: string) {
      const tiles: string[] = [];
      self.rowOrder.forEach(rowId => {
        const row = self.getRow(rowId);
        each(row?.tiles, tileEntry => {
          if (self.getTileType(tileEntry.tileId) === type) {
            tiles.push(tileEntry.tileId);
          }
        });
      });
      return tiles;
    },
    publish() {
      return JSON.stringify(self.snapshotWithUniqueIds());
    },
    exportTileAsJson(tileInfo: TileLayoutModelType, options?: IDocumentExportOptions) {
      const { includeTileIds, ...otherOptions } = options || {};
      const tileOptions = { includeId: includeTileIds, ...otherOptions};
      const tile = self.getTile(tileInfo.tileId);
      const json = tile?.exportJson(tileOptions);
      if (json) {
        return json.concat(comma(!!options?.appendComma));
      }
    }
  }))
  .views(self => ({
    rowHeightToExport(row: TileRowModelType, tileId: string) {
      if (!row?.height) return;
      // we only export heights for specific tiles configured to do so
      const tileType = self.getTileType(tileId);
      const tileContentInfo = getToolContentInfoById(tileType);
      if (!tileContentInfo?.exportNonDefaultHeight) return;
      // we only export heights when they differ from the default height for the tile
      const defaultHeight = tileContentInfo.defaultHeight;
      return defaultHeight && (row.height !== defaultHeight) ? row.height : undefined;
    }
  }))
  .views(self => ({
    getUniqueTitle(tileType: string, titleBase: string, getTileTitle: (tileId: string) => string | undefined) {
      const tiles = self.getTilesOfType(tileType);
      const maxDefaultTitleIndex = tiles.reduce((maxIndex: number, tileId: string) => {
        const title = getTileTitle(tileId);
        const match = title?.match(new RegExp(`${titleBase} (\\d+)`));
        return match?.[1]
                ? Math.max(maxIndex, +match[1])
                : maxIndex;
      }, 0);
      return `${titleBase} ${maxDefaultTitleIndex + 1}`;
    },
    getTileCountsPerSection(sectionIds: string[]): ITileCountsPerSection {
      const counts: ITileCountsPerSection = {};
      sectionIds.forEach(sectionId => {
        counts[sectionId] = self.getTilesInSection(sectionId).length;
      });
      return counts;
    },
    exportAsJson(options?: IDocumentExportOptions) {
      const builder = new StringBuilder();
      builder.pushLine("{");
      builder.pushLine(`"tiles": [`, 2);

      // identify rows with exportable tiles
      const rowsToExport = self.rowOrder.map(rowId => {
        const row = self.getRow(rowId);
        return row && !row.isSectionHeader && !row.isEmpty && !self.isPlaceholderRow(row) ? row : undefined;
      }).filter(row => !!row);

      const exportRowCount = rowsToExport.length;
      rowsToExport.forEach((row, rowIndex) => {
        const isLastRow = rowIndex === exportRowCount - 1;
        // export each exportable tile
        const tileExports = row?.tiles.map((tileInfo, tileIndex) => {
          const isLastTile = tileIndex === row.tiles.length - 1;
          const showComma = row.tiles.length > 1 ? !isLastTile : !isLastRow;
          const rowHeight = self.rowHeightToExport(row, tileInfo.tileId);
          const rowHeightOption = rowHeight ? { rowHeight } : undefined;
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

      builder.pushLine("]", 2);
      builder.pushLine("}");
      return builder.build();
    }
  }))
  .views(self => ({
    getNewTileTitle(tileContent: ToolContentModelType) {
      const titleBase = getToolContentInfoById(tileContent.type)?.titleBase || tileContent.type;
      const getTitle = (tileId: string) => (self.getTile(tileId) as any)?.title;
      const newTitle = self.getUniqueTitle(tileContent.type, titleBase, getTitle);
      return newTitle;
    }
  }))
  .actions(self => ({
    setImportContext(section: string) {
      self.importContextCurrentSection = section;
      self.importContextTileCounts = {};
    },
    getNextTileId(tileType: string) {
      if (!self.importContextTileCounts[tileType]) {
        self.importContextTileCounts[tileType] = 1;
      } else {
        ++self.importContextTileCounts[tileType];
      }
      // FIXME: This doesn't generate unique ids.
      // Many sections seem to be unnamed, so they never set the importContextCurrentSection.
      // The result is tiles in different sections (including different investigations and problems)
      // have the same id, and in turn share the same metadata.
      const section = self.importContextCurrentSection || "document";
      return `${section}_${tileType}_${self.importContextTileCounts[tileType]}`;
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
        const content = PlaceholderContentModel.create({sectionId: beforeSectionId});
        const tile = ToolTileModel.create({ content });
        self.addNewTileInNewRowAtIndex(tile, rowIndex);
      }
    },
    removePlaceholderTilesFromRow(rowIndex: number) {
      const isPlaceholderTile = (tileId: string) => {
        return self.getTileType(tileId) === "Placeholder";
      };
      const row = self.getRowByIndex(rowIndex);
      row?.removeTilesFromRow(isPlaceholderTile);
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
    addTileInNewRow(tile: ToolTileModelType, options?: INewTileOptions): INewRowTile {
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
    }
  }))
  .actions(self => ({
    addTileContentInNewRow(content: ToolContentModelType, options?: INewTileOptions): INewRowTile {
      const title = self.getNewTileTitle(content);
      return self.addTileInNewRow(ToolTileModel.create({ title, content }), options);
    },
    addTileSnapshotInNewRow(snapshot: ToolTileSnapshotInType, options?: INewTileOptions): INewRowTile {
      return self.addTileInNewRow(ToolTileModel.create(snapshot), options);
    },
    addTileSnapshotInExistingRow(snapshot: ToolTileSnapshotInType, options: INewTileOptions): INewRowTile | undefined {
      const tile = ToolTileModel.create(snapshot);
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRow;
      }
      const row = self.getRowByIndex(o.rowIndex);
      if (row) {
        const indexInRow = o.locationInRow === "left" ? 0 : undefined;
        self.insertNewTileInRow(tile, row, indexInRow);
        self.removePlaceholderTilesFromRow(o.rowIndex);
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
      const content = PlaceholderContentModel.create({ sectionId });
      return self.addTileContentInNewRow(content, { rowIndex: self.rowCount });
    },
    copyTilesIntoExistingRow(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        tiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const parsedContent = safeJsonParse(tile.tileContent);
          if (parsedContent?.content) {
            const rowOptions: INewTileOptions = {
              rowIndex: rowInfo.rowDropIndex,
              locationInRow: rowInfo.rowDropLocation
            };
            if (tile.rowHeight) {
              rowOptions.rowHeight = tile.rowHeight;
            }
            result = self.addTileSnapshotInExistingRow(parsedContent, rowOptions);
          }
          results.push(result);
        });
      }
      return results;
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
              result = self.addTileContentInNewRow(content, rowOptions);
              if (lastRowIndex !== -1) {
                rowDelta++;
              }
              lastRowIndex = tile.rowIndex;
            }
            else {
              result = self.addTileSnapshotInExistingRow({ content }, rowOptions);
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
      moveTile(tileId: string, rowInfo: IDropRowInfo, tileIndex = 0) {
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
      addTile(toolId: string, options?: IDocumentContentAddTileOptions) {
        const { title, addSidecarNotes, url, insertRowInfo } = options || {};
        // for historical reasons, this function initially places new rows at
        // the end of the content and then moves them to the desired location.
        const addTileOptions = { rowIndex: self.rowCount };
        const contentInfo = getToolContentInfoById(toolId);
        if (!contentInfo) return;

        const documentEnv = getEnv(self)?.documentEnv as IDocumentEnvironment | undefined;
        const appConfig = documentEnv?.appConfig;

        const newContent = contentInfo?.defaultContent({ title, url, appConfig });
        const tileInfo = self.addTileContentInNewRow(
                              newContent,
                              { rowHeight: contentInfo.defaultHeight, ...addTileOptions });
        if (addSidecarNotes) {
          const { rowId } = tileInfo;
          const row = self.rowMap.get(rowId);
          const textContentInfo = getToolContentInfoById(kTextToolID);
          if (row && textContentInfo) {
            const tile = ToolTileModel.create({ content: textContentInfo.defaultContent() });
            self.insertNewTileInRow(tile, row, 1);
            tileInfo.additionalTileIds = [ tile.id ];
          }
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
    userAddTile(toolId: string, options?: IDocumentContentAddTileOptions) {
      const result = self.addTile(toolId, options);
      const newTile = result?.tileId && self.getTile(result.tileId);
      if (newTile) {
        Logger.logTileEvent(LogEventName.CREATE_TILE, newTile);
      }
      return result;
    },
    userDeleteTile(tileId: string) {
      if (self.getTile(tileId)) {
        Logger.logTileEvent(LogEventName.DELETE_TILE, self.getTile(tileId));
        self.deleteTile(tileId);
      }
    },
    userMoveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      tiles.forEach(tile => Logger.logTileEvent(LogEventName.MOVE_TILE, self.getTile(tile.tileId)));
      self.moveTiles(tiles, rowInfo);
    },
    userCopyTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      const dropRow = (rowInfo.rowDropIndex != null) ? self.getRowByIndex(rowInfo.rowDropIndex) : undefined;
      const results = dropRow?.acceptTileDrop(rowInfo)
                      ? self.copyTilesIntoExistingRow(tiles, rowInfo)
                      : self.copyTilesIntoNewRows(tiles, rowInfo.rowInsertIndex);
      results.forEach((result, i) => {
        const newTile = result?.tileId && self.getTile(result.tileId);
        if (result && newTile) {
          const originalTileId = tiles[i].tileId;
          Logger.logTileEvent(LogEventName.COPY_TILE, newTile, { originalTileId });
        }
      });
      return results;
    }
  }))
  .actions(self => ({
    addSharedModel(sharedModel: SharedModelType) {
      // we make sure there isn't an entry already otherwise adding a shared
      // model twice would clobber the existing entry.
      let sharedModelEntry = self.sharedModelMap.get(sharedModel.id);

      if (!sharedModelEntry) {
        sharedModelEntry = SharedModelEntry.create({sharedModel});
        self.sharedModelMap.set(sharedModel.id, sharedModelEntry);
      }

      return sharedModelEntry;
    },

  }));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType,
                                          asTemplate?: boolean): DocumentContentModelType | undefined {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds(asTemplate));
}
