import React, { useContext } from "react";
import ReactDOM from "react-dom";
import { Editor, EFormat, useSlate } from "@concord-consortium/slate-editor";

import { TextToolbarButton } from "./text-toolbar-button";
import { LinkButton } from "./link-button";
import { TextPluginsContext } from "../text-plugins-context";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../../hooks/use-floating-toolbar-location";
import { IRegisterTileApiProps } from "../../tile-component";
import { useSettingFromStores } from "../../../../hooks/use-stores";
import { ButtonDefComponent, getAllTextPluginInfos } from "../../../../models/tiles/text/text-plugin-info";
import { isMac } from "../../../../utilities/browser";

import BoldToolIcon from "../../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../../assets/icons/text/bulleted-list-text-icon.svg";

import "./text-toolbar.sass";

interface IButtonDef {
  pluginName: string,
  ButtonComponent: ButtonDefComponent
}

interface IProps extends IFloatingToolbarProps, IRegisterTileApiProps {}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const buttonDefs = new Map<string, IButtonDef>();

/**
 *  Configure a built in button. The short name is so the full config fits on one line.
 */
function btn(
  iconName: string,
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>,
  slateType: EFormat,
  toggleFunc: (editor: Editor, format: EFormat) => void,
  toolTip: string
) {
  buttonDefs.set(iconName, {
    pluginName: "built-in",
    ButtonComponent() {
      const editor = useSlate();
      const isSelected = editor.isMarkActive(slateType) || editor.isElementActive(slateType);
      const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        toggleFunc(editor, slateType);
      };
      // Built in buttons are always enabled
      return <TextToolbarButton iconName={iconName} Icon={Icon} enabled={true}
              tooltip={toolTip} isSelected={isSelected} onClick={handleClick} />;
    }
  });
}

const toggleMark =
  (editor: Editor, format: EFormat) => editor.toggleMark(format);
const toggleSupSub =
  (editor: Editor, format: EFormat) => editor.toggleSuperSubscript(format as EFormat.subscript | EFormat.superscript);
const toggleElement =
  (editor: Editor, format: EFormat) => editor.toggleElement(format);

btn("bold",        BoldToolIcon,         EFormat.bold,         toggleMark,    `Bold (${kShortcutPrefix}b)`);
btn("italic",      ItalicToolIcon,       EFormat.italic,       toggleMark,    `Italic (${kShortcutPrefix}i)`);
btn("underline",   UnderlineToolIcon,    EFormat.underlined,   toggleMark,    `Underline (${kShortcutPrefix}u)`);
btn("subscript",   SubscriptToolIcon,    EFormat.subscript,    toggleSupSub,  `Subscript`);
btn("superscript", SuperscriptToolIcon,  EFormat.superscript,  toggleSupSub,  `Superscript`);
btn("list-ol",     NumberedListToolIcon, EFormat.numberedList, toggleElement, `Numbered List`);
btn("list-ul",     BulletedListToolIcon, EFormat.bulletedList, toggleElement, `Bulleted List`);

buttonDefs.set("link", {
  pluginName: "built-in",
  ButtonComponent: LinkButton
});

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

export const TextToolbarComponent: React.FC<IProps> = (props: IProps) => {
  const { documentContent, onIsEnabled, ...others } = props;
  const editor = useSlate();
  const pluginInstances = useContext(TextPluginsContext);
  const toolbarSetting = useSettingFromStores("tools", "text") as unknown as string[];
  const enabled = onIsEnabled();

  const plugins = getAllTextPluginInfos();
  plugins.forEach(plugin => {

    if (!plugin) {
      return;
    }

    for (const [iconName, pluginButtonDefComponent] of Object.entries(plugin.buttonDefs)) {
      // only add this plugin button def if there isn't one there already
      // buttonDefs is a global so every toolbar component will share this
      if (!buttonDefs.has(iconName)) {
        buttonDefs.set(iconName, { pluginName: plugin.pluginName, ButtonComponent: pluginButtonDefComponent });
      }
    }
  });

  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            minToolContent: 22,
                            toolbarTopOffset: 2,
                            enabled,
                            ...others
                          });
  let toolbarButtons = new Map<string, IButtonDef>();
  if (toolbarSetting) {
    toolbarSetting.forEach( setting => {
      const buttonDef = buttonDefs.get(setting);
      if (buttonDef) {
        toolbarButtons.set(setting, buttonDef);
      } else {
        console.error(`Cannot find buttonDef for ${setting}`);
      }
    });
  } else {
    toolbarButtons = buttonDefs;
  }

  if (!editor) {
    console.warn("editor not defined");
    return null;
  }

  return documentContent
    ? ReactDOM.createPortal(
        <div className={`text-toolbar ${enabled && toolbarLocation ? "enabled" : "disabled"}`}
              style={toolbarLocation} onMouseDown={handleMouseDown}>
          { Array.from(toolbarButtons, ([iconName, buttonDef]) => {
              const ToolbarButton = buttonDef.ButtonComponent;
              const pluginInstance = pluginInstances[buttonDef.pluginName];
              return <ToolbarButton key={iconName} pluginInstance={pluginInstance} />;
            })
          }
        </div>, documentContent)
    : null;
};
