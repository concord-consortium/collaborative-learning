import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kExpressionTileType } from "./expression-types";
import { getTileModel, setTileTitleFromContent } from "../../models/tiles/tile-model";
import { uniqueId, uniqueTitle } from "../../utilities/js-utils";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";

export function defaultExpressionContent(props?: IDefaultContentOptions): ExpressionContentModelType {
  const content = ExpressionContentModel.create({text: "Math Expression"});
  props?.title && content.setTitle(props.title);
  return content;
}

export const ExpressionContentModel = TileContentModel
  .named("ExpressionTool")
  .props({
    type: types.optional(types.literal(kExpressionTileType), kExpressionTileType),
    text: "",
  })
  .views(self => ({
    get title(): string | undefined {
      return getTileModel(self)?.title;
    },
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    setText(text: string) {
      self.text = text;
    }
  }));

export interface ExpressionContentModelType extends Instance<typeof ExpressionContentModel> {}
