import React, { FunctionComponent, SVGProps } from "react";
import ReactDOM from "react-dom";
import { Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";

import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterTileApiProps } from "../tile-component";
import { ButtonDefComponent, getAllTextPluginInfos, ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { TextContentModelType } from "../../../models/tiles/text/text-content";

import { isMac } from "../../../utilities/browser";

import BoldToolIcon from "../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../assets/icons/text/bulleted-list-text-icon.svg";


import "./text-toolbar.sass";

interface IButtonDef {
  pluginName: string,
  component: ButtonDefComponent
}

interface IProps extends IFloatingToolbarProps, IRegisterTileApiProps {
  editor?: Editor;
  // TODO: The next two fields could be replaced by context lookups, should they?
  textContent?: TextContentModelType,
  pluginInstances: Record<string, ITextPlugin>,
  valueRevision: number;
}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const buttonDefs = new Map<string, IButtonDef>();

/**
 *  Configure a built in button. The short name is so the full config fits on one line.
 */
function bi(
  iconName: string,
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>,
  slateType: EFormat,
  toggleFunc: (editor: Editor, format: EFormat) => void,
  toolTip: string
) {
  buttonDefs.set(iconName, {
    pluginName: "built-in",
    component({editor}) {
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

bi("bold",        BoldToolIcon,         EFormat.bold,         toggleMark,    `Bold (${kShortcutPrefix}b)`);
bi("italic",      ItalicToolIcon,       EFormat.italic,       toggleMark,    `Italic (${kShortcutPrefix}i)`);
bi("underline",   UnderlineToolIcon,    EFormat.underlined,   toggleMark,    `Underline (${kShortcutPrefix}u)`);
bi("subscript",   SubscriptToolIcon,    EFormat.subscript,    toggleSupSub,  `Subscript`);
bi("superscript", SuperscriptToolIcon,  EFormat.superscript,  toggleSupSub,  `Superscript`);
bi("list-ol",     NumberedListToolIcon, EFormat.numberedList, toggleElement, `Numbered List`);
bi("list-ul",     BulletedListToolIcon, EFormat.bulletedList, toggleElement, `Bulleted List`);

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

// FIXME: need to call this when dialogs are closed, easiest way to do that
// I think is to move it to variables/text-buttons
function handleClose(editor: Editor) {
  // focus the editor after closing the dialog, which is what the user expects and
  // also required for certain slate selection synchronization mechanisms to work.
  // focusing twice shouldn't be necessary, but sometimes seems to help ¯\_(ツ)_/¯
  Transforms.move(editor, { distance: 1, unit: "word" });
  ReactEditor.focus(editor);
  setTimeout(() => {
    ReactEditor.focus(editor);
  }, 10);
}

export const TextToolbarComponent: React.FC<IProps> = (props: IProps) => {
  const { documentContent, editor, pluginInstances, onIsEnabled, valueRevision, ...others } = props;
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
        buttonDefs.set(iconName, {pluginName: plugin.pluginName, component: pluginButtonDefComponent});
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
              const ToolbarButton = buttonDef.component;
              const pluginInstance = pluginInstances[buttonDef.pluginName];
              return <ToolbarButton key={iconName} editor={editor}
                pluginInstance={pluginInstance} valueRevision={valueRevision}/>;
            })
          }
        </div>, documentContent)
    : null;
};

