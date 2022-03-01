import React from "react";
import ReactDOM from "react-dom";
import { Editor } from "@concord-consortium/slate-editor";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "./hooks/use-floating-toolbar-location";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterToolApiProps } from "./tool-tile";
import { isMac } from "../../utilities/browser";
import BoldToolIcon from "../../assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../assets/icons/text/bulleted-list-text-icon.svg";

import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // icon name for this button.
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>; // icon for the button
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps extends IFloatingToolbarProps, IRegisterToolApiProps {
  selectedButtons: string[];
  onButtonClick: (buttonName: string, editor: Editor, event: React.MouseEvent) => void;
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
  { iconName: "list-ul",     Icon: BulletedListToolIcon,  toolTip: `Bulleted List`}
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
                            toolbarTopOffset: 2,
                            enabled,
                            ...others
                          });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`text-toolbar ${enabled && toolbarLocation ? "enabled" : "disabled"}`}
              style={toolbarLocation} onMouseDown={handleMouseDown}>
          {buttonDefs.map(button => {
            const { iconName, Icon, toolTip } = button;
            const isSelected = !!selectedButtons.find(b => b === iconName);
            const handleClick = (event: React.MouseEvent) => {
              if (editor && enabled) {
                onButtonClick(iconName, editor, event);
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
