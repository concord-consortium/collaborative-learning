import { registerPlugins } from "@concord-consortium/slate-editor";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import { HighlightsPlugin, kHighlightTextPluginName } from "../../../components/tiles/text/plugins/highlights-plugin";
import { registerLinkComponent } from "../../../components/tiles/text/plugins/link-plugin";
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

registerTextPluginInfo({
  pluginName: kHighlightTextPluginName,
  createSlatePlugin: (textContent) => new HighlightsPlugin(textContent)
});

registerPlugins();

// Register link component AFTER registerPlugins() so it overrides the
// built-in registerLinkInline() from the slate-editor library.
// Note: link-plugin does not use registerTextPluginInfo because it doesn't
// need onInitEditor (links are already inline in Slate) or shared model
// change handling. It only registers a custom element renderer.
registerLinkComponent();

registerTileComponentInfo({
  type: kTextTileType,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true,
  hiddenTitle: true
});
