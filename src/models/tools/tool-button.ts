import { getEnv, Instance, SnapshotOut, types } from "mobx-state-tree";
import { getToolContentInfoById } from "./tool-content-info";

const BaseToolButtonModel = types.model("BaseToolButton", {
  id: types.string, // toolId in the case of tool buttons
  title: types.string,
  isDefault: false,
});

const AppToolButtonModel = BaseToolButtonModel.named("AppToolButtonModel")
  .props({
    iconId: types.string,
    isTileTool: types.literal(false)
  })
  .views(self => ({
    get Icon() {
      // Get the appConfig from the environment
      // Unfortunately the environment cannot be typed very well
      //   https://github.com/mobxjs/mobx-state-tree/issues/431
      const appIcons = getEnv(self).appIcons;
      return appIcons?.[self.iconId];
    }
  }));

const TileToolButtonModel = BaseToolButtonModel.named("TileToolButtonModel")
  .props({
    isTileTool: types.literal(true)
  })
  .views(self => ({
    get Icon() {
      return  getToolContentInfoById(self.id).Icon;
    }
  }));

export const ToolButtonModel = types.union(AppToolButtonModel, TileToolButtonModel);

// This can't be an interface because the type is a union which is not supported
// by typescript interfaces
export type ToolButtonModelType = Instance<typeof ToolButtonModel>;
export type ToolButtonSnapshot = SnapshotOut<typeof ToolButtonModel>;
