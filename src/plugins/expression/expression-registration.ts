import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kExpressionDefaultHeight, kExpressionTileType } from "./expression-types";
import ExpressionToolIcon from "./expression-icon.svg";
import { ExpressionToolComponent } from "./expression-tile";
import { defaultExpressionContent, ExpressionContentModel } from "./expression-content";

registerTileContentInfo({
  type: kExpressionTileType,
  modelClass: ExpressionContentModel,
  defaultContent: defaultExpressionContent,
  defaultHeight: kExpressionDefaultHeight
});

registerTileComponentInfo({
  type: kExpressionTileType,
  Component: ExpressionToolComponent,
  tileEltClass: "expression-tool-tile",
  Icon: ExpressionToolIcon
});
