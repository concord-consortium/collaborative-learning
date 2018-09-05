import { types } from "mobx-state-tree";
import { ToolTypeUnion } from "./tool-types";

// first tile 100%, second tile 50%, etc.
const kDefaultTileWidthPct = 100;
// generally negotiated with app, e.g. single column width for table
const kDefaultMinWidth = 60;

export const ToolTileModel = types
  .model("ToolTile", {
    // first tile 100%, second tile 50%, etc.
    widthPct: kDefaultTileWidthPct,
    // e.g. "GeometryToolModel", "TableToolModel", "TextToolModel"
    toolContent: ToolTypeUnion
  })
  .views(self => ({
    // generally negotiated with app, e.g. single column width for table
    get minWidth() {
      return kDefaultMinWidth;
    },
    // undefined by default, but can be negotiated with app,
    // e.g. width of all columns for table
    get maxWidth(): number | undefined {
      return;
    }
  }));

export type ToolTileModelType = typeof ToolTileModel.Type;
