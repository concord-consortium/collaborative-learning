import { types } from "mobx-state-tree";
import { ToolTileModel } from "./tools/tool-tile";

const kDefaultRowHeight = 24;

export const DocumentRowModel = types
  .model("DocumentRow", {
    height: kDefaultRowHeight,
    tiles: types.array(ToolTileModel)
  });

export type DocumentRowModelType = typeof DocumentRowModel.Type;
