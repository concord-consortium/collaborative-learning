import React from "react";
import ReactDOM from "react-dom";
import { useFloatingToolbarLocation } from "./hooks/use-floating-toolbar-location";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterToolApiProps } from "./tool-tile";
import { isMac } from "../../utilities/browser";

import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // Font-Awesome icon name for this button.
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps extends IRegisterToolApiProps {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  selectedButtons: string[];
  onButtonClick: (buttonName: string, editor: any, event: React.MouseEvent) => void;
  editor: any;
  enabled: boolean;
}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

const buttonDefs: IButtonDef[] = [
  { iconName: "bold",        toolTip: `Bold (${kShortcutPrefix}b)`},
  { iconName: "italic",      toolTip: `Italic (${kShortcutPrefix}i)`},
  { iconName: "underline",   toolTip: `Underline (${kShortcutPrefix}u)`},
  { iconName: "subscript",   toolTip: `Subscript (${kShortcutPrefix},)`},
  { iconName: "superscript", toolTip: `Superscript (${kShortcutPrefix}Shift-,)`},
  { iconName: "list-ol",     toolTip: `Numbered List`},
  { iconName: "list-ul",     toolTip: `Bulleted List`}
];

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

export const TextToolbarComponent: React.FC<IProps> = (props: IProps) => {
  const { documentContent, enabled, editor, selectedButtons, onButtonClick, ...others } = props;
  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            minToolContent: 22,
                            toolbarLeftOffset: -2,
                            enabled,
                            ...others
                          });
  return documentContent && enabled && toolbarLocation
    ? ReactDOM.createPortal(
        <div className={`text-toolbar ${enabled ? "enabled" : ""}`}
              style={toolbarLocation} onMouseDown={handleMouseDown}>
          {buttonDefs.map(button => {
            const { iconName, toolTip } = button;
            const isSelected = !!selectedButtons.find(b => b === iconName);
            const handleClick = (event: React.MouseEvent) => {
              if (enabled) {
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
