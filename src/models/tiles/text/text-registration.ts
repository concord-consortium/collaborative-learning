import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kTextTileType, TextContentModel, defaultTextContent } from "./text-content";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import { registerPlugins } from "@concord-consortium/slate-editor";

import Icon from "../../../clue/assets/icons/text-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/text-tile-id.svg";

registerTileContentInfo({
  type: kTextTileType,
  displayName: "Text",
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});

registerPlugins();

registerTileComponentInfo({
  type: kTextTileType,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true
});
