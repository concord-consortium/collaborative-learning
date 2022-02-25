import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kStarterToolID } from "./starter-types";

export function defaultStarterContent(): StarterContentModelType {
  return StarterContentModel.create();
}


export const StarterContentModel = ToolContentModel
  .named("StarterTool")
  .props({
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

export interface StarterContentModelType extends Instance<typeof StarterContentModel> {}
