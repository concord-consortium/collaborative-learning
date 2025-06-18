import { registerPlugins } from "@concord-consortium/slate-editor";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import { HighlightsPlugin, kHighlightTextPluginName } from "../../../plugins/text/highlights-plugin";
import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kTextTileType, TextContentModel, defaultTextContent } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";

import Icon from "../../../clue/assets/icons/text-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/text-tile-id.svg";

registerTileContentInfo({
  type: kTextTileType,
  displayName: "Text",
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});

registerPlugins();

registerTextPluginInfo({
  pluginName: kHighlightTextPluginName,
  createSlatePlugin: (textContent) => new HighlightsPlugin(textContent)
});

registerTileComponentInfo({
  type: kTextTileType,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true
});
