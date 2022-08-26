import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { Editor, EFormat, handleToggleSuperSubscript } from "@concord-consortium/slate-editor";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "./hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterToolApiProps } from "./tool-tile";
// TODO: This should be exported by slate-editor, and we should import it from there. 
// Currently it is not listed as a direct dependency of CLUE.
import EventEmitter from "eventemitter3";

import { isMac } from "../../utilities/browser";
import BoldToolIcon from "../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../assets/icons/text/bulleted-list-text-icon.svg";
import { useTextToolDialog } from "./text-tool-dialog";
import { getTextPluginInfo } from "../../models/tools/text/text-plugin-info";

import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // icon name for this button.
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>; // icon for the button
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps extends IFloatingToolbarProps, IRegisterToolApiProps {
  selectedButtons: string[];
  editor?: Editor;
}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const buttonDefs: IButtonDef[] = [
  { iconName: "bold",        Icon: BoldToolIcon,          toolTip: `Bold (${kShortcutPrefix}b)`},
  { iconName: "italic",      Icon: ItalicToolIcon,        toolTip: `Italic (${kShortcutPrefix}i)`},
  { iconName: "underline",   Icon: UnderlineToolIcon,     toolTip: `Underline (${kShortcutPrefix}u)`},
  { iconName: "subscript",   Icon: SubscriptToolIcon,     toolTip: `Subscript`},
  { iconName: "superscript", Icon: SuperscriptToolIcon,   toolTip: `Superscript`},
  { iconName: "list-ol",     Icon: NumberedListToolIcon,  toolTip: `Numbered List`},
  { iconName: "list-ul",     Icon: BulletedListToolIcon,  toolTip: `Bulleted List`},
];

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

export const TextToolbarComponent: React.FC<IProps> = (props: IProps) => {
  const { documentContent, editor, selectedButtons, onIsEnabled, ...others } = props;
  const toolbarSetting = useSettingFromStores("tools", "text") as unknown as string[];
  const enabled = onIsEnabled();
  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            minToolContent: 22,
                            toolbarTopOffset: 2,
                            enabled,
                            ...others
                          });
  const dialogController = useTextToolDialog({editor});
  let toolbarButtons: IButtonDef[] = [];
  if (toolbarSetting) {
    toolbarSetting.forEach( setting => {
      const builtInButton = buttonDefs.find(b => b.iconName === setting);
      if (builtInButton) {
        toolbarButtons.push(builtInButton);
        return;
      }
      const pluginButton = getTextPluginInfo(setting);
      if (pluginButton) {
        toolbarButtons.push(pluginButton);
      }
    });
  } else {
    toolbarButtons = buttonDefs;
  }

  const handleToolBarButtonClick = (buttonIconName: string, event: React.MouseEvent) => {
    event.preventDefault();

    if (!editor) {
      // In theory the editor can be undefined. Cut that option off
      // here so we don't need to worry about it below
      return;
    }

    switch (buttonIconName) {
      case "bold":
        editor.command("toggleMark", EFormat.bold);
        break;
      case "italic":
        editor.command("toggleMark", EFormat.italic);
        break;
      case "underline":
        editor.command("toggleMark", EFormat.underlined);
        break;
      case "subscript":
        handleToggleSuperSubscript(EFormat.subscript, editor);
        break;
      case "superscript":
        handleToggleSuperSubscript(EFormat.superscript, editor);
        break;
      case "list-ol":
        editor.command("toggleBlock", EFormat.numberedList);
        break;
      case "list-ul":
        editor.command("toggleBlock", EFormat.bulletedList);
        break;
      case "undo":
        editor.undo();
        break;
      default: {
        const toolInfo = getTextPluginInfo(buttonIconName);

        // Handle Text Plugins
        if (!toolInfo?.command) {
          console.warn("Can't find text plugin command for", buttonIconName);
          break;
        }
        // Send the dialogController to all plugins 
        //
        // TODO: I think this should be an object: `{dialogController}`
        // instead of a raw param. This way we can add more props to it
        // without changing the method signature and worrying about argument
        // order. The reason is that I hope we can provide additional
        // controllers or services that plugins can use. This change should be
        // made in slate-editor too for consistency. 
        editor.command(toolInfo?.command, dialogController);          
      }
    }
  };
  
  // listen for configuration requests from plugins
  useEffect(() => {
    const emitter: EventEmitter | undefined = editor?.query("emitter");
    const handler = (event: string, ...args: any) => {
      editor?.command(event, dialogController, ...args);
    };
    emitter?.on("toolbarDialog", handler);
    return () => {
      emitter?.off("toolbarDialog", handler);
    };
  }, [editor, dialogController]);
  
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`text-toolbar ${enabled && toolbarLocation ? "enabled" : "disabled"}`}
              style={toolbarLocation} onMouseDown={handleMouseDown}>
          {toolbarButtons.map(button => {
            const { iconName, Icon, toolTip } = button;
            const isSelected = !!selectedButtons.find(b => b === iconName);
            const handleClick = (event: React.MouseEvent) => {
              if (editor && enabled) {
                handleToolBarButtonClick(iconName, event);
              }
            };
            return (
              <TextToolbarButton key={iconName} iconName={iconName} Icon={Icon} enabled={enabled}
                tooltip={toolTip} isSelected={isSelected} onClick={handleClick} />
            );
          })}
        </div>, documentContent)
    : null;
};
