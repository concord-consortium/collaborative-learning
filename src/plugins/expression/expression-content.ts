import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kExpressionTileType } from "./expression-types";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";

export function defaultExpressionContent(props?: IDefaultContentOptions): ExpressionContentModelType {
  return ExpressionContentModel.create({latexStr: `a=\\pi r^2`});
}

export const ExpressionContentModel = TileContentModel
  .named("ExpressionTool")
  .props({
    type: types.optional(types.literal(kExpressionTileType), kExpressionTileType),
    latexStr: "",
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions){
      const escapedLatexStr = self.latexStr.replace(/\\/g, "\\\\");
      return [
        `{`,
        `  "type": "Expression",`,
        `  "latexStr": "${escapedLatexStr}"`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => ({
    setLatexStr(text: string) {
      self.latexStr = text;
    }
  }));

export interface ExpressionContentModelType extends Instance<typeof ExpressionContentModel> {}
