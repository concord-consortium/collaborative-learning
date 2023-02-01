import React, { useContext } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import { Editor, EFormat, ReactEditor, Transforms } from "@concord-consortium/slate-editor";

import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterTileApiProps } from "../tile-component";
import { getAllTextPluginInfos, getTextPluginInfo } from "../../../models/tiles/text/text-plugin-info";
import { variableBuckets } from "../../../plugins/shared-variables/shared-variables-utils";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";
import { getVariables, getOrFindSharedModel } from "../../../plugins/shared-variables/slate/variables-text-content";
import { findSelectedVariable, insertTextVariable, insertTextVariables, kVariableFormat}
  from "../../../plugins/shared-variables/slate/variables-plugin";
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
  buttonEnabled?: (args: any) => boolean; // Decides when the button should be enabled.
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
  const { documentContent, editor, selectedButtons, onIsEnabled, ...others } = props;
  const toolbarSetting = useSettingFromStores("tools", "text") as unknown as string[];
  const enabled = onIsEnabled();
  const textContent = useContext(TextContentModelContext);
  const selectedElements = editor?.selectedElements();
  const variables = getVariables(textContent);
  const hasVariable = editor?.isElementActive(kVariableFormat);
  const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;
  const sharedModel = getOrFindSharedModel(textContent);
  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";

  const plugins = getAllTextPluginInfos();
  // Build up a map from plugin => toolbar click handlers.
  // This assumes the plugin is registering a modal which is not the most generic choice.
  const pluginModalHandlers: Record<string, ()=> void> = {};
  plugins.forEach(plugin => {
    if (plugin?.modalHook) {
      const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);
      const [showDialog] = plugin.modalHook({
        variable: selectedVariable,
        textContent,
        sharedModel,
        Icon: InsertVariableCardIcon,
        addVariable: _.bind(insertTextVariable, null, _, editor),
        namePrefill: highlightedText,
        insertVariables: _.bind(insertTextVariables, null, _, editor),
        otherVariables,
        selfVariables,
        unusedVariables,
        onClose: () => editor && handleClose(editor)
      });
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
        editor.toggleMark(EFormat.bold);
        break;
      case "italic":
        editor.toggleMark(EFormat.italic);
        break;
      case "underline":
        editor.toggleMark(EFormat.underlined);
        break;
      case "subscript":
        editor.toggleSuperSubscript(EFormat.subscript);
        break;
      case "superscript":
        editor.toggleSuperSubscript(EFormat.superscript);
        break;
      case "list-ol":
        editor.toggleElement(EFormat.numberedList);
        break;
      case "list-ul":
        editor.toggleElement(EFormat.bulletedList);
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
            const { iconName, Icon, toolTip, buttonEnabled } = button;
            let bEnabled = enabled;
            if (buttonEnabled) {
              bEnabled = buttonEnabled(selectedVariable);
            }
            const isSelected = !!selectedButtons.find(b => b === iconName);
            const handleClick = (event: React.MouseEvent) => {
              if (editor && enabled) {
                handleToolBarButtonClick(iconName, event);
              }
            };
            return (
              <TextToolbarButton key={iconName} iconName={iconName} Icon={Icon} enabled={bEnabled}
                tooltip={toolTip} isSelected={isSelected} onClick={handleClick} />
            );
          })}
        </div>, documentContent)
    : null;
};
