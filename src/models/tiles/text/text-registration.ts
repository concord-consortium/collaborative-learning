import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kTextToolID, TextContentModel, defaultTextContent } from "./text-content";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import TextToolIcon from "../../../clue/assets/icons/text-tool.svg";

registerTileContentInfo({
  id: kTextToolID,
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});

registerTileComponentInfo({
  id: kTextToolID,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile disable-tile-content-drag",
  Icon: TextToolIcon,
  tileHandlesOwnSelection: true
});
