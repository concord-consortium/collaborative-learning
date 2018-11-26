import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./dialog.sass";
import { UIDialogModelType } from "../models/ui";
import { onSnapshot } from "mobx-state-tree";

interface IProps extends IBaseProps {
  dialog?: UIDialogModelType;
}
interface IState {
  promptValue?: string;
}

@inject("stores")
@observer
export class DialogComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private input: HTMLInputElement | null;

  public componentDidMount() {
    window.addEventListener("keyup", this.handleWindowKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener("keyup", this.handleWindowKeyUp);
  }

  public componentDidUpdate() {
    if (this.input) {
      this.input.focus();
    }
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.setState({promptValue: nextProps.dialog && nextProps.dialog.defaultValue});
    }
  }

  public render() {
    const {dialog} = this.stores.ui;
    if (dialog) {
      const {type} = dialog;
      let title = dialog.title;
      let contents: JSX.Element;
      switch (dialog.type) {
        case "confirm":
          title = title || "Confirm";
          contents = this.renderConfirmContents(dialog);
          break;
        case "prompt":
          title = title || "Prompt";
          contents = this.renderPromptContents(dialog);
          break;
        default:
        case "alert":
          title = title || "Alert";
          contents = this.renderAlertContents(dialog);
          break;
      }

      return (
        <div className="dialog">
          <div className="dialog-background" />
          <div className="dialog-container">
            <div className="dialog-title" data-test="dialog-title">{title}</div>
            {contents}
          </div>
        </div>
      );
    }
    else {
      return null;
    }
  }

  private renderAlertContents(dialog: UIDialogModelType) {
    return (
      <div className="dialog-contents">
        <div className="dialog-text">{dialog.text}</div>
        <div className="dialog-buttons" data-test="dialog-buttons">
          <button id="okButton" onClick={this.handleCancelDialog}>Ok</button>
        </div>
      </div>
    );
  }

  private renderConfirmContents(dialog: UIDialogModelType) {
    return (
      <div className="dialog-contents">
        <div className="dialog-text">{dialog.text}</div>
        <div className="dialog-buttons" data-test="dialog-buttons">
          <button id="okButton" onClick={this.handleConfirmDialogYes}>Yes</button>
          <button id="cancelButton" onClick={this.handleConfirmDialogNo}>No</button>
        </div>
      </div>
    );
  }

  private renderPromptContents(dialog: UIDialogModelType) {
    return (
      <div className="dialog-contents">
        <div className="dialog-text">{dialog.text}</div>
        <div className="dialog-input">
          <input
            type="text"
            value={this.state.promptValue}
            onChange={this.handlePromptValueChanged}
            onKeyUp={this.handlePromptKeyUp}
            ref={(el) => this.input = el}
          />
        </div>
        <div className="dialog-buttons" data-test="dialog-buttons">
          <button id="okButton" onClick={this.handlePromptDialogOk} disabled={this.promptValue.length === 0}>Ok</button>
          <button id="cancelButton" onClick={this.handleCancelDialog}>Cancel</button>
        </div>
      </div>
    );
  }

  private handleConfirmDialogYes = (e: React.MouseEvent<HTMLButtonElement>) => {
    this.stores.ui.resolveDialog(true);
  }

  private handleConfirmDialogNo = (e: React.MouseEvent<HTMLButtonElement>) => {
    this.stores.ui.resolveDialog(false);
  }

  private handlePromptValueChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.input) {
      this.setState({promptValue: this.input.value});
    }
  }

  private handlePromptKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // listen for enter key
    if (e.keyCode === 13) {
      this.handlePromptDialogOk();
    }
  }

  private get promptValue() {
    return (this.state.promptValue || "").trim();
  }

  private handlePromptDialogOk = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const {promptValue} = this;
    if (promptValue.length > 0) {
      this.stores.ui.resolveDialog(promptValue);
    }
  }

  private handleCancelDialog = (e?: React.MouseEvent<HTMLButtonElement>) => {
    this.stores.ui.closeDialog();
  }

  private handleWindowKeyUp = (e: KeyboardEvent) => {
    // listen for escape key when dialog is visible
    if (this.stores.ui.dialog && (e.keyCode === 27)) {
      this.handleCancelDialog();
    }
  }

}
