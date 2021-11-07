import { getEnv, SnapshotOut, types } from "mobx-state-tree";
import { getToolContentInfoByTool } from "./tool-content-info";

const BaseToolButtonModel = types.model("BaseToolButton", {
  name: types.string,
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
      return  getToolContentInfoByTool(self.name).Icon;
    }
  }));

export const ToolButtonModel = types.union(AppToolButtonModel, TileToolButtonModel);

// This can't be an interface because the type is a union which is not supported
// by typescript interfaces
export type ToolButtonSnapshot = SnapshotOut<typeof ToolButtonModel>;
