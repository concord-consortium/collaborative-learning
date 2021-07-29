import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { UIDialogModelType } from "../../models/stores/ui";

import "./dialog.sass";

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
  private input: HTMLInputElement | HTMLTextAreaElement | null;

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

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
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
        case "welcome":
          title = title || "Welcome to Dataflow";
          contents = this.renderWelcomeContents(dialog);
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

  private renderWelcomeContents(dialog: UIDialogModelType) {
    const welcome1 = "This is a limited version of Dataflow for demonstration purposes.";
    const welcome2 = "Dataflow allows you to collect data from real-world sensors and create programs to process and store that data. You can also write programs to control real-world devices, such as relays.";
    const welcome3 = "Dataflow programs create a \"flow\" of data by connecting \"blocks\" to one another. You can add blocks to your program from the toolbar at the left. Use Sensor blocks to connect to real sensors, and Math blocks to process the incoming data. To connect blocks, click and drag from the connection pins on each block.";
    const welcome4 = "This limited demo version does not connect to real sensors or relays. To test out Dataflow programming, try using a Generator block as a source of data and a Light Bulb block as an output.";
    const welcome5 = "Dataflow is designed to be used in science classrooms. Programs and datasets are saved in the \"My Work\" tab at the right and can be shared with the whole class (and will appear in the \"Shared Work\" tab).";
    const welcome6 = "Read more about Dataflow and the InSPECT project ";
    return (
      <div className="dialog-contents">
        <div className="dialog-text">
          <div className="welcome">{welcome1}</div>
          <div className="welcome">{welcome2}</div>
          <div className="welcome">{welcome3}</div>
          <div className="welcome">{welcome4}</div>
          <div className="welcome">{welcome5}</div>
          <div className="welcome">
            {welcome6}
            <a href="https://concord.org/our-work/research-projects/inspect/" target="_blank">here</a>.
          </div>
        </div>
        <div className="dialog-buttons" data-test="dialog-buttons">
          <button id="okButton" onClick={this.handleCancelDialog}>Ok</button>
        </div>
      </div>
    );
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
    const input = dialog.rows
      ? <textarea
          rows={dialog.rows}
          data-test="dialog-text-input"
          value={this.state.promptValue}
          onChange={this.handlePromptValueChanged}
          onKeyUp={this.handlePromptKeyUp}
          ref={(el) => this.input = el}
        />
      : <input
          data-test="dialog-text-input"
          type="text"
          value={this.state.promptValue}
          onChange={this.handlePromptValueChanged}
          onKeyUp={this.handlePromptKeyUp}
          ref={(el) => this.input = el}
        />;
    return (
      <div className="dialog-contents">
        <div className="dialog-text">{dialog.text}</div>
        <div className="dialog-input">
          {input}
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

  private handlePromptValueChanged = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (this.input) {
      this.setState({promptValue: this.input.value});
    }
  }

  private handlePromptKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
