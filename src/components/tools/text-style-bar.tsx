import * as React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../base";
import { isMac } from "../../utilities/browser";

import "./text-style-bar.sass";

interface IButtonDef {
  iconName: string;  // Font-Awesome icon name for this button.
  toolTip: string;   // Text for the button's tool-tip.
}

interface IProps {
  selectedButtonNames: string[];
  clickHandler: (buttonName: string, editor: any, event: React.MouseEvent) => void;
  editor: any;
  visible: boolean;  // If true, render the tool bar.
  enabled: boolean;  // If true, let user events be processed.
}

// This component renders HTML for a vertical tool-bar used to style text in
// a text-tool-editor. What follows is a pseudo-markup-outline for the various
// HTML-tags & CSS-class names.
//
// <div text-style-bar>
//   <div bar-header-icon>
//     <svg header-icon />
//   </div>
//   <div button-with-tool-tip >  // This div is repeated for each button.
//     <i button-icon fa fa-fw (on | off) [fa-bold, fa-italic, ..., fa-undo] />
//     <span tool-tip-text />
//   </div>
//   ...
// </div>

@inject("stores")
@observer
export class TextStyleBarComponent extends BaseComponent<IProps, {}> {

  private prefix = isMac() ? "Cmd-" : "Ctrl-";

  private buttonDefs: IButtonDef[] = [
    { iconName: "bold",        toolTip: `Bold - ${this.prefix}b`},
    { iconName: "italic",      toolTip: `Italic - ${this.prefix}i`},
    { iconName: "underline",   toolTip: `Underline - ${this.prefix}u`},
    { iconName: "code",        toolTip: `Typewriter Font`},
    { iconName: "subscript",   toolTip: `Subscript - ${this.prefix},`},
    { iconName: "superscript", toolTip: `Superscript - ${this.prefix}Shift-,`},
    { iconName: "list-ol",     toolTip: `Numbered Item`},
    { iconName: "list-ul",     toolTip: `Bullet Item`},
    { iconName: "undo",        toolTip: `Undo - ${this.prefix}z` }
  ];

  public render() {
    const onMouseDownHandler = (event: React.MouseEvent) => {
      event.preventDefault();
    };
    if (this.props.visible) {
      const enabledClass = this.props.enabled ? "enabled" : "";
      return (
        <div className={`text-style-bar ${enabledClass}`}
             onMouseDown={onMouseDownHandler}>
          {this.renderHeaderIcon()}
          {this.buttonDefs.map(bDef => this.renderButton(bDef))}
        </div>
      );
    }
    return (null);
  }

  private renderHeaderIcon() {
    return (
      <div className={"bar-header-icon"}>
        <svg className="header-icon" viewBox="10 10 150 150">
          <use xlinkHref="#icon-text-tool"/>
        </svg>
      </div>
    );
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
          {buttonDef.toolTip}>
        </span>
      </div>
    );
  }
}
