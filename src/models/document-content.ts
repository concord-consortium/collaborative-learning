import { types, Instance } from "mobx-state-tree";
import { DataSet } from "./data/data-set";
import { ToolTileModel } from "./tools/tool-tile";

export const DocumentContentModel = types
  .model("DocumentContent", {
    tiles: types.array(ToolTileModel),
    // data shared between tools
    shared: types.maybe(DataSet)
  });

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
