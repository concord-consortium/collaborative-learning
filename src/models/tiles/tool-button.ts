import { getEnv, Instance, SnapshotOut, types } from "mobx-state-tree";
import { getTileComponentInfo } from "./tile-component-info";

const BaseToolButtonModel = types.model("BaseToolButton", {
  id: types.string, // toolId in the case of tool buttons
  title: types.string,
  isDefault: false,
})
.volatile(self => ({
  Icon: undefined as any
}));

const AppToolButtonModel = BaseToolButtonModel.named("AppToolButtonModel")
  .props({
    iconId: types.string,
    isTileTool: types.literal(false)
  })
  .actions(self => ({
    initialize() {
      if (!self.Icon) {
        // Get the appConfig from the environment
        // Unfortunately the environment cannot be typed very well
        //   https://github.com/mobxjs/mobx-state-tree/issues/431
        const appIcons = getEnv(self).appIcons;
        self.Icon = appIcons?.[self.iconId];
      }
    }
  }));

const TileToolButtonModel = BaseToolButtonModel.named("TileToolButtonModel")
  .props({
    isTileTool: types.literal(true)
  })
  .actions(self => ({
    initialize() {
      if (!self.Icon) {
        const info = getTileComponentInfo(self.id);
        info?.Icon && (self.Icon = info.Icon);
      }
    }
  }));

export const ToolButtonModel = types.union(AppToolButtonModel, TileToolButtonModel);

// This can't be an interface because the type is a union which is not supported
// by typescript interfaces
export type ToolButtonModelType = Instance<typeof ToolButtonModel>;
export type ToolButtonSnapshot = SnapshotOut<typeof ToolButtonModel>;
