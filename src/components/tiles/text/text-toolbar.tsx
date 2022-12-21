import React, { useContext } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import { EFormat, toggleMark, toggleSuperSubscript, toggleBlock, Editor} from "@concord-consortium/slate-editor";

import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { useTextToolDialog } from "./text-tile-dialog";
import { IRegisterTileApiProps } from "../tile-component";
import { getAllTextPluginInfos, getTextPluginInfo } from "../../../models/tiles/text/text-plugin-info";
import { variableBuckets } from "../../../plugins/shared-variables/shared-variables-utils";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";
import { getVariables, getOrFindSharedModel } from "../../../plugins/shared-variables/slate/variables-text-content";
import { findSelectedVariable, insertTextVariable, insertTextVariables} from "../../../plugins/shared-variables/slate/variables-plugin";
import { isMac } from "../../../utilities/browser";


import BoldToolIcon from "../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../assets/icons/text/bulleted-list-text-icon.svg";
import InsertVariableCardIcon from "../../../plugins/shared-variables/assets/insert-variable-chip-icon.svg";


import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // icon name for this button.
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>; // icon for the button
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps extends IFloatingToolbarProps, IRegisterTileApiProps {
  selectedButtons: string[];
  editor?: Editor;
  textContent?: TextContentModelType,
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
  const textContent = useContext(TextContentModelContext);
  const selectedElements = editor?.selectedElements(); // FIXME: selectedElements reports the wrong return type.
  const variables = getVariables(textContent); 
  const hasVariable = editor?.isElementActive("clueVariable"); // FIXME: use const
  const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;
  const sharedModel = getOrFindSharedModel(textContent);
  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  
  const plugins = getAllTextPluginInfos();
  const pluginModalHandlers: Record<string, ()=> void> = {}; 
  plugins.forEach(plugin => {
    if (plugin?.command) {
      const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);
      // FIXME: I doubt this is the best way to do this... Each of the variable dialog modals needs a different
      // set of parameters, but I just sent them all to make this code semi-generic.
      const [showDialog] = plugin.command (
        { variable: selectedVariable,
          textContent,
          sharedModel,
          Icon: InsertVariableCardIcon,
          addVariable: _.bind(insertTextVariable, null, _, editor),
          namePrefill: highlightedText,
          insertVariables: _.bind(insertTextVariables, null, _, editor),
          otherVariables,
          selfVariables,
          unusedVariables
        }
      );
      const name = plugin.iconName;
      pluginModalHandlers[name] = showDialog;
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
        toggleMark(editor, EFormat.bold);
        break;
      case "italic":
        toggleMark(editor, EFormat.italic);
        break;
      case "underline":
        toggleMark(editor, EFormat.underlined);
        break;
      case "subscript":
        toggleSuperSubscript(editor, EFormat.subscript);
        break;
      case "superscript":
        toggleSuperSubscript(editor, EFormat.superscript);
        break;
      case "list-ol":
        toggleBlock(editor, EFormat.numberedList);
        break;
      case "list-ul":
        toggleBlock(editor, EFormat.bulletedList);
        break;
      case "undo":
        editor.undo();
        break;
      default: {
        const toolInfo = getTextPluginInfo(buttonIconName);
        // Handle Text Plugins
        if (!toolInfo || !pluginModalHandlers[toolInfo.iconName]) {
          console.warn("Can't find text plugin handler for", buttonIconName);
          break;
        }
        pluginModalHandlers[toolInfo.iconName]();
      }
    }
  };

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
