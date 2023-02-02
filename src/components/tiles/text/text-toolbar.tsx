import React, { FunctionComponent, SVGProps } from "react";
import ReactDOM from "react-dom";
import { EFormat, Editor } from "@concord-consortium/slate-editor";

import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { TextToolbarButton } from "./text-toolbar-button";
import { IRegisterTileApiProps } from "../tile-component";
import { ButtonDefComponent, getAllTextPluginInfos } from "../../../models/tiles/text/text-plugin-info";
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

interface IProps extends IFloatingToolbarProps, IRegisterTileApiProps {
  editor?: Editor;
  textContent?: TextContentModelType,
  // TODO: Need a type for pluginInstances
  pluginInstances: Record<string, any>,
  valueRevision: number;
}

interface IButtonDef {
  pluginName?: string,
  component: ButtonDefComponent
}

const kShortcutPrefix = isMac() ? "Cmd-" : "Ctrl-";

// These are the built in tool definitions
const buttonDefs = new Map<string, IButtonDef>([
  [ "bold", {
    component: props => <BuiltInToolbarButton
      iconName="bold"
      Icon={BoldToolIcon}
      toolTip={`Bold (${kShortcutPrefix}b)`}
      slateType={EFormat.bold}
      command={() => props.editor.toggleMark(EFormat.bold) }
      {...props}
      />
    }],
  [ "italic", {
    component: props => <BuiltInToolbarButton
      iconName="italic"
      Icon={ItalicToolIcon}
      toolTip={`Italic (${kShortcutPrefix}i)`}
      slateType={EFormat.italic}
      command={() => props.editor.toggleMark(EFormat.italic) }
      {...props}
      />
    }],
  [ "underline", {
    component: props => <BuiltInToolbarButton
      iconName="underline"
      Icon={UnderlineToolIcon}
      toolTip={`Underline (${kShortcutPrefix}u)`}
      slateType={EFormat.underlined}
      command={() => props.editor.toggleMark(EFormat.underlined) }
      {...props}
      />
    }],
  [ "subscript", {
    component: props => <BuiltInToolbarButton
      iconName="subscript"
      Icon={SubscriptToolIcon}
      toolTip={`Subscript`}
      slateType={EFormat.subscript}
      command={() => props.editor.toggleSuperSubscript(EFormat.subscript) }
      {...props}
      />
    }],
  [ "superscript", {
    component: props => <BuiltInToolbarButton
      iconName="superscript"
      Icon={SuperscriptToolIcon}
      toolTip={`Superscript`}
      slateType={EFormat.superscript}
      command={() => props.editor.toggleSuperSubscript(EFormat.superscript) }
      {...props}
      />
    }],
  [ "list-ol", {
    component: props => <BuiltInToolbarButton
      iconName="list-ol"
      Icon={NumberedListToolIcon}
      toolTip={`Numbered List`}
      slateType={EFormat.numberedList}
      command={() => props.editor.toggleElement(EFormat.numberedList) }
      {...props}
      />
    }],
  ["list-ul", {
    component: props => <BuiltInToolbarButton
      iconName="list-ul"
      Icon={BulletedListToolIcon}
      toolTip={`Bulleted List`}
      slateType={EFormat.bulletedList}
      command={() => props.editor.toggleElement(EFormat.bulletedList) }
      {...props}
      />
    }],
]);

const handleMouseDown = (event: React.MouseEvent) => {
  event.preventDefault();
};

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
      // buttonDefs is a global so each toolbar component will share this
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
          {Array.from(toolbarButtons, ([iconName, buttonDef]) => {
            const ToolbarButton = buttonDef.component;
            // TODO: make pluginName required for buttonDefs
            // This would come after the refactor of the default buttons
            const pluginInstance = buttonDef.pluginName && pluginInstances[buttonDef.pluginName];
            return <ToolbarButton key={iconName} editor={editor}
              pluginInstance={pluginInstance} valueRevision={valueRevision}/>;
          })}
        </div>, documentContent)
    : null;
};

interface IBuiltInToolbarButtonProps {
  iconName: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  toolTip: string;
  slateType: string;
  command: () => void;
  editor: Editor;
  valueRevision: number;
}

const BuiltInToolbarButton: React.FC<IBuiltInToolbarButtonProps> = ({
  iconName, Icon, toolTip, slateType, command, editor
}: IBuiltInToolbarButtonProps) => {
  const isSelected =
    editor.isMarkActive(slateType as EFormat) ||
    editor.isElementActive(slateType as EFormat);
  const handleClick = (event: React.MouseEvent) => {
      event.preventDefault();
      command();
  };
  // Built in buttons are always enabled
  return <TextToolbarButton iconName={iconName} Icon={Icon} enabled={true}
           tooltip={toolTip} isSelected={isSelected} onClick={handleClick} />;
};
