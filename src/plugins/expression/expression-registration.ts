import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kExpressionDefaultHeight, kExpressionTileType } from "./expression-types";
import { ExpressionToolComponent } from "./expression-tile";
import { defaultExpressionContent, ExpressionContentModel } from "./expression-content";

import Icon from "./assets/expression-icon.svg";
import HeaderIcon from "./assets/expression-tile-id.svg";

registerTileContentInfo({
  type: kExpressionTileType,
  modelClass: ExpressionContentModel,
  displayName: "Expression",
  titleBase: "Eq.",
  defaultContent: defaultExpressionContent,
  defaultHeight: kExpressionDefaultHeight
});

registerTileComponentInfo({
  type: kExpressionTileType,
  Component: ExpressionToolComponent,
  tileEltClass: "expression-tool-tile",
  Icon,
  HeaderIcon
});
