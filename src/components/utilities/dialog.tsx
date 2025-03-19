import { inject, observer } from "mobx-react";
import React, { CSSProperties } from "react";
import { BaseComponent, IBaseProps } from "../base";
import { UIDialogModelType } from "../../models/stores/ui";

import "./dialog.sass";

interface IProps extends IBaseProps {
  dialog?: UIDialogModelType;
}

@inject("stores")
@observer
export class DialogComponent extends BaseComponent<IProps> {
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

  public render() {
    const {dialog} = this.stores.ui;
    if (dialog) {
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
        case "getCopyToDocument":
          title = title || "Copy to Document";
          contents = this.renderCopyToDocumentContents(dialog);
          break;
        default:
        case "alert":
          title = title || "Alert";
          contents = this.renderAlertContents(dialog);
          break;
      }

      return (
        <div className={`dialog ${dialog.className}`}>
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

  private renderCopyToDocumentContents(dialog: UIDialogModelType) {
    const { documents } = this.stores;
    const otherDocuments = documents.all.filter((d) => {
      return (d.title ?? "").trim() !== "" && d.key !== dialog.copyFromDocumentKey;
    });
    const italic: CSSProperties = {fontStyle: "italic"};
    const normal: CSSProperties = {fontStyle: "normal"};
    const hasValue = (dialog.copyToDocumentKey ?? "").trim() !== "";

    return (
      <div className="dialog-contents">
        <div className="dialog-text">{dialog.text}</div>
        <div className="dialog-input">
          <select
            placeholder="Choose a document"
            defaultValue={dialog.copyToDocumentKey /* set so default option is selected at start */}
            value={dialog.copyToDocumentKey}
            style={hasValue ? normal : italic}
            onChange={this.handleCopyToDocumentKeyChanged}
            autoFocus
          >
            <option disabled={hasValue} value="" style={italic}>Choose a document</option>
            {otherDocuments.map((d) => (
              <option key={d.key} value={d.key} style={normal}>{d.title}</option>
            ))}
          </select>
        </div>
        <div className="dialog-buttons" data-test="dialog-buttons">
          <button id="okButton" onClick={this.handleCopyToDocumentDialogOk}>Ok</button>
          <button id="cancelButton" onClick={this.handleCancelDialog}>Cancel</button>
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
          value={dialog.promptValue}
          onChange={this.handlePromptValueChanged}
          onKeyUp={this.handlePromptKeyUp}
          ref={(el) => this.input = el}
        />
      : <input
          data-test="dialog-text-input"
          type="text"
          value={dialog.promptValue}
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
  };

  private handleConfirmDialogNo = (e: React.MouseEvent<HTMLButtonElement>) => {
    this.stores.ui.resolveDialog(false);
  };

  private handlePromptValueChanged = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (this.input) {
      this.stores.ui.dialog?.setPromptValue(this.input.value);
    }
  };

  private handlePromptKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // listen for enter key
    if (e.keyCode === 13) {
      this.handlePromptDialogOk();
    }
  };

  private get promptValue() {
    return (this.stores.ui.dialog?.promptValue || "").trim();
  }

  private handlePromptDialogOk = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const {promptValue} = this;
    if (promptValue.length > 0) {
      this.stores.ui.resolveDialog(promptValue);
    }
  };

  private handleCancelDialog = (e?: React.MouseEvent<HTMLButtonElement>) => {
    this.stores.ui.closeDialog();
  };

  private handleWindowKeyUp = (e: KeyboardEvent) => {
    // listen for escape key when dialog is visible
    if (this.stores.ui.dialog && (e.keyCode === 27)) {
      this.handleCancelDialog();
    }
  };

  private handleCopyToDocumentKeyChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.stores.ui.dialog?.setCopyToDocumentKey(e.target.value);
  };

  private handleCopyToDocumentDialogOk = () => {
    const dialog = this.stores.ui.dialog;
    if (dialog?.copyToDocumentKey) {
      this.stores.ui.resolveDialog(dialog.copyToDocumentKey);
    }
  };

}
