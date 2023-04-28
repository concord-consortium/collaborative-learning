import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kExpressionTileType } from "./expression-types";

export function defaultExpressionContent(): ExpressionContentModelType {
  return ExpressionContentModel.create({text: "Hello World"});
}

export const ExpressionContentModel = TileContentModel
  .named("ExpressionTool")
  .props({
    type: types.optional(types.literal(kExpressionTileType), kExpressionTileType),
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

export interface ExpressionContentModelType extends Instance<typeof ExpressionContentModel> {}
