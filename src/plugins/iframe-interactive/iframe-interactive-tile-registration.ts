import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kIframeInteractiveTileType, kIframeInteractiveDefaultHeight } from "./iframe-interactive-tile-types";
import { IframeInteractiveComponent } from "./iframe-interactive-tile";
import { defaultIframeInteractiveContent, IframeInteractiveContentModel } from "./iframe-interactive-tile-content";

import Icon from "./iframe-interactive-tile-icon.svg";
import HeaderIcon from "./iframe-interactive-tile-id.svg";

registerTileContentInfo({
  type: kIframeInteractiveTileType,
  displayName: "Interactive",
  modelClass: IframeInteractiveContentModel,
  defaultContent: defaultIframeInteractiveContent,
  defaultHeight: kIframeInteractiveDefaultHeight
});

registerTileComponentInfo({
  type: kIframeInteractiveTileType,
  Component: IframeInteractiveComponent,
  tileEltClass: "iframe-interactive-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true
});
