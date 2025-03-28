import { Instance, types } from "mobx-state-tree";
import { ITileModel } from "../tiles/tile-model";
import { TileRowModel, TileRowModelType } from "./tile-row";

/**
 * Base model for managing a list of rows.
 * This is extracted from BaseDocumentContentModel to provide reusable row management functionality.
 */
export const RowList = types
  .model("RowList", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
  })
  .volatile(self => ({
    visibleRows: [] as string[],
  }))
  .views(self => ({
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
    get indexOfLastVisibleRow() {
      // returns last visible row or last row
      if (!self.rowOrder.length) return -1;
      const lastVisibleRowId = self.visibleRows.length
                                ? self.visibleRows[self.visibleRows.length - 1]
                                : self.rowOrder[self.rowOrder.length - 1];
      return self.rowOrder.indexOf(lastVisibleRowId);
    },
    /**
     * Returns all tile ids directly in this RowList container.
     * Does not include tile ids from nested RowList containers.
     */
    get tileIds() {
      return self.rowOrder.flatMap(rowId => this.getRow(rowId)?.allTileIds ?? []);
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
    setVisibleRows(rows: string[]) {
      self.visibleRows = rows;
    }
  }))
  .actions(self => ({
    addRowWithTiles(tiles: ITileModel[]) {
      const row = TileRowModel.create({});
      tiles.forEach(tile => row.insertTileInRow(tile));
      self.insertRow(row);
    }
  }));

export type RowListType = Instance<typeof RowList>;

export function isRowListContainer(model: any): model is RowListType {
  if (!model) return false;
  // Check if the model has the required RowList properties
  return typeof model.rowMap !== 'undefined' &&
         typeof model.rowOrder !== 'undefined' &&
         Array.isArray(model.rowOrder);
}
