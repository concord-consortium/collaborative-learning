import { types } from "mobx-state-tree";
import { DocumentRowModel } from "./document-row";

export const DocumentContentModel = types
  .model("DocumentContent", {
    // rows contain ToolTiles
    rows: types.array(DocumentRowModel)
    // data shared between tools
    // shared: DataManager [TBD]
  });

export type DocumentContentModelType = typeof DocumentContentModel.Type;
