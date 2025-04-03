import { Instance, types, detach } from "mobx-state-tree";
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
    // Returns a string that describes the row list and its contents.
    // For testing/debugging purposes only, but may be useful to keep.
    debugDescribeThis(tileMap: Map<string, ITileModel>, indent: string): string {
      return self.rowOrder.map(rowId => {
        const row = self.rowMap.get(rowId);
        const embedded: RowListType[] = [];
        if (row) {
          return indent + row.id + ": " +
            row?.tiles.map(tileLayout => {
              const tile = tileMap.get(tileLayout.tileId);
              if (tile?.content && isRowListContainer(tile.content)) {
                embedded.push(tile.content);
              }
              return "[" + (tile?.content.type || "No type") + ": " + tile?.id + "]";
            }).join(" ") +
            embedded.map(rowList => {
              return "\n" + indent + "Contents of embedded row list:\n"
              + rowList.debugDescribeThis(tileMap, indent + "  ");
            }).join("\n");
        } else {
          return indent + "[" + rowId + " (nonexistent)]";
        }
      }).join("\n");
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
    // Deletes the row, and returns its content as a detached object.
    deleteRow(rowId: string) {
      const existingRow = self.rowMap.get(rowId);
      if (existingRow) {
        const row = detach(existingRow);
        self.rowOrder.remove(rowId);
        self.rowMap.delete(rowId);
        return row;
      }
    },
    setVisibleRows(rows: string[]) {
      self.visibleRows = rows;
    },
  }))
  .actions(self => ({
    addRowWithTiles(tiles: ITileModel[]) {
      const row = TileRowModel.create({});
      tiles.forEach(tile => row.insertTileInRow(tile));
      self.insertRow(row);
    },
    addNewTileInNewRowAtIndex(tile: ITileModel, rowIndex: number) {
      const row = TileRowModel.create({});
      self.insertRow(row, rowIndex);
      row.insertTileInRow(tile);
      return row;
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
