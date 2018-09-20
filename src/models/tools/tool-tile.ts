import { types, Instance } from "mobx-state-tree";
import { TileLayoutModel } from "./tile-layout";
import { ToolContentUnion } from "./tool-types";
import * as uuid from "uuid/v4";

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export const ToolTileModel = types
  .model("ToolTile", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uuid()),
    // optional information about placement of tile
    layout: types.maybe(TileLayoutModel),
    // e.g. "GeometryContentModel", "RichTextContentModel", "TableContentModel", "TextContentModel"
    content: ToolContentUnion
  })
  .views(self => ({
    // generally negotiated with tool, e.g. single column width for table
    get minWidth() {
      return kDefaultMinWidth;
    },
    // undefined by default, but can be negotiated with app,
    // e.g. width of all columns for table
    get maxWidth(): number | undefined {
      return;
    }
  }));

export type ToolTileModelType = Instance<typeof ToolTileModel>;
