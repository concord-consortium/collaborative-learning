import React, { useEffect, useContext } from "react";
import ReactDOM from "react-dom";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { useTextToolDialog } from "./text-tile-dialog";
import { IRegisterTileApiProps } from "../tile-component";
import { getTextPluginInfo } from "../../../models/tiles/text/text-plugin-info";
import { EFormat, toggleMark, toggleSuperSubscript, toggleBlock, Editor, BaseElement, useSelected, CustomElement, Transforms } from "@concord-consortium/slate-editor";

import { isMac } from "../../../utilities/browser";
import BoldToolIcon from "../../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../../assets/icons/text/bulleted-list-text-icon.svg";

import "./text-toolbar.sass";
import { variableBuckets } from "../../../plugins/shared-variables/shared-variables-utils";
import { useEditVariableDialog } from "../../../plugins/shared-variables/dialog/use-edit-variable-dialog";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";
import { getVariables, getOrFindSharedModel } from "../../../plugins/shared-variables/slate/variables-text-content";
import { isVariableElement, VariableElement } from "../../../plugins/shared-variables/slate/variables-plugin";
import { useNewVariableDialog } from "../../../plugins/shared-variables/dialog/use-new-variable-dialog";
import { SharedVariablesType } from "../../../plugins/shared-variables/shared-variables";
import InsertVariableCardIcon from "../../../plugins/shared-variables/assets/insert-variable-chip-icon.svg";


import { VariableType } from "@concord-consortium/diagram-view";
import { useInsertVariableDialog } from "../../../plugins/shared-variables/dialog/use-insert-variable-dialog";
//import { useEditVariableDialog } from "./plugins/shared-variables/dialog/use-edit-variable-dialog";
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
  const selectedElements = editor?.selectedElements();
  //const slateSelection = useSelected();
 
  const variables = getVariables(textContent); 
  const hasVariable = editor?.isElementActive("clueVariable"); // FIXME: use const
  let selectedVariable = undefined;
  // FIXME: Move some of this code around. It probably doesn't belong here.
  if (hasVariable) {
    // FIXME: What if multiple variables are selected?. This just picks one...
    //    PRobably the button should be disabled unless exactly 1 is selected? 
    // FIXME: This function says it returns a BaseElement[] but for some reason
    // it returns a list of arrays where the first element in each one is
    // as BaseElement. 
    // Ah hah, I think what it realy returns is a NodeEntry: 
    // https://docs.slatejs.org/api/nodes/node-entry
    // There's some weirdness below to work around that, but
    // we should either update the return type our slate lib or just return the BaseElement list.
    selectedElements?.forEach((selectedItem) => {
      const baseElement = (selectedItem as any)[0];
      if (isVariableElement(baseElement)) {
        const {reference} = baseElement;
        selectedVariable = variables.find(v => v.id === reference);
      }
    });
  
  };
  const [showEditVariableDialog] = useEditVariableDialog (
    { variable: selectedVariable }
  );

  
  // MOVE ME: probably doesn't belong in the toolbar?
  const insertVariable = (variable: VariableType) => { 
    if (!editor) {
      console.warn("inserting variable but there is no editor");
      return;
    }
    const reference = variable.id;
    const varElt: VariableElement = { type: "clueVariable", reference, children: [{text: "" }]};
    Transforms.insertNodes(editor, varElt);
  };

  const insertVariables = (variables: VariableType[]) => { 
    if (!editor) {
      console.warn("inserting variable but there is no editor");
      return;
    }
    variables.forEach((variable) =>{
      insertVariable(variable);
   })
  };
  const sharedModel = getOrFindSharedModel(textContent);
  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  //console.log("highlight: " + highlightedText);
  const [showNewVariableDialog] =
    useNewVariableDialog(
      { addVariable: insertVariable,
        sharedModel: sharedModel as SharedVariablesType,
        namePrefill: highlightedText // FIXME: this isn't working
      });
  
  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);
  const [showInsertVariableDialog] = useInsertVariableDialog({
    disallowSelf: true,
    Icon: InsertVariableCardIcon,
    insertVariables,
    otherVariables,
    selfVariables,
    unusedVariables
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
        if (!toolInfo?.command) {
          console.warn("Can't find text plugin command for", buttonIconName);
          break;
        }
        if (toolInfo.command === 'edit-text-variable') {
          // FIXME: Change the toolInfo api to be this function instead
          // or somehow get rid of this weird if statement. 
          console.log('edt text variable');
          showEditVariableDialog();
          break;
        } else if (toolInfo.command === 'new-text-variable') {
          showNewVariableDialog();
          console.log('new text variable');
          break;
        } else if (toolInfo.command === 'insert-text-variable') {
          console.log('insert variable');
          showInsertVariableDialog();
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
        editor.configureElement(toolInfo?.command, dialogController);
      }
    }
  };

  // listen for configuration requests from plugins
  useEffect(() => {
    const handler = (event: BaseElement, ...args: any) => {
      editor?.configureElement("clueVariable", dialogController, event);
    };
    editor?.onEvent("configureVariable", handler);
    return () => {
      editor?.offEvent("configureVariable", handler);
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
