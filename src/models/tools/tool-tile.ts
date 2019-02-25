import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { findMetadata, ToolContentUnion, ToolContentUnionType } from "./tool-types";
import * as uuid from "uuid/v4";

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export function createToolTileModelFromContent(content: ToolContentUnionType) {
  // cast required as of MST ~3.8 -- seems unnecessary
  return ToolTileModel.create({ content } as any);
}

export const ToolTileModel = types
  .model("ToolTile", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uuid()),
    // e.g. "GeometryContentModel", "ImageContentModel", "TableContentModel", "TextContentModel"
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
    },
    get isUserResizable() {
      return !!(self.content as any).isUserResizable;
    }
  }))
  .actions(self => ({
    afterCreate() {
      const metadata = findMetadata(self.content.type, self.id);
      const content = self.content as any;
      if (metadata && content.doPostCreate) {
        content.doPostCreate(metadata);
      }
    },
    willRemoveFromDocument() {
      const willRemoveFromDocument = (self.content as any).willRemoveFromDocument;
      return willRemoveFromDocument && willRemoveFromDocument();
    }
  }));

export type ToolTileModelType = Instance<typeof ToolTileModel>;
export type ToolTileSnapshotOutType = SnapshotOut<typeof ToolTileModel>;
