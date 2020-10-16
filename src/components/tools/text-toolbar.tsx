import React from "react";
import ReactDOM from "react-dom";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { isMac } from "../../utilities/browser";

import "./text-toolbar.sass";

interface IButtonDef {
  iconName: string;  // Font-Awesome icon name for this button.
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps {
  portalDomElement?: HTMLElement | null;
  top?: number;
  left?: number;
  selectedButtonNames: string[];
  clickHandler: (buttonName: string, editor: any, event: React.MouseEvent) => void;
  editor: any;
  visible: boolean;  // If true, render the tool bar.
  enabled: boolean;  // If true, let user events be processed.
}

@inject("stores")
@observer
export class TextStyleBarComponent extends BaseComponent<IProps> {

  private prefix = isMac() ? "Cmd-" : "Ctrl-";

  // If there should be a need to use this component in more than one place,
  // it should be relatively straightforward to abstract the set of buttons
  // outside of the component and define the contents of the bar in the client
  // code that instantiates the TextStyleBarComponent.

  private buttonDefs: IButtonDef[] = [
    { iconName: "bold",        toolTip: `Bold (${this.prefix}b)`},
    { iconName: "italic",      toolTip: `Italic (${this.prefix}i)`},
    { iconName: "underline",   toolTip: `Underline (${this.prefix}u)`},
    { iconName: "code",        toolTip: `Typewriter Font`},
    { iconName: "subscript",   toolTip: `Subscript (${this.prefix},)`},
    { iconName: "superscript", toolTip: `Superscript (${this.prefix}Shift-,)`},
    { iconName: "list-ol",     toolTip: `Numbered List`},
    { iconName: "list-ul",     toolTip: `Bulleted List`}
  ];

  public render() {
    const { portalDomElement, top, left, enabled, visible } = this.props;
    const onMouseDownHandler = (event: React.MouseEvent) => {
      event.preventDefault();
    };
    if (portalDomElement && top && (left != null) && visible) {
      const enabledClass = enabled ? "enabled" : "";
      const style = { top, left };
      return (
        ReactDOM.createPortal(
          <div className={`text-style-bar ${enabledClass}`} style={style} onMouseDown={onMouseDownHandler}>
            {this.buttonDefs.map(button => this.renderButton(button))}
          </div>, portalDomElement)
      );
    }
    return (null);
  }

  private renderButton(buttonDef: IButtonDef) {
    const showTip = this.props.enabled ? "enabled" : "";
    const classes = (iconName: string) => {
      const { selectedButtonNames: selected } = this.props;
      const isSelected = selected.find( b => b === buttonDef.iconName );
      const classList = [ "button-icon", "fa", "fa-fw" ].join(" ");
      return (`${classList} fa-${iconName} ${isSelected ? "on" : "off" } ${showTip}`);
    };
    const clickHandler = (event: React.MouseEvent) => {
      if (this.props.enabled) {
        this.props.clickHandler(buttonDef.iconName, this.props.editor, event);
      }
    };
    return (
      <div className={`button-with-tool-tip ${showTip}`} key={buttonDef.iconName}>
        <i className={classes(buttonDef.iconName)} onClick={clickHandler} />
        <span className={`tool-tip-text ${showTip}`}>
          {buttonDef.toolTip}
        </span>
      </div>
    );
  }
}
