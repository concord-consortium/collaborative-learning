import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kTextTileType, TextContentModel, defaultTextContent } from "./text-content";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import { registerPlugins } from "@concord-consortium/slate-editor";
import TextToolIcon from "../../../clue/assets/icons/text-tool.svg";

registerTileContentInfo({
  type: kTextTileType,
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});

registerPlugins();

registerTileComponentInfo({
  type: kTextTileType,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile disable-tile-content-drag",
  Icon: TextToolIcon,
  tileHandlesOwnSelection: true
});
