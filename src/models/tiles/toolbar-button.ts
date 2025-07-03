import { getEnv, hasEnv, Instance, SnapshotOut, types } from "mobx-state-tree";
import { getTileComponentInfo } from "./tile-component-info";
import { getTileContentInfo } from "./tile-content-info";

const BaseToolbarButtonModel = types.model("BaseToolbarButton", {
  id: types.string, // tile type in the case of tile buttons
  title: types.maybe(types.string),
  isDefault: false,
  isPrimary: types.maybe(types.boolean),
  isBottom: types.maybe(types.boolean),
  height: types.maybe(types.number),
})
.volatile(self => ({
  Icon: undefined as any
}))
.actions(self => ({
  setIcon(Icon: any) {
    self.Icon = Icon;
  },
  setTitle(title: string) {
    self.title = title;
  }
}))
.views(self => ({
  get env() {
    return hasEnv(self) ? getEnv(self) : undefined;
  }
}));

const AppToolbarButtonModel = BaseToolbarButtonModel.named("AppToolbarButtonModel")
  .props({
    iconId: types.string,
    title: types.string, // Titles are required on app toolbar buttons
    isTileTool: types.literal(false),
  })
  .actions(self => ({
    initialize() {
      if (!self.Icon) {
        // Get the appConfig from the environment
        // Unfortunately the environment cannot be typed very well
        //   https://github.com/mobxjs/mobx-state-tree/issues/431
        const appIcons = self.env?.appIcons;
        self.setIcon(appIcons?.[self.iconId]);
      }
    }
  }));

const TileToolbarButtonModel = BaseToolbarButtonModel.named("TileToolbarButtonModel")
  .props({
    isTileTool: types.literal(true)
  })
  .actions(self => ({
    initialize() {
      if (!self.Icon) {
        const info = getTileComponentInfo(self.id);
        info?.Icon && (self.setIcon(info.Icon));
      }
      if (!self.title) {
        const info = getTileContentInfo(self.id);
        const title = info?.displayName || info?.type;
        title && (self.setTitle(title));
      }
    }
  }));

export const ToolbarButtonModel = types.union(AppToolbarButtonModel, TileToolbarButtonModel);

// This can't be an interface because the type is a union which is not supported
// by typescript interfaces
export type IToolbarButtonModel = Instance<typeof ToolbarButtonModel>;
export type IToolbarButtonSnapshot = SnapshotOut<typeof ToolbarButtonModel>;
