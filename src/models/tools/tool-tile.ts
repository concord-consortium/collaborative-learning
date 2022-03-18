import { cloneDeep } from "lodash";
import { getSnapshot, Instance, SnapshotIn, SnapshotOut, types } from "mobx-state-tree";
import { isPlaceholderContent } from "./placeholder/placeholder-content";
import { ITileExportOptions } from "./tool-content-info";
import { findMetadata, ToolContentUnion } from "./tool-types";
import { DisplayUserTypeEnum } from "../stores/user-types";
import { uniqueId } from "../../utilities/js-utils";

import { SharedModelType, SharedModelUnion } from "./shared-model";

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export interface IDragTileItem {
  rowIndex: number;
  rowHeight?: number;
  tileIndex: number;
  tileId: string;       // original tile id
  tileContent: string;  // modified tile contents
  tileType: string;
}

export interface IDragTiles {
  sourceDocId: string;
  items: IDragTileItem[];
}

export function cloneTileSnapshotWithoutId(tile: ToolTileModelType) {
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return copy;
}

export function cloneTileSnapshotWithNewId(tile: ToolTileModelType, newId?: string) {
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return { id: newId || uniqueId(), ...copy };
}

export const ToolTileModel = types
  .model("ToolTile", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uniqueId()),
    // whether to restrict display to certain users
    display: DisplayUserTypeEnum,
    // e.g. "GeometryContentModel", "ImageContentModel", "TableContentModel", "TextContentModel", ...
    content: ToolContentUnion,
    sharedModels: types.array(types.reference(SharedModelUnion)),
  })
  .views(self => ({
    // generally negotiated with tool, e.g. single column width for table
    get minWidth() {
      return kDefaultMinWidth;
    },
    // undefined by default, but can be negotiated with app,
    // e.g. width of all columns for table
    get maxWidth(): number | undefined {
      // eslint-disable-next-line no-useless-return
      return;
    },
    get isUserResizable() {
      return !!(self.content as any).isUserResizable;
    },
    get isPlaceholder() {
      return isPlaceholderContent(self.content);
    },
    get placeholderSectionId() {
      return isPlaceholderContent(self.content) ? (self.content).sectionId : undefined;
    },
    exportJson(options?: ITileExportOptions): string | undefined {
      return (self.content as any).exportJson?.(options);
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
    },
    setDisabledFeatures(disabled: string[]) {
      const metadata: any = findMetadata(self.content.type, self.id);
      metadata && metadata.setDisabledFeatures && metadata.setDisabledFeatures(disabled);
    }    
  }))
  .actions(self => ({
    addSharedModel(sharedModel: SharedModelType) {
      self.sharedModels.push(sharedModel);
    },
    setSharedModel(sharedModel: SharedModelType) {
      self.sharedModels.clear();
      self.sharedModels.push(sharedModel);
    }
  }));

export type ToolTileModelType = Instance<typeof ToolTileModel>;
export type ToolTileSnapshotInType = SnapshotIn<typeof ToolTileModel>;
export type ToolTileSnapshotOutType = SnapshotOut<typeof ToolTileModel>;
