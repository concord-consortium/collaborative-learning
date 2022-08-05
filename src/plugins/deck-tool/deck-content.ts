import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create({text: "Hello World"});
}


export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
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

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
