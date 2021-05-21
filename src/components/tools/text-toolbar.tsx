import React from "react";
import ReactDOM from "react-dom";
import { Editor } from "@concord-consortium/slate-editor";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "./hooks/use-floating-toolbar-location";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterToolApiProps } from "./tool-tile";
import { isMac } from "../../utilities/browser";

import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // Font-Awesome icon name for this button.
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps extends IFloatingToolbarProps, IRegisterToolApiProps {
  selectedButtons: string[];
  onButtonClick: (buttonName: string, editor: Editor, event: React.MouseEvent) => void;
  editor?: Editor;
}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const buttonDefs: IButtonDef[] = [
  { iconName: "bold",        toolTip: `Bold (${kShortcutPrefix}b)`},
  { iconName: "italic",      toolTip: `Italic (${kShortcutPrefix}i)`},
  { iconName: "underline",   toolTip: `Underline (${kShortcutPrefix}u)`},
  { iconName: "subscript",   toolTip: `Subscript`},
  { iconName: "superscript", toolTip: `Superscript`},
  { iconName: "list-ol",     toolTip: `Numbered List`},
  { iconName: "list-ul",     toolTip: `Bulleted List`}
];

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

export const TextToolbarComponent: React.FC<IProps> = (props: IProps) => {
  const { documentContent, editor, selectedButtons, onIsEnabled, onButtonClick, ...others } = props;
  const enabled = onIsEnabled();
  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            minToolContent: 22,
                            toolbarLeftOffset: -2,
                            enabled,
                            ...others
                          });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`text-toolbar ${enabled && toolbarLocation ? "enabled" : "disabled"}`}
              style={toolbarLocation} onMouseDown={handleMouseDown}>
          {buttonDefs.map(button => {
            const { iconName, toolTip } = button;
            const isSelected = !!selectedButtons.find(b => b === iconName);
            const handleClick = (event: React.MouseEvent) => {
              if (editor && enabled) {
                onButtonClick(iconName, editor, event);
              }
            };
            return (
              <TextToolbarButton key={iconName} iconName={iconName} enabled={enabled}
                tooltip={toolTip} isSelected={isSelected} onClick={handleClick} />
            );
          })}
        </div>, documentContent)
    : null;
};
