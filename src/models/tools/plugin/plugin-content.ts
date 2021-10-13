import { types, Instance } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";

export const kPluginToolID = "Plugin";

export function defaultPluginContent(): PluginContentModelType {
  return PluginContentModel.create();
}

export const kPluginDefaultHeight = 200;

export const PluginContentModel = types
  .model("PluginTool", {
    type: types.optional(types.literal(kPluginToolID), kPluginToolID),
    text: "Hello World",
  })
  .views(self => ({
    isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    }
  }));

export type PluginContentModelType = Instance<typeof PluginContentModel>;

registerToolContentInfo({
  id: kPluginToolID,
  tool: "plugin",
  modelClass: PluginContentModel,
  defaultHeight: kPluginDefaultHeight,
  defaultContent: defaultPluginContent,
});
