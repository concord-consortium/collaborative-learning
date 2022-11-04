import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../models/tiles/tile-types";
import { kStarterToolID } from "./starter-types";

export function defaultStarterContent(): StarterContentModelType {
  return StarterContentModel.create({text: "Hello World"});
}


export const StarterContentModel = ToolContentModel
  .named("StarterTool")
  .props({
    type: types.optional(types.literal(kStarterToolID), kStarterToolID),
    text: "",
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    }
  }));

export interface StarterContentModelType extends Instance<typeof StarterContentModel> {}
