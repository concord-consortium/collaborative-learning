import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";
import { ITileExportOptions } from "../../models/tools/tool-content-info";
import { ToolMetadataModelType } from "../../models/tools/tool-types";
import { ToolTitleArea } from "../../components/tools/tool-title-area";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create({deckDescription: "Hello World"});
}

export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
    deckDescription: "",
  })
  .volatile(self => ({
    metadata: undefined as any as ToolMetadataModelType
  }))
  .views(self => ({
    get title() {
      return self.metadata.title;
    },
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "Deck",`,
        `  "deckDescription": ${self.deckDescription},`,
        `}`
      ].join("\n")
    }
  }))
  .actions(self => ({
    setDescription(text: string) {
      self.deckDescription = text;
    }
  }));

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
