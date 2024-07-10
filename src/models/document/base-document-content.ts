import { each } from "lodash";
import { types, getType, getEnv, SnapshotIn } from "mobx-state-tree";
import { kPlaceholderTileDefaultHeight } from "../tiles/placeholder/placeholder-constants";
import {
  getPlaceholderSectionId, isPlaceholderTile, PlaceholderContentModel
} from "../tiles/placeholder/placeholder-content";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { ITileContentModel, ITileEnvironment, TileContentModel } from "../tiles/tile-content";
import { ILinkableTiles, ITypedTileLinkMetadata } from "../tiles/tile-link-types";
import {
  IDragTileItem, TileModel, ITileModel, ITileModelSnapshotIn, ITilePosition, IDropTileItem
} from "../tiles/tile-model";
import {
  IDropRowInfo, TileRowModel, TileRowModelType, TileRowSnapshotType, TileLayoutModelType
} from "../document/tile-row";
import { migrateSnapshot } from "./document-content-import";
import { isImportDocument } from "./document-content-import-types";
import { logTileCopyEvent } from "../tiles/log/log-tile-copy-event";
import { logTileDocumentEvent } from "../tiles/log/log-tile-document-event";
import { getAppConfig } from "../tiles/tile-environment";
import { LogEventName } from "../../lib/logger-types";
import { safeJsonParse, uniqueId } from "../../utilities/js-utils";
import { defaultTitle, extractTitleBase, titleMatchesDefault } from "../../utilities/title-utils";
import { SharedModel, SharedModelType } from "../shared/shared-model";
import { getSharedModelInfoByType } from "../shared/shared-model-registry";
import { kSectionHeaderHeight } from "./document-constants";
import { IDocumentContentAddTileOptions, INewRowTile, INewTileOptions,
   ITileCountsPerSection, NewRowTileArray } from "./document-content-types";
import {
  SharedModelEntry, SharedModelEntrySnapshotType, SharedModelEntryType, SharedModelMap
} from "./shared-model-entry";

/**
 * This is one part of the DocumentContentModel, which is split into four parts of more manageable size:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithAnnotations
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModel
 *
 * This file contains the most fundamental views and actions.
 */
export const BaseDocumentContentModel = types
  .model("BaseDocumentContent", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
    tileMap: types.map(TileModel),
    // The keys to this map should be the id of the shared model
    sharedModelMap: SharedModelMap
  })
  .preProcessSnapshot(snapshot => {
    return isImportDocument(snapshot) ? migrateSnapshot(snapshot) : snapshot;
  })
  .volatile(self => ({
    visibleRows: [] as string[],
    highlightPendingDropLocation: -1,
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
      get tileEnv() {
        return getEnv(self) as ITileEnvironment | undefined;
      },
      get isEmpty() {
        return self.tileMap.size === 0;
      },
      get contentId() {
        return contentId;
      },
      get firstTile(): ITileModel | undefined {
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
      getTileContent(tileId: string): ITileContentModel | undefined {
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
                  const tile = tileId ? self.tileMap.get(tileId) : undefined;
                  return isPlaceholderTile(tile);
                });
      },
      getSectionIdForTile(tileId: string) {
        let sectionId = "";
        const foundRow = self.rowOrder.find((rowId, i) => {
          const row = self.rowMap.get(rowId);
          // TODO: Figure out why linting is failing
          // row?.sectionId && (sectionId = row?.sectionId);
          if (row?.sectionId) {
            sectionId = row.sectionId;
          }
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
      // TODO: Split this into two functions:
      // - getFirstDocumentSharedModelByType
      // - getFirstTileSharedModelByType
      // The logic with the tileId is confusing when they are combined
      getFirstSharedModelByType<IT extends typeof SharedModel>(
        modelType: IT, tileId?: string): IT["Type"] | undefined {
        const sharedModelEntries = Array.from(self.sharedModelMap.values());
        // Even if we use a snapshotProcessor generated type, getType will return the original
        // type. This is documented: src/models/mst.test.ts
        try {
          const firstEntry = sharedModelEntries.find(entry =>
            (getType(entry.sharedModel) === modelType) &&
            (!tileId || !!entry.tiles.find(tile => tileId === tile.id)));
          return firstEntry?.sharedModel;
        } catch (e) {
          console.warn("Problem finding shared models:", e);
          return undefined;
        }
      },
      getSharedModelsByType<IT extends typeof SharedModel>(type: string): IT["Type"][] {
        const sharedModelEntries = Array.from(self.sharedModelMap.values());
        return sharedModelEntries.map(entry => entry.sharedModel).filter(model => model.type === type);
      },
      getSharedModelsInUseByAnyTiles(): SharedModelType[] {
        const sharedModelEntries = Array.from(self.sharedModelMap.values());
        return sharedModelEntries
          .filter(entry => { return entry.tiles.length > 0; })
          .map(entry => entry.sharedModel);
      },
      getSharedModelsUsedByTiles(tileIds: string[]) {
        const sharedModels: Record<string, SharedModelEntryType> = {};
        Array.from(self.sharedModelMap.values()).forEach(sharedModel => {
          sharedModel.tiles.forEach(tile => {
            if (tileIds.includes(tile.id)) {
              sharedModels[sharedModel.sharedModel.id] = sharedModel;
            }
          });
        });
        return sharedModels;
      }
    };
  })
  .views(self => ({
    getRowHeight(rowId: string) {
      const row = self.getRow(rowId);
      if (!row) return 0;
      if (row.isSectionHeader) return kSectionHeaderHeight;
      if (self.isPlaceholderRow(row)) return kPlaceholderTileDefaultHeight;
      // NOTE: This may not be accurate for rows with tiles that rely on the getContentHeight tileAPI function.
      return row.height;
    },
    getSectionTypeForPlaceholderRow(row: TileRowModelType) {
      if (!self.isPlaceholderRow(row)) return;
      const tile = self.getTile(row.tiles[0].tileId);
      return getPlaceholderSectionId(tile);
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
    getRowAfterTiles(tiles: ITilePosition[]) {
      return Math.max(...tiles.map(tile => tile.rowIndex)) + 1;
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
      const tiles: ITileModel[] = [];
      const rows = self.getRowsInSection(sectionId);
      rows.forEach(row => {
        row.tiles
          .map(tileLayout => self.tileMap.get(tileLayout.tileId))
          .forEach(tile => tile && !isPlaceholderTile(tile) && tiles.push(tile));
      });
      return tiles;
    },
    getTilesOfType(type: string) {
      const tiles: string[] = [];
      const lcType = type.toLowerCase();
      self.rowOrder.forEach(rowId => {
        const row = self.getRow(rowId);
        each(row?.tiles, tileEntry => {
          if (self.getTileType(tileEntry.tileId)?.toLowerCase() === lcType) {
            tiles.push(tileEntry.tileId);
          }
        });
      });
      return tiles;
    },
    getAllTilesByType() {
      const tilesByType: Record<string, string[]> = {};
      self.tileMap.forEach(tile => {
        const tileType = tile.content.type;
        if (!tilesByType[tileType]) {
          tilesByType[tileType] = [];
        }
        tilesByType[tileType].push(tile.id);
      });
      return tilesByType;
    },
    getLinkableTiles(): ILinkableTiles {
      const providers: ITypedTileLinkMetadata[] = [];
      const consumers: ITypedTileLinkMetadata[] = [];
      self.rowOrder.forEach(rowId => {
        const row = self.getRow(rowId);
        each(row?.tiles, tileEntry => {
          const tileType = self.getTileType(tileEntry.tileId);
          const titleBase = getTileContentInfo(tileType)?.titleBase || tileType;
          if (tileType) {
            const tile = self.getTile(tileEntry.tileId);
            const typedTileLinkMetadata: ITypedTileLinkMetadata = {
              id: tileEntry.tileId, type: tileType, title: tile?.computedTitle, titleBase
            };
            if (getTileContentInfo(tileType)?.isDataProvider) {
              providers.push(typedTileLinkMetadata);
            }
            if (getTileContentInfo(tileType)?.isDataConsumer) {
              consumers.push(typedTileLinkMetadata);
            }
          }
        });
      });
      return { providers, consumers };
    },
    exportTileAsJson(tileInfo: TileLayoutModelType, options?: IDocumentExportOptions) {
      const { includeTileIds, ...otherOptions } = options || {};
      const tileOptions = { includeId: includeTileIds, ...otherOptions};
      const tile = self.getTile(tileInfo.tileId);
      const json = tile?.exportJson(tileOptions);
      if (json) {
        return json;
      }
    }
  }))
  .views(self => ({
    get height() {
      return self.rowOrder.reduce((totalHeight: number, rowId: string) => {
        return totalHeight + (self.getRowHeight(rowId) ?? 0);
      }, 0) ?? 0;
    },
    rowHeightToExport(row: TileRowModelType, tileId: string) {
      if (!row?.height) return;
      // we only export heights for specific tiles configured to do so
      const tileType = self.getTileType(tileId);
      const tileContentInfo = getTileContentInfo(tileType);
      if (!tileContentInfo?.exportNonDefaultHeight) return;
      // we only export heights when they differ from the default height for the tile
      const defaultHeight = tileContentInfo.defaultHeight;
      return defaultHeight && (row.height !== defaultHeight) ? row.height : undefined;
    },
    /**
     * Find the largest title suffix number matching the given title base
     * in the list of tiles provided.
     * If tiles are found that match the given base, the largest suffix number
     * will be returned. This may be zero if there's a match without a suffix number.
     * If no matching tile titles are found, returns -1.
     * @param titleBase
     * @param tiles list of tile IDs
     * @returns max number found; 0 if no numbers; -1 if no tiles match.
     */
    getMaxNumberFromTileTiles(titleBase: string, tiles: string[]) {
      return tiles.reduce((maxIndex, tileId) => {
        const tile = self.getTile(tileId);
        const title = tile?.computedTitle;
        const match = titleMatchesDefault(title, titleBase);
        return match
                ? Math.max(maxIndex, +match[1])
                : maxIndex;
      }, -1);
    },
    /**
     * Find the largest name suffix number matching the given name base
     * from the list of SharedModels provided.
     * If names are found that match the given base, the largest suffix number
     * will be returned. This may be zero if there's a match without a suffix number.
     * If no matching tile titles are found, returns -1.
     * @param nameBase
     * @param sharedModels
     * @returns max number found; 0 if no numbers; -1 if no tiles match.
     */
    getMaxNumberFromSharedModelNames(nameBase: string, sharedModels: SharedModelType[]) {
      return sharedModels.reduce((maxIndex, sharedModel) => {
        const match = titleMatchesDefault(sharedModel.name, nameBase);
        return match
                ? Math.max(maxIndex, +match[1])
                : maxIndex;
      }, -1);
    }
  }))
  .views(self => ({
    /**
     * Make the given title unique in this document by incrementing or appending
     * a numeric suffix. Will return the title unchanged if it's unique. If
     * another tile is already using this title, this will add a numeric suffix,
     * or increment an existing numeric suffix, in order to make it unique.
     * @param title
     * @returns possibly modified title
     */
    getUniqueTitle(title: string) {
      const titleBase = extractTitleBase(title);
      const maxSoFar = self.getMaxNumberFromTileTiles(titleBase, self.getTilesInDocumentOrder());
      return (maxSoFar >= 0) ? defaultTitle(titleBase, maxSoFar+1) : title;
    },
    /**
     * Make the given SharedModel name unique in this document by incrementing or
     * appending a numeric suffix. Will return the name unchanged if it is already
     * unique. If another shared model (which is actually in use by a tile) is
     * already using this name, this Will add a numeric suffix, or increment an
     * existing numeric suffix, in order to make it unique.
     * @param title
     * @returns possibly modified name
     */
    getUniqueSharedModelName(name: string) {
      const existingSharedModels = self.getSharedModelsInUseByAnyTiles();
      if (existingSharedModels.find((sm) => sm.name === name)) {
        const titleBase = extractTitleBase(name);
        const maxSoFar = self.getMaxNumberFromSharedModelNames(titleBase, existingSharedModels);
        return (maxSoFar >= 0) ? defaultTitle(titleBase, maxSoFar+1) : name;
      } else {
        // No conflict
        return name;
      }
    },
    /**
     * Create a unique title in the standard form for the given type.
     * The title will have a base defined by the type, and a numeric suffix, starting with "1".
     * @param tileType
     * @returns a unique title.
     */
    getUniqueTitleForType(tileType: string) {
      const titleBase = getTileContentInfo(tileType)?.titleBase || tileType;
      const tileIds = self.getTilesOfType(tileType);
      const maxSoFar = self.getMaxNumberFromTileTiles(titleBase, tileIds);
      return defaultTitle(titleBase, maxSoFar >=0 ? maxSoFar + 1 : 1);
    },
    getTileCountsPerSection(sectionIds: string[]): ITileCountsPerSection {
      const counts: ITileCountsPerSection = {};
      sectionIds.forEach(sectionId => {
        counts[sectionId] = self.getTilesInSection(sectionId).length;
      });
      return counts;
    },
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
    insertNewTileInRow(tile: ITileModel, row: TileRowModelType, tileIndexInRow?: number) {
      const insertedTile = self.tileMap.put(tile);
      row.insertTileInRow(insertedTile, tileIndexInRow);
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
    addNewTileInNewRowAtIndex(tile: ITileModel, rowIndex: number) {
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
        const tile = TileModel.create({ content });
        self.addNewTileInNewRowAtIndex(tile, rowIndex);
      }
    },
    removePlaceholderTilesFromRow(rowIndex: number) {
      const isPlaceholderTileId = (tileId: string) => {
        return self.getTileType(tileId) === "Placeholder";
      };
      const row = self.getRowByIndex(rowIndex);
      row?.removeTilesFromRow(isPlaceholderTileId);
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

      // Find and fix any tiles that have a title incorrectly set on the tile, rather than on the content.
      // We iterate through the tiles in reverse order, so that if there is more than one tile
      // linked to the same shared title, the first tile's name is the one that ends up being used.
      // We have to do this without the sharedModelManagers's help because it won't be available
      // immediately after creation.
      const tiles = self.getTilesInDocumentOrder().reverse();
      for (const id of tiles) {
        const tile = self.tileMap.get(id);
        if (tile && tile.title && getTileContentInfo(tile.content.type)?.useContentTitle) {
          // Look for a SharedModel that can hold the title
          for (const sm of Object.values(self.getSharedModelsUsedByTiles([id]))) {
            if (getSharedModelInfoByType(sm.sharedModel.type)?.hasName) {
              sm.sharedModel.setName(tile.title);
              tile.setTitle(undefined);
              break;
            }
          }
        }
      }
    }
  }))
  .actions(self => ({
    addTileContentInNewRow(content: SnapshotIn<typeof TileContentModel>,
        options?: INewTileOptions): INewRowTile {
      // We can assume content.type is always defined. If content is an instance
      // then it has to be defined. If it is a snapshot, the type is required since
      // this is a generic function. For completeness a warning is printed.
      if (!content.type) {
        console.warn("addTileContentInNewRow requires the content to have a type");
      }
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRow;
      }
      const row = TileRowModel.create({});
      self.insertRow(row, o.rowIndex);

      const id = o.tileId;
      const tileModel = self.tileMap.put({id, content, title: o.title});
      row.insertTileInRow(tileModel);

      self.removeNeighboringPlaceholderRows(o.rowIndex);
      if (o.rowHeight) {
        row.setRowHeight(o.rowHeight);
      }
      return { rowId: row.id, tileId: tileModel.id };
    },
    addTileSnapshotInExistingRow(snapshot: ITileModelSnapshotIn, options: INewTileOptions): INewRowTile | undefined {
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRow;
      }
      const row = o.rowId ? self.getRow(o.rowId) : self.getRowByIndex(o.rowIndex);
      if (row) {
        const indexInRow = o.locationInRow === "left" ? 0 : undefined;
        const tileModel = self.tileMap.put(snapshot);
        row.insertTileInRow(tileModel, indexInRow);
        self.removePlaceholderTilesFromRow(o.rowIndex);
        self.removeNeighboringPlaceholderRows(o.rowIndex);
        if (o.rowHeight) {
          row.setRowHeight(Math.max((row.height || 0), o.rowHeight));
        }
        return { rowId: row.id, tileId: tileModel.id };
      }
    },
    deleteRowAddingPlaceholderRowIfAppropriate(rowId: string) {
      const rowIndex = self.getRowIndex(rowId);
      self.deleteRow(rowId);
      self.addPlaceholderRowIfAppropriate(rowIndex);
    },
    showPendingInsertHighlight(show: boolean, insertRowIndex?: number) {
      self.highlightPendingDropLocation = show ? insertRowIndex ?? self.defaultInsertRow : -1;
    }
  }))
  .actions((self) => ({
    addPlaceholderTile(sectionId?: string) {
      const content = PlaceholderContentModel.create({ sectionId });
      return self.addTileContentInNewRow(content, { rowIndex: self.rowCount });
    },
    copyTilesIntoExistingRow(tiles: IDropTileItem[], rowInfo: IDropRowInfo) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        tiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const parsedContent = safeJsonParse<ITileModelSnapshotIn>(tile.tileContent);
          const title = parsedContent?.title;
          const uniqueTitle = title && self.getUniqueTitle(title);
          if (parsedContent?.content) {
            const rowOptions: INewTileOptions = {
              rowIndex: rowInfo.rowDropIndex,
              locationInRow: rowInfo.rowDropLocation
            };
            if (tile.rowHeight) {
              rowOptions.rowHeight = tile.rowHeight;
            }
            const adjustedSnapshot = {
              ...parsedContent,
              id: tile.newTileId,
              title: uniqueTitle
            };
            result = self.addTileSnapshotInExistingRow(adjustedSnapshot, rowOptions);
          }
          results.push(result);
        });
      }
      return results;
    },
    copyTilesIntoNewRows(tiles: IDropTileItem[], rowIndex: number) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        let rowDelta = -1;
        let lastRowIndex = -1;
        let lastRowId = "";
        tiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const parsedContent = safeJsonParse<ITileModelSnapshotIn>(tile.tileContent);
          const title = parsedContent?.title;
          const uniqueTitle = title && self.getUniqueTitle(title);
          const content = parsedContent?.content;
          if (content) {
            if (tile.rowIndex !== lastRowIndex) {
              rowDelta++;
            }
            const tileOptions: INewTileOptions = {
              rowId: lastRowId,
              rowIndex: rowIndex + rowDelta,
              tileId: tile.newTileId,
              title: uniqueTitle
            };
            if (tile.rowHeight) {
              tileOptions.rowHeight = tile.rowHeight;
            }
            if (tile.rowIndex !== lastRowIndex) {
              result = self.addTileContentInNewRow(content, tileOptions);
              lastRowIndex = tile.rowIndex;
              lastRowId = result.rowId;
            }
            else {
              // This code path happens when there are two or more tiles which
              // were in the same row in the source document. `tile.rowIndex` is
              // the rowIndex of the tile in the source document. `lastRowIndex`
              // is the source row index of the last tile.
              const tileSnapshot: ITileModelSnapshotIn = { id: tile.newTileId, title: parsedContent.title, content };
              result = self.addTileSnapshotInExistingRow(tileSnapshot, tileOptions);
            }
          }
          results.push(result);
        });
      }
      return results;
    },
    logCopyTileResults(tiles: IDragTileItem[], results: NewRowTileArray) {
      results.forEach((result, i) => {
        const newTile = result?.tileId && self.getTile(result.tileId);
        if (result && newTile) {
          const originalTileId = tiles[i].tileId;
          logTileCopyEvent(LogEventName.COPY_TILE, { tile: newTile, originalTileId });
        }
      });
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
      /**
       * Create and insert a new tile of the given type, with default content.
       * @param toolId the type of tile to create.
       * @param options an options object, which can include:
       * @param options.title title for the new tile
       * @param options.url passed to the default content creation method
       * @param options.insertRowInfo specifies where the tile should be placed
       * @returns an object containing information about the results: rowId, tileId, additionalTileIds
       */
      addTile(toolId: string, options?: IDocumentContentAddTileOptions) {
        const { title, url, insertRowInfo } = options || {};
        // for historical reasons, this function initially places new rows at
        // the end of the content and then moves them to the desired location.
        const contentInfo = getTileContentInfo(toolId);
        if (!contentInfo) return;

        const appConfig = getAppConfig(self);

        // TODO: The table tile is the only tile that uses the title property
        // here the title gets set as the name of the dataSet that is created by
        // the table's defaultContent. We should find a way for the table tile
        // to work without needing this title.
        const newContent = contentInfo?.defaultContent({ title, url, appConfig });
        const addTileOptions = { rowHeight: contentInfo.defaultHeight, rowIndex: self.rowCount, title: options?.title };
        const tileInfo = self.addTileContentInNewRow(
                              newContent,
                              addTileOptions);
        // TODO: For historical reasons, this function initially places new rows at the end of the content
        // and then moves them to their desired locations from there using the insertRowInfo to specify the
        // desired destination. The underlying addTileInNewRow() function has a separate mechanism for specifying
        // the location of newly created rows. It would be better to eliminate the redundant insertRowInfo
        // specification used by this function and instead just use the one from addTileInNewRow().
        if (tileInfo && insertRowInfo) {
          // Move newly-create tile(s) into requested row.
          const { rowDropLocation } = insertRowInfo;

          // TODO simplify this
          const tileIdsToMove = [tileInfo.tileId];

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
      },
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
    addSharedModelFromImport(id: string, sharedModelEntry: SharedModelEntrySnapshotType){
      if (self.sharedModelMap){
        self.sharedModelMap.set(id, sharedModelEntry);
      }
    }
  }))
  .actions(self => ({
    userAddTile(toolId: string, options?: IDocumentContentAddTileOptions) {
      const result = self.addTile(toolId, options);
      const newTile = result?.tileId && self.getTile(result.tileId);
      if (newTile) {
        logTileDocumentEvent(LogEventName.CREATE_TILE, { tile: newTile });
      }
      return result;
    },
    userDeleteTile(tileId: string) {
      const tile = self.getTile(tileId);
      if (tile) {
        logTileDocumentEvent(LogEventName.DELETE_TILE, { tile });
        self.deleteTile(tileId);
      }
    },
    userMoveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      tiles.forEach(tileItem => {
        const tile = self.getTile(tileItem.tileId);
        tile && logTileDocumentEvent(LogEventName.MOVE_TILE, { tile });
      });
      self.moveTiles(tiles, rowInfo);
    },
    userCopyTiles(tiles: IDropTileItem[], rowInfo: IDropRowInfo) {
      const dropRow = (rowInfo.rowDropIndex != null) ? self.getRowByIndex(rowInfo.rowDropIndex) : undefined;
      const results = dropRow?.acceptTileDrop(rowInfo)
                      ? self.copyTilesIntoExistingRow(tiles, rowInfo)
                      : self.copyTilesIntoNewRows(tiles, rowInfo.rowInsertIndex);
      self.logCopyTileResults(tiles, results);
      return results;
    }
  }));
