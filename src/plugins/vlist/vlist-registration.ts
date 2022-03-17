import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kVListDefaultHeight, kVListToolID } from "./vlist-types";
import VListToolIcon from "./vlist-icon.svg";
import { VListToolComponent } from "./vlist-tool";
import { defaultVListContent, VListContentModel } from "./vlist-content";

registerToolContentInfo({
  id: kVListToolID,
  modelClass: VListContentModel,
  defaultContent: defaultVListContent,
  Component: VListToolComponent,
  defaultHeight: kVListDefaultHeight,
  toolTileClass: "vlist-tool-tile",
  Icon: VListToolIcon
});
