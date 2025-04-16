import { cloneDeep } from "lodash";
import { uniqueId } from "../../utilities/js-utils";
import { IArrowAnnotationSnapshot } from "../annotations/arrow-annotation";
import { ITileModelSnapshotIn } from "../tiles/tile-model";
import { DocumentContentSnapshotType } from "./document-content";
import {
  IDocumentImportSnapshot,
  isOriginalAuthoredTileModel,
  isOriginalSectionHeaderContent,
  OriginalAuthoredTileModel,
  OriginalTileModel
} from "./document-content-import-types";
import { TileLayoutSnapshotType, TileRowSnapshotType } from "./tile-row";

type MigratedSnapshot = Required<Pick<DocumentContentSnapshotType,
  'sharedModelMap' | 'tileMap' | 'rowMap'>> &
  {
    // MST SnapshotIn makes rowOrder readonly so we have to override it
    rowOrder: string[];
    // For some reason MST SnapshotIn doesn't include the 'annotations' field.
    // SnapshotOut does, but the types from SnapshotOut have other problems
    annotations: Record<string, IArrowAnnotationSnapshot>
  };

type MigratedRow = TileRowSnapshotType & {
  tiles: TileLayoutSnapshotType[]
};

export function migrateSnapshot(snapshot: IDocumentImportSnapshot): any {
  const { tiles: tilesOrRows, sharedModels, annotations } = snapshot;

  let importContextTileCounts = {} as Record<string, number>;
  let importContextCurrentSection = "";

  function getNextTileId(tileType: string) {
    if (!importContextTileCounts[tileType]) {
      importContextTileCounts[tileType] = 1;
    } else {
      ++importContextTileCounts[tileType];
    }

    // FIXME: This doesn't generate unique ids.
    // Many sections are unnamed, so they never set the importContextCurrentSection.
    // The result is tiles in different sections (including different investigations and problems)
    // have the same id, and in turn share the same metadata.
    // We tried to change this: https://github.com/concord-consortium/collaborative-learning/pull/1984
    // That was reverted: https://github.com/concord-consortium/collaborative-learning/pull/1993
    // The reverting PR has details of various fixes.
    const section = importContextCurrentSection || "document";
    return `${section}_${tileType}_${importContextTileCounts[tileType]}`;
  }

  const newSnapshot: MigratedSnapshot = {
    sharedModelMap: {},
    tileMap: {},
    rowMap: {},
    rowOrder: [],
    annotations: {}
  };

  function addTileToRow(tile: OriginalAuthoredTileModel, row: MigratedRow,
      tileMap: Record<string, ITileModelSnapshotIn>) {
    const { layout, ...newTile } = cloneDeep(tile);
    const tileHeight = layout?.height;

    const nestedTiles = newTile.content.tiles;
    delete newTile.content.tiles;

    const tileId = newTile.id || getNextTileId(newTile.content.type);
    const tileSnapshot = { id: tileId, ...newTile };

    tileMap[tileId] = tileSnapshot;

    row.tiles = [...(row.tiles || []), { tileId }];
    if (tileHeight) {
      row.height = Math.max((row.height || 0), tileHeight);
    }

    if (nestedTiles) {
      tileSnapshot.content.rowMap = {} as Record<string, MigratedRow>;
      tileSnapshot.content.rowOrder = [];
      nestedTiles.forEach((tileOrRow: any) => {
        if (Array.isArray(tileOrRow)) {
          migrateRow(tileOrRow, newSnapshot.tileMap, tileSnapshot.content.rowMap, tileSnapshot.content.rowOrder);
        }
        else {
          migrateTile(tileOrRow, newSnapshot.tileMap, tileSnapshot.content.rowMap, tileSnapshot.content.rowOrder);
        }
      });
     }
  }

  function addRow(rowMap: Record<string, MigratedRow>, rowOrder: string[]) {
    const id = uniqueId();
    const row = { id, tiles: [] } as MigratedRow;
    rowMap[id] = row;
    rowOrder.push(id);
    return row;
  }

  function migrateTile(tile: OriginalTileModel, tileMap: Record<string, ITileModelSnapshotIn>,
      rowMap: Record<string, MigratedRow>, rowOrder: string[]) {
    if (isOriginalSectionHeaderContent(tile.content)) {
      const { sectionId } = tile.content;
      importContextTileCounts = {};
      importContextCurrentSection = sectionId;
      const row = addRow(rowMap, rowOrder);
      row.sectionId = sectionId;
      row.isSectionHeader = true;
    }
    else if (isOriginalAuthoredTileModel(tile)) {
      const row = addRow(rowMap, rowOrder);
      addTileToRow(tile, row, tileMap);
    }
  }

  function migrateRow(tiles: OriginalTileModel[], tileMap: Record<string, ITileModelSnapshotIn>,
      rowMap: Record<string, MigratedRow>, rowOrder: string[]) {
    let row: MigratedRow | undefined;
    tiles.forEach((tile) => {
      // If this is a section header then skip it
      if (!isOriginalAuthoredTileModel(tile)) return;

      if (!row) {
        row = addRow(rowMap, rowOrder);
      }

      addTileToRow(tile, row, tileMap);
    });
  }

  sharedModels?.forEach((entry) => {
    const {sharedModel} = entry;
    const id = sharedModel.id;
    if (!id) {
      /* istanbul ignore next */
      console.warn("cannot import a shared model without an id", sharedModel);
      return;
    }
    newSnapshot.sharedModelMap[id] = entry;
  });

  tilesOrRows.forEach(tileOrRow => {
    if (Array.isArray(tileOrRow)) {
      migrateRow(tileOrRow, newSnapshot.tileMap,
        newSnapshot.rowMap as Record<string, MigratedRow>, newSnapshot.rowOrder);
    }
    else {
      migrateTile(tileOrRow, newSnapshot.tileMap,
        newSnapshot.rowMap as Record<string, MigratedRow>, newSnapshot.rowOrder);
    }
  });
  annotations?.forEach(entry => {
    const id = entry.id;
    if (!id) {
      /* istanbul ignore next */
      console.warn("cannot import an annotation without an id", entry);
      return;
    }
    newSnapshot.annotations[id] = entry;
  });

  return newSnapshot;
}
