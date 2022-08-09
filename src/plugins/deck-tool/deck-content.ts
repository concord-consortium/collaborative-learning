import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";
import { ITileExportOptions } from "../../models/tools/tool-content-info";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create({deckDescription: "Hello World"});
}

export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
    deckDescription: "",
    title: ""
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "Deck",`,
        `  "title": ${self.title}`,
        `  "deckDescription": ${self.deckDescription},`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => ({
    setDescription(text: string) {
      self.deckDescription = text;
    },
    setTitle(text: string){
      self.title = text;
    }
  }));

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
