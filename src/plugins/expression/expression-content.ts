import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kExpressionTileType } from "./expression-types";
import { getTileModel, setTileTitleFromContent } from "../../models/tiles/tile-model";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";

export function defaultExpressionContent(props?: IDefaultContentOptions): ExpressionContentModelType {
  const content = ExpressionContentModel.create({latexStr: `a=\\pi r^2`});
  props?.title && content.setTitle(props.title);
  return content;
}

export const ExpressionContentModel = TileContentModel
  .named("ExpressionTool")
  .props({
    type: types.optional(types.literal(kExpressionTileType), kExpressionTileType),
    latexStr: "",
  })
  .views(self => ({
    get title(): string | undefined {
      return getTileModel(self)?.title;
    },
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "Expression Tile"`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    setLatexStr(text: string) {
      self.latexStr = text;
    }
  }));

export interface ExpressionContentModelType extends Instance<typeof ExpressionContentModel> {}
