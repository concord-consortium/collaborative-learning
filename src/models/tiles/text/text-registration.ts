import { registerToolComponentInfo } from "../tile-component-info";
import { registerToolContentInfo } from "../tile-content-info";
import { kTextToolID, TextContentModel, defaultTextContent } from "./text-content";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import TextToolIcon from "../../../clue/assets/icons/text-tool.svg";

registerToolContentInfo({
  id: kTextToolID,
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});

registerToolComponentInfo({
  id: kTextToolID,
  Component: TextToolComponent,
  toolTileClass: "text-tool-tile disable-tile-content-drag",
  Icon: TextToolIcon,
  tileHandlesOwnSelection: true
});
