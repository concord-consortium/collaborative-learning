import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kInteractiveApiTileType, kInteractiveApiDefaultHeight } from "./interactive-api-tile-types";
import { InteractiveApiComponent } from "./interactive-api-tile";
import { defaultInteractiveApiContent, InteractiveApiContentModel } from "./interactive-api-tile-content";

import Icon from "./interactive-api-tile-icon.svg";
import HeaderIcon from "./interactive-api-tile-id.svg";

registerTileContentInfo({
  type: kInteractiveApiTileType,
  displayName: "Interactive",
  modelClass: InteractiveApiContentModel,
  defaultContent: defaultInteractiveApiContent,
  defaultHeight: kInteractiveApiDefaultHeight
});

registerTileComponentInfo({
  type: kInteractiveApiTileType,
  Component: InteractiveApiComponent,
  tileEltClass: "interactive-api-tile",
  Icon,
  HeaderIcon
});
