import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kExpressionTileType } from "./expression-types";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";
import { getTileIdFromContent } from "../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";

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
      // ignore options?.forHash option - return default export when hashing
      return JSON.stringify(getSnapshot(self), null, 2);
    }
  }))
  .actions(self => ({
    setLatexStr(text: string) {
      self.latexStr = text;
      logTileChangeEvent(LogEventName.EXPRESSION_TOOL_CHANGE, {
        tileId: getTileIdFromContent(self) ?? "",
        operation: "update",
        change: { latexStr: text }
      });
    }
  }));

export interface ExpressionContentModelType extends Instance<typeof ExpressionContentModel> {}
