import { types, getType, getEnv, SnapshotIn, Instance, isAlive } from "mobx-state-tree";
import { kPlaceholderTileDefaultHeight } from "../tiles/placeholder/placeholder-constants";
import {
  getPlaceholderSectionId, isPlaceholderTile, PlaceholderContentModel
} from "../tiles/placeholder/placeholder-content";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { ITileContentModel, ITileEnvironment, TileContentModel } from "../tiles/tile-content";
import { ILinkableTiles, ITypedTileLinkMetadata } from "../tiles/tile-link-types";
import {
  IDragTileItem, TileModel, ITileModel, ITileModelSnapshotIn, ITilePosition, IDropTileItem,
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
import { RowList, isRowListContainer, RowListType } from "./row-list";
import { getParentWithTypeName } from "../../utilities/mst-utils";

/**
 * This is one part of the DocumentContentModel, which is split into four parts of more manageable size:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithAnnotations
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModel
 *
 * This file contains the most fundamental views and actions.
 */
export const BaseDocumentContentModel = RowList.named("BaseDocumentContent")
  .props({
    tileMap: types.map(TileModel),
    // The keys to this map should be the id of the shared model
    sharedModelMap: SharedModelMap
  })
  .preProcessSnapshot(snapshot => {
    return isImportDocument(snapshot) ? migrateSnapshot(snapshot) : snapshot;
  })
  .volatile(self => ({
    // ID of the row to highlight as the drop location for newly-created or duplicated tiles.
    highlightPendingDropLocation: undefined as string | undefined,
    // IDs of top-level rows that are currently visible on the screen
    visibleRows: [] as string[],
    awaitingAIAnalysis: false,
  }))
  .views(self => {
    // used for drag/drop self-drop detection, for instance
    const contentId = uniqueId();

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
      /**
       * Returns all tiles in the document, including nested tiles from RowList containers.
       * In the case of nested tiles, the container tile is listed first, then
       * the tiles that are nested inside it.
       * @returns An array of all tiles, in document order.
       */
      get allTiles(): ITileModel[] {
        return self.rowOrder.flatMap(rowId => this.getAllTilesInRow(rowId));
      },
      /**
       * Returns all tiles in the given row, including nested tiles from RowList containers.
       * @returns An array of all tiles, in document order.
       */
      getAllTilesInRow(rowId: string) {
        const tiles: ITileModel[] = [];
        const row = this.getRowRecursive(rowId);
          if (row) {
            row.tiles.forEach(tileLayout => {
              const tile = self.tileMap.get(tileLayout.tileId);
              if (tile) {
                tiles.push(tile);

                // If this tile's content is a RowList container, get its nested tiles
                const tileContent = tile.content;
                if (isRowListContainer(tileContent)) {
                  tileContent.rowOrder.forEach((nestedRowId: string) => {
                    const nestedRow = tileContent.getRow(nestedRowId);
                    if (nestedRow) {
                      nestedRow.tiles.forEach((nestedTileLayout: TileLayoutModelType) => {
                        const nestedTile = self.tileMap.get(nestedTileLayout.tileId);
                        if (nestedTile) {
                          tiles.push(nestedTile);
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        return tiles;
      },
      /**
       * Returns list of tile ids in the document from top to bottom, left to right.
       * In the case of nested tiles, the container tile is listed first, then
       * the tiles that are nested inside it.
       * @returns An array of tile ids, in document order.
       */
      getTilesInDocumentOrder(): string[] {
        return this.allTiles.map(tile => tile.id);
      },

      /**
       * Returns all rows in the document, including nested rows from RowList containers.
       * In the case of nested rows, the row that includes the container tile is listed first, then
       * the rows that are nested inside it.
       * @returns An array of all rows, in document order.
       */
      get allRows(): TileRowModelType[] {
        const rows: TileRowModelType[] = [];

        // Get all rows from the main document
        self.rowOrder.forEach(rowId => {
          const row = self.rowMap.get(rowId);
          if (row) {
            rows.push(row);

            // Check each tile in the row for nested RowList containers
            row.tiles.forEach(tileLayout => {
              const tileContent = self.tileMap.get(tileLayout.tileId)?.content;
              if (tileContent && isRowListContainer(tileContent)) {
                // Add all rows from the nested RowList
                tileContent.rowOrder.forEach(nestedRowId => {
                  const nestedRow = tileContent.getRow(nestedRowId);
                  if (nestedRow) {
                    rows.push(nestedRow);
                  }
                });
              }
            });
          }
        });

        return rows;
      },
      getRowRecursive(rowId: string): TileRowModelType | undefined {
        return this.allRows.find(row => row.id === rowId);
      },
      get allRowLists(): RowListType[] {
        const rowLists: RowListType[] = [];
        this.allTiles.forEach(tile => {
          const tileContent = tile.content;
          if (isRowListContainer(tileContent)) {
            rowLists.push(tileContent);
          }
        });
        return rowLists;
      },
      /**
       * Returns the (smallest)RowList that contains the given row.
       * A RowList can be a tile that is also a container (eg, Question tile), or the DocumentContentModel itself
       * if the row is not in any smaller container.
       * @param rowId The ID of the row to find.
       * @returns The RowList that directly contains the given row.
       */
      getRowListForRow(rowId: string) {
        const found = this.allRowLists.find(rowList => rowList.rowOrder.includes(rowId));
        return found ?? self;
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
      getRowForTile(tileId: string) {
        return this.allRows.find(r => r.hasTile(tileId));
      },
      getRowIdForTile(tileId: string) {
        return this.getRowForTile(tileId)?.id;
      },
      getSectionIdForTile(tileId: string) {
        let sectionId = "";
        const foundRow = this.allRows.find((row) => {
          if (row.sectionId) {
            sectionId = row.sectionId;
          }
          return row.hasTile(tileId);
        });
        return foundRow ? sectionId : undefined;
      },
      // TODO does this need to be recursive? - affects copy behavior.
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
          .filter(entry => entry.tiles.length > 0)
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
      },
      getAllTileIds(includeTeacherContent: boolean) {
        // returns all non-placeholder tile ids in document order filtered by includeTeacherContent
        return this.allTiles.filter((tile: ITileModel) => {
          const { display } = tile;
          return !isPlaceholderTile(tile) && (display !== "teacher" || includeTeacherContent);
        }).map(tile => tile.id);
      }
    };
  })
  .views(self => ({
    getRowHeight(rowId: string) {
      const row = self.getRowRecursive(rowId);
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
    /** Return the index of the row after which new content is inserted by default. */
    get defaultInsertRowIndex() {
      // by default new tiles are inserted after the last visible row with content
      for (let i = self.getIndexOfLastVisibleRow(self.visibleRows); i >= 0; --i) {
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
      return self.getIndexOfLastVisibleRow(self.visibleRows) + 1;
    },
    /** Return the ID of the row after which new content is inserted by default. */
    get defaultInsertRowId() {
      const insertIndex = this.defaultInsertRowIndex;
      if (insertIndex <= 0) return;
      return self.rowOrder[insertIndex-1];
    },
    /**
     * Find the smallest RowList container that contains all the given tile ids.
     * Returns the whole document if no smaller container is found.
     * @param tileIds The IDs of the tiles to find.
     * @returns This DocumentContentModel, or a smaller RowList that contains all the given tile ids.
     */
    getRowListContainingTileIds(tileIds: string[]): RowListType | undefined {
      const found = self.allRowLists.find(rowList => {
        return tileIds.every(id => rowList.tileIds.includes(id));
      });
      return found ?? self;
    },
    getTileContainingTileId(tileId: string): ITileModel | undefined {
      const row = self.getRowForTile(tileId);
      if (row) {
        return getParentWithTypeName(row, "TileModel");
      }
      return undefined;
    },
    rowHasTileId(rowId: string, tileId: string) {
      return self.getAllTilesInRow(rowId).some(tile => tile.id === tileId);
    },
    /**
     * Given a sorted list of tile positions, return the last row of them.
     * This will be a row in the smallest rowList that contains all the tiles.
     * @param tiles
     * @returns a rowId, or undefined if there are no tiles in the list.
     */
    getLastRowForTiles(tiles: ITilePosition[]): string | undefined {
      const rowList = this.getRowListContainingTileIds(tiles.map(tile => tile.tileId));
      const lastTileId = tiles[tiles.length - 1].tileId;
      return rowList?.rowOrder.find(rowId => this.rowHasTileId(rowId, lastTileId));
    },
    // TODO: does this need to be recursive? Affects dashboard ProgressWidget.
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
    get tileTypes() {
      return new Set(Array.from(self.tileMap.values()).map(tile => tile.content.type));
    },
    getTilesOfType(type: string) {
      const lcType = type.toLowerCase();
      return self.allTiles
        .filter(tile => tile.content.type.toLowerCase() === lcType)
        .map(tile => tile.id);
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
      self.allTiles.forEach(tile => {
          const tileType = tile.content.type;
          const titleBase = getTileContentInfo(tileType)?.titleBase || tileType;
          if (tileType) {
            const typedTileLinkMetadata: ITypedTileLinkMetadata = {
              id: tile.id, type: tileType, title: tile?.computedTitle, titleBase
            };
            if (getTileContentInfo(tileType)?.isDataProvider) {
              providers.push(typedTileLinkMetadata);
            }
            if (getTileContentInfo(tileType)?.isDataConsumer) {
              consumers.push(typedTileLinkMetadata);
            }
          }
      });
      return { providers, consumers };
    }
  }))
  .views(self => ({
    get height() {
      return self.rowOrder.reduce((totalHeight: number, rowId: string) => {
        return totalHeight + (self.getRowHeight(rowId) ?? 0);
      }, 0) ?? 0;
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
    getUniqueTitle(title: string | undefined) {
      if (!title) return title;
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
    getUniqueSharedModelName(name: string | undefined) {
      if (!name) return name;
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
      const contentInfo = getTileContentInfo(tileType);
      const titleBase = contentInfo?.titleBase || contentInfo?.displayName || contentInfo?.shortName || tileType;
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
    findRowContainingTile(tileId: string) {
      return self.allRows.find(row => row.hasTile(tileId));
    },
    findRowIdContainingTile(tileId: string) {
      const row = this.findRowContainingTile(tileId);
      return row?.id;
    },
    numTilesInRow(rowId: string) {
      const row = self.getRowRecursive(rowId);
      return row ? row.tiles.length : 0;
    },
  }))
  .actions(self => ({
    setVisibleRows(rows: string[]) {
      self.visibleRows = rows;
    },
    /**
     * Add a tile to the tileMap. If idOverride or titleOverride are provided,
     * they will override the current value of the tile's id and title.
     * @param tile
     * @param idOverride
     * @param titleOverride
     */
    addToTileMap(tile: ITileModelSnapshotIn, idOverride?: string, titleOverride?: string) {
      const id = idOverride ?? tile.id;
      const title = titleOverride ?? tile.title;
      return self.tileMap.put({...tile, id, title});
    },
    deleteTilesFromRow(row: TileRowModelType) {
      row.tiles
        .map(layout => layout.tileId)
        .forEach(tileId => {
          row.removeTileFromRow(tileId);
          self.tileMap.delete(tileId);
        });
    }
  }))
  .actions(self => ({
    setAwaitingAIAnalysis(awaitingAIAnalysis: boolean) {
      self.awaitingAIAnalysis = awaitingAIAnalysis;
    },
    removeNeighboringPlaceholderRows(rowId: string) {
      const rowList = self.getRowListForRow(rowId);
      if (!rowList) {
        console.warn("Row is missing", rowId);
        return;
      }
      const rowIndex = rowList.getRowIndex(rowId);
      const beforeRow = rowIndex > 0 ? rowList.getRowByIndex(rowIndex - 1) : undefined;
      const afterRow = rowIndex < rowList.rowCount - 1 ? rowList.getRowByIndex(rowIndex + 1) : undefined;
      if (afterRow && self.isPlaceholderRow(afterRow)) {
        rowList.deleteRow(afterRow.id);
      }
      if (beforeRow && self.isPlaceholderRow(beforeRow)) {
        rowList.deleteRow(beforeRow.id);
      }
    },
    /**
     * Inserts a row with a placeholder tile if needed at the given index in the rowList.
     * The index can be 0 (top of the rowList) up to the full rowCount (the position after the last existing row).
     * @param rowList
     * @param rowIndex
     */
    addPlaceholderRowIfAppropriate(rowList: RowListType, rowIndex: number) {
      const beforeRow = (rowIndex > 0) && rowList.getRowByIndex(rowIndex - 1);
      const afterRow = (rowIndex < rowList.rowCount) && rowList.getRowByIndex(rowIndex);
      const beforeRowIsHeader = beforeRow && (beforeRow.isSectionHeader || beforeRow.isFixedPositionRow(self.tileMap));
      if (beforeRowIsHeader && (!afterRow || afterRow.isSectionHeader)) {
        const beforeSectionId = beforeRow.sectionId;
        const containerType = getType(self.getRowListForRow(beforeRow.id)).name;
        const content = PlaceholderContentModel.create({sectionId: beforeSectionId, containerType});
        const tile = TileModel.create({ content });
        self.tileMap.put(tile);
        rowList.addNewTileInNewRowAtIndex(tile, rowIndex);
      }
    },
    removePlaceholderTilesFromRow(row: TileRowModelType) {
      const isPlaceholderTileId = (tileId: string) => {
        return self.getTileType(tileId) === "Placeholder";
      };
      row?.removeTilesFromRow(isPlaceholderTileId);
    }
  }))
  .actions(self => ({
    afterCreate() {
      self.allRows.forEach(row => {
        row.updateLayout(self.tileMap);
      });
      // fix any "collapsed" sections
      self.allRowLists.forEach(rowList => {
        for (let i = 1; i <= rowList.rowCount; ++i) {
          self.addPlaceholderRowIfAppropriate(rowList, i);
        }
      });

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
      const rowList = o.rowList ?? self;
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.defaultInsertRowIndex;
      }
      const row = TileRowModel.create({});
      rowList.insertRow(row, o.rowIndex);

      const id = o.tileId;
      const tileContent: ITileModelSnapshotIn = { id, title: o.title, content };
      const tileModel = self.addToTileMap(tileContent);
      row.insertTileInRow(tileModel);

      self.removeNeighboringPlaceholderRows(row.id);
      if (o.rowHeight) {
        row.setRowHeight(o.rowHeight);
      }
      return { rowId: row.id, tileId: tileModel.id };
    },
    addTileSnapshotInExistingRow(snapshot: ITileModelSnapshotIn, options: INewTileOptions): INewRowTile | undefined {
      const o = options || {};
      const rowList = o.rowList ?? self;
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen.
        o.rowIndex = self.defaultInsertRowIndex;
      }
      const row = o.rowId ? rowList.getRow(o.rowId) : rowList.getRowByIndex(o.rowIndex);
      if (row) {
        const indexInRow = o.locationInRow === "left" ? 0 : undefined;
        const tileModel = self.addToTileMap(snapshot);
        row.insertTileInRow(tileModel, indexInRow);
        self.removePlaceholderTilesFromRow(row);
        self.removeNeighboringPlaceholderRows(row.id);
        if (o.rowHeight) {
          row.setRowHeight(Math.max((row.height || 0), o.rowHeight));
        }
        return { rowId: row.id, tileId: tileModel.id };
      }
    },
    deleteRowAddingPlaceholderRowIfAppropriate(rowId: string) {
      const rowList = self.getRowListForRow(rowId);
      const rowIndex = rowList.getRowIndex(rowId);
      const row = rowList.deleteRow(rowId);
      self.addPlaceholderRowIfAppropriate(rowList, rowIndex);
      return row;
    },
    showPendingInsertHighlight(show: boolean, rowId?: string) {
      self.highlightPendingDropLocation = show ? rowId ?? self.defaultInsertRowId : undefined;
    }
  }))
  .actions((self) => ({
    copyTilesIntoExistingRow(tiles: IDropTileItem[], rowInfo: IDropRowInfo, makeTitlesUnique: boolean) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        // If inserting to the left, reverse the order of the tiles so that
        // the first tile is the one that ends up at the beginning of the row.
        const orderedTiles = rowInfo.rowDropLocation === "left" ? tiles.reverse() : tiles;
        orderedTiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const parsedContent = safeJsonParse<ITileModelSnapshotIn>(tile.tileContent);
          const title = parsedContent?.title;
          const newTitle = makeTitlesUnique ? self.getUniqueTitle(title) : title;
          const content = parsedContent?.content;
          if (content) {
            if (tile.embedded) {
              // already is part of another tile, so we don't need to add it to any rows, just the tileMap.
              self.addToTileMap(parsedContent, tile.newTileId, newTitle);
              result = { rowId: "", tileId: tile.newTileId };
            } else {
              const rowOptions: INewTileOptions = {
                rowId: rowInfo.rowDropId,
                locationInRow: rowInfo.rowDropLocation
              };
              if (tile.rowHeight) {
                rowOptions.rowHeight = tile.rowHeight;
              }
              const adjustedSnapshot = {
                  ...parsedContent,
                  id: tile.newTileId,
                  title: newTitle
                };
              result = self.addTileSnapshotInExistingRow(adjustedSnapshot, rowOptions);
            }
          }
          results.push(result);
        });
      }
      return results;
    },
    copyTilesIntoNewRows(tiles: IDropTileItem[], rowInfo: IDropRowInfo, makeTitlesUnique: boolean) {
      const results: NewRowTileArray = [];
      if (tiles.length > 0) {
        let rowDelta = -1;
        let lastRowIndex = -1;
        let lastRowId = "";
        tiles.forEach(tile => {
          let result: INewRowTile | undefined;
          const parsedContent = safeJsonParse<ITileModelSnapshotIn>(tile.tileContent);
          const title = parsedContent?.title;
          const newTitle = makeTitlesUnique ? self.getUniqueTitle(title) : title;
          const content = parsedContent?.content;
          if (content) {
            if (tile.embedded) {
              // already is part of another tile, so we don't need to add it to any rows, just the tileMap.
              self.addToTileMap(parsedContent, tile.newTileId, newTitle);
              result = { rowId: "", tileId: tile.newTileId };
            } else {
              if (tile.rowIndex !== lastRowIndex) {
                rowDelta++;
              }
              const tileOptions: INewTileOptions = {
                rowList: (rowInfo.rowDropId && self.getRowListForRow(rowInfo.rowDropId)) || self,
                rowId: lastRowId,
                rowIndex: rowInfo.rowInsertIndex + rowDelta,
                tileId: tile.newTileId,
                title: newTitle
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
    moveRow(srcRowId: string, destRowId: string, position: "top" | "bottom") {
      const srcRowList = self.getRowListForRow(srcRowId);
      const srcRow = srcRowList.getRow(srcRowId);
      if (!srcRow || !srcRowList) {
        console.warn("Source row is missing", srcRowId);
        return;
      }
      const dstRowList = self.getRowListForRow(destRowId);
      const dstRow = dstRowList.getRow(destRowId);
      const dstRowIndex = dstRowList.getRowIndex(destRowId);
      if (!dstRow || !dstRowList) {
        console.warn("Destination row is missing", destRowId);
        return;
      }
      // Cannot move a row above a top section header.
      if (position === "top" && dstRow.isSectionHeader && dstRowIndex === 0) {
        return;
      }

      const row = self.deleteRowAddingPlaceholderRowIfAppropriate(srcRowId);
      if (!row) {
        console.warn("Failed to remove row to move it", srcRowId);
        return;
      }
      const insertIndex = dstRowIndex + (position === "top" ? 0 : 1);
      dstRowList.insertRow(row, insertIndex);

      self.removeNeighboringPlaceholderRows(row.id);
    },
    moveTileToRow(tileId: string, rowId: string, tileIndex?: number) {
      const srcRow = self.getRowForTile(tileId);
      const dstRow = rowId && self.getRowRecursive(rowId);
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
    createRowRelativeToRow(rowInfo: IDropRowInfo, rowSpec: TileRowSnapshotType) {
      const { rowDropId, rowDropLocation } = rowInfo;
      if (!rowDropId || !rowDropLocation) {
        console.warn("Source row is missing", rowDropId);
        return;
      }
      const rowList = self.getRowListForRow(rowDropId);
      const row = self.getRowRecursive(rowDropId);
      if (!rowList || !row) {
        console.warn("Source row is missing", rowDropId);
        return;
      }
      const insertIndex = rowList.getRowIndex(rowDropId) + (rowDropLocation === "top" ? 0 : 1);
      const newRow = TileRowModel.create(rowSpec);
      rowList.insertRow(newRow, insertIndex);
      return newRow;
    },
    moveTileToNewRow(tileId: string, rowInfo: IDropRowInfo) {
      const srcRow = self.findRowContainingTile(tileId);
      const tile = self.getTile(tileId);
      if (!srcRow || !tile) return;

      // create tile, insert tile, insert row
      const rowSpec: TileRowSnapshotType = {};
      if (tile.isUserResizable) {
        rowSpec.height = srcRow.height;
      }
      const dstRow = this.createRowRelativeToRow(rowInfo, rowSpec);
      if (!dstRow) {
        console.warn("Failed to create destination row", rowInfo);
        return;
      }
      dstRow.insertTileInRow(tile);
      self.removeNeighboringPlaceholderRows(dstRow.id);

      // remove tile from source row
      srcRow.removeTileFromRow(tileId);
      if (!srcRow.tiles.length) {
        self.deleteRowAddingPlaceholderRowIfAppropriate(srcRow.id);
      }
      else {
        if (!srcRow.isUserResizable) {
          srcRow.height = undefined;
        }
      }
      // Return the new row
      return dstRow;
    },
    createTileContent(tileType: string, title?: string, url?: string): ITileContentModel {
      const contentInfo = getTileContentInfo(tileType);
      if (!contentInfo) {
        throw new Error(`Invalid tile type: ${tileType}`);
      }
      const appConfig = getAppConfig(self);
      return contentInfo.defaultContent({ title, url, appConfig, tileFactory: this.createTile });
    },
    createTile(tileType: string, title?: string): ITileModel {
      const content = this.createTileContent(tileType);
      return self.tileMap.put({content, title});
    }
  }))
  .actions(self => {
    const actions = {
      deleteTile(tileId: string, createPlaceholdersIfNeeded = true) {
        const rowsToDelete: TileRowModelType[] = [];
        self.allRows.forEach(row => {
          if (!isAlive(row)) {
            // Skip any rows that have already been deleted.
            return;
          }
          // remove from row
          if (row.hasTile(tileId)) {
            const tile = self.getTile(tileId);
            tile && tile.willRemoveFromDocument();
            // Remove any embedded tiles/rows
            const tileContent = tile?.content;
            if (tileContent && isRowListContainer(tileContent)) {
              tileContent.tileIds.forEach(embeddedTileId => {
                this.deleteTile(embeddedTileId, false);
              });
            }
            row.removeTileFromRow(tileId);
          }
          // track empty rows
          if (row.isEmpty) {
            rowsToDelete.push(row);
          }
        });
        // remove empty rows
        rowsToDelete.forEach(row => {
          if (createPlaceholdersIfNeeded) {
            self.deleteRowAddingPlaceholderRowIfAppropriate(row.id);
          } else {
            self.getRowListForRow(row.id)?.deleteRow(row.id);
          }
        });
        // delete tile
        self.tileMap.delete(tileId);
      },
      moveTile(tileId: string, rowInfo: IDropRowInfo, tileIndex = 0) {
        const srcRowId = self.findRowIdContainingTile(tileId);
        if (!srcRowId) return;

        const { rowDropId, rowDropLocation } = rowInfo;
        if (rowDropId && (rowDropLocation === "left")) {
          self.moveTileToRow(tileId, rowDropId, tileIndex);
          return;
        }
        if (rowDropId && (rowDropLocation === "right")) {
          self.moveTileToRow(tileId, rowDropId);
          return;
        }
        if (rowDropLocation === "top" || rowDropLocation === "bottom") {
          // if only one tile in source row, move the entire row
          if (self.numTilesInRow(srcRowId) === 1) {
            if (rowDropId) {
              self.moveRow(srcRowId, rowDropId, rowDropLocation);
            }
          }
          else {
            self.moveTileToNewRow(tileId, rowInfo);
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


        // TODO: The table tile is the only tile that uses the title property
        // here the title gets set as the name of the dataSet that is created by
        // the table's defaultContent. We should find a way for the table tile
        // to work without needing this title.
        const newContent = self.createTileContent(toolId, title, url);
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
                const newRowId = firstTileId && self.findRowIdContainingTile(firstTileId);
                const newRowIndex = newRowId ? self.getRowIndex(newRowId) : undefined;
                insertRowInfo.rowDropLocation = "right";
                if (newRowIndex != null) {
                  insertRowInfo.rowInsertIndex = newRowIndex;
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
      srcRow.tiles.forEach((tile, index) => {
        self.moveTile(tile.tileId, rowInfo, index);
      });
      // MoveTile will delete the row when it's empty.
    },
    moveTilesToNewRow(rowTiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      const { rowDropId } = rowInfo;
      if (!rowDropId) {
        console.warn("Missing rowDropId in rowInfo", rowInfo);
        return;
      }
      let dstRow: TileRowModelType | undefined = undefined;
      rowTiles.forEach((tile, index) => {
        if (index === 0) {
          dstRow = self.moveTileToNewRow(tile.tileId, rowInfo);
        }
        else {
          self.moveTileToRow(tile.tileId, dstRow!.id, index);
        }
      });
    },
    moveTilesToExistingRow(rowTiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      rowTiles.forEach((tile, index) => {
        self.moveTile(tile.tileId, rowInfo, index);
      });
    }
  }))
  .actions(self => ({
    moveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      if (tiles.length > 0) {
        // organize tiles by row
        const tileRows: {[id: string]: IDragTileItem[]} = {};
        tiles.forEach(tile => {
          const rowId = self.getRowIdForTile(tile.tileId);
          if (rowId) {
            tileRows[rowId] = tileRows[rowId] || [];
            tileRows[rowId].push(tile);
          }
        });

        const { rowDropId, rowDropLocation } = rowInfo;
        const dstRow = rowInfo.rowDropId ? self.getRowRecursive(rowInfo.rowDropId) : undefined;
        if (!rowDropId || !dstRow) {
          console.warn("Drop row is missing", rowDropId);
          return;
        }

        // Is the destination row embedded in a tile (presumably a Question tile)?
        // Question tiles cannot nest, so we filter them out.
        const destIsEmbeddedRow = dstRow.isEmbeddedRow();

        // Move each set of tiles that share a row.
        Object.values(tileRows).forEach(rowTiles => {
          if (destIsEmbeddedRow) {
            const filteredTiles = rowTiles.filter(tile => !isRowListContainer(self.getTile(tile.tileId)?.content));
            if (filteredTiles.length < rowTiles.length) {
              // console.log("Filtered out question tiles"); // should we have some sort of warning here?
              rowTiles = filteredTiles;
            }
          }
          if (rowTiles.length === 0) return;

          const row = self.getRowForTile(rowTiles[0].tileId);
          if (row?.tiles.length === rowTiles.length) {
            if ((rowDropLocation === "left") || (rowDropLocation === "right")) {
              // entire row is being merged with an existing row
              if (dstRow && row.id !== dstRow?.id && !dstRow.isSectionHeader) {
                self.mergeRow(row, rowInfo);
              } else {
                console.warn("Failed to merge row", row.id, "into", rowDropId,
                  "Destination same as source, or is a section header");
              }
            }
            else if (rowDropLocation === "top" || rowDropLocation === "bottom") {
              // entire row is being moved to a new row
              if (row.id !== dstRow.id) {
                self.moveRow(row.id, rowDropId, rowDropLocation);
              } else {
                console.warn("Cannot move row", row.id, "onto itself");
              }
            }
            else {
              console.warn("Unknown row drop location", rowDropLocation);
            }
          }
          else {
            if ((rowDropLocation === "left") || (rowDropLocation === "right")) {
              // part of row is being moved into an existing row
              self.moveTilesToExistingRow(rowTiles, rowInfo);
            }
            else {
              // part of row is being moved to a new row
              self.moveTilesToNewRow(rowTiles, rowInfo);
            }
          }
        });
      }
    },
    /**
     * This should not be called by users. It is used internally and by the
     * SharedModelDocumentManager
     *
     * This index is used for assigning colors to datasets. It is not a computed
     * property because we want it to be stable. When a shared model is removed,
     * the other shared model indexes should not change.
     *
     * @param sharedModel
     */
    _assignSharedModelIndexOfType(sharedModel: SharedModelType) {
      if (sharedModel.indexOfType < 0) {
        const usedIndices = new Set<number>();
        const sharedModels = self.getSharedModelsByType(sharedModel.type);
        sharedModels?.forEach(model => {
          if (model.indexOfType >= 0) {
            usedIndices.add(model.indexOfType);
          }
        });
        for (let i = 0; sharedModel.indexOfType < 0; ++i) {
          if (!usedIndices.has(i)) {
            sharedModel.setIndexOfType(i);
            break;
          }
        }
      }
    }
  }))
  .actions(self => ({
    addSharedModel(sharedModel: SharedModelType) {
      // we make sure there isn't an entry already otherwise adding a shared
      // model twice would clobber the existing entry.
      let sharedModelEntry = self.sharedModelMap.get(sharedModel.id);

      if (!sharedModelEntry) {
        self._assignSharedModelIndexOfType(sharedModel);

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
    /**
     * This should not be called directly, but rather through
     * `sharedModelManager.addTileSharedModel`
     */
    _addTileSharedModel(tile: ITileModel, sharedModel: SharedModelType, isProvider = false): void {
      // register it with the document if necessary.
      // This won't re-add it if it is already there
      const sharedModelEntry = self.addSharedModel(sharedModel);

      // If the sharedModel was added before and it is already linked to this tile,
      // we don't need to do anything
      if (sharedModelEntry.tiles.includes(tile)) {
        return;
      }

      // The TreeMonitor will identify this change as a shared model change and call
      // updateAfterSharedModelChanges on the tile content model.
      sharedModelEntry.addTile(tile, isProvider);
    }
  }))
  .actions(self => ({
    userAddTile(toolId: string, options?: IDocumentContentAddTileOptions) {
      if (options?.insertRowInfo?.rowDropId
        && self.getRowRecursive(options.insertRowInfo.rowDropId)?.isEmbeddedRow()
        && getTileContentInfo(toolId)?.isContainer) {
        console.warn("Container tiles cannot be nested");
        return;
      }
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
        logTileDocumentEvent(LogEventName.DELETE_TILE, { tile }, () => {
          self.deleteTile(tileId);
        });
      }
    },
    userMoveTiles(tiles: IDragTileItem[], rowInfo: IDropRowInfo) {
      // Get the container of each tile before it is moved.
      const containers = new Map<string, string>();
      tiles.forEach(tileItem => {
        const container = self.getTileContainingTileId(tileItem.tileId);
        if (container) {
          containers.set(tileItem.tileId, container.id);
        }
      });
      self.moveTiles(tiles, rowInfo);
      tiles.forEach(tileItem => {
        const tile = self.getTile(tileItem.tileId);
        tile && logTileDocumentEvent(LogEventName.MOVE_TILE, { tile, containerId: containers.get(tileItem.tileId) });
      });
    },
    userCopyTiles(tiles: IDropTileItem[], rowInfo: IDropRowInfo, makeTitlesUnique: boolean) {
      const rowList = (rowInfo.rowDropId && self.getRowListForRow(rowInfo.rowDropId)) || self;
      const dropRow = rowInfo.rowDropId
        ? self.getRowRecursive(rowInfo.rowDropId)
        : (rowInfo.rowInsertIndex != null) ? rowList.getRowByIndex(rowInfo.rowInsertIndex) : undefined;
      // Refuse the drop if there are any container tiles that would create improper nesting.
      if (dropRow?.isEmbeddedRow()) {
        if (tiles.find(tile => getTileContentInfo(tile.tileType)?.isContainer)) {
          console.warn("Container tiles cannot be nested");
          return;
        }
      }
      const results = dropRow?.acceptTileDrop(rowInfo, self.tileMap)
                      ? self.copyTilesIntoExistingRow(tiles, rowInfo, makeTitlesUnique)
                      : self.copyTilesIntoNewRows(tiles, rowInfo, makeTitlesUnique);
      self.logCopyTileResults(tiles, results);
      return results;
    }
  }));

  export type BaseDocumentContentModelType = Instance<typeof BaseDocumentContentModel>;
