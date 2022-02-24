import { types, Instance } from "mobx-state-tree";
import { kStarterToolID } from "./starter-types";

export function defaultStarterContent(): StarterContentModelType {
  return StarterContentModel.create();
}

export const kPluginDefaultHeight = 200;

export const StarterContentModel = types
  .model("StarterTool", {
    type: types.optional(types.literal(kStarterToolID), kStarterToolID),
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

export type StarterContentModelType = Instance<typeof StarterContentModel>;
