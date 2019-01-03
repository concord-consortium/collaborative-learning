import { types, Instance } from "mobx-state-tree";
import { cloneDeep } from "lodash";

export const kTableToolID = "Table";

export const kTableDefaultHeight = 160;

export function defaultTableContent() {
  return TableContentModel.create({
                            type: "Table"
                          });
}

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const TableToolMetadataModel = types
  .model("TableToolMetadata", {
    id: types.string
  })
  .volatile(self => ({
    columns: [] as any[]
  }))
  .actions(self => ({
    setColumns(columns: any[]) {
      self.columns = columns;
    }
  }));
export type TableToolMetadataModelType = Instance<typeof TableToolMetadataModel>;

let gImportSnapshot: any;

export const TableContentModel = types
  .model("TableContent", {
    type: types.literal(kTableToolID),
    // tool-specific types
  })
  .volatile(self => ({
    metadata: undefined as any as TableToolMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    if (snapshot && (snapshot as any).columns) {
      gImportSnapshot = cloneDeep(snapshot);
      return { type: "Table" };
    }
    return snapshot;
  })
  .extend(self => {
    return {
      views: {
        get columns() {
          return self.metadata.columns;
        }
      },
      actions: {
        doPostCreate(metadata: TableToolMetadataModelType) {
          self.metadata = metadata;
          if (gImportSnapshot && gImportSnapshot.columns) {
            self.metadata.setColumns(gImportSnapshot.columns);
          }
          gImportSnapshot = undefined;
        },
        clearImportSnapshot() {
          self.metadata.setColumns([]);
        }
      }
    };
  });

export type TableContentModelType = Instance<typeof TableContentModel>;
