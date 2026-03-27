import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kTimelineDefaultHeight, kTimelineTileType } from "./timeline-types";
import { TimelineComponent } from "./components/timeline-tile";
import { defaultTimelineContent, TimelineContentModel } from "./models/timeline-content";

import Icon from "./assets/timeline-icon.svg";
import HeaderIcon from "./assets/timeline-tile-id.svg";

registerTileContentInfo({
  type: kTimelineTileType,
  displayName: "Timeline",
  modelClass: TimelineContentModel,
  defaultContent: defaultTimelineContent,
  defaultHeight: kTimelineDefaultHeight
});

registerTileComponentInfo({
  type: kTimelineTileType,
  Component: TimelineComponent,
  tileEltClass: "timeline-tool-tile",
  Icon,
  HeaderIcon
});
