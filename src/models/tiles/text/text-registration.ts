import { createEditor } from "@concord-consortium/slate-editor";
import TextToolComponent from "../../../components/tiles/text/text-tile";
import { HighlightsPlugin, kHighlightTextPluginName } from "../../../plugins/text/highlights-plugin";
import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kTextTileType, TextContentModel, defaultTextContent } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";

import Icon from "../../../clue/assets/icons/text-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/text-tile-id.svg";

// slate-editor v0.12 dropped the public registerPlugins() helper. The built-in
// element components and mark renderers are now registered as side effects of
// createEditor() (via withCoreMarks/withCoreBlocks/etc.). We invoke it once at
// module load so paths like slateToHtml() that don't go through SlateEditor
// still find the renderers registered.
createEditor();
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

registerTileComponentInfo({
  type: kTextTileType,
  Component: TextToolComponent,
  tileEltClass: "text-tool-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true,
  hiddenTitle: true
});
