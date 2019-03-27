import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";

import "./rename-column-dialog.sass";

interface IProps {
  id: string;
  isOpen: boolean;
  onRenameAttribute: (id: string, name: string) => void;
  onClose: () => void;
  name: string;
  columnNameValidator?: (name: string) => string | undefined;
}

interface IState {
  name: string;
}

export default
class RenameColumnDialog extends React.Component<IProps, IState> {

  public state = {
            name: this.props.name || ""
          };

  public render() {
    const prompt = `Enter a new name for column "${this.props.name}"`;
    const errorMessage = this.getValidationError();
    return (
      <Dialog
        icon="text-highlight"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`Rename Column`}
        canOutsideClickClose={false}
        className="rename-column-dialog"
      >
        <div className="nc-attribute-name-prompt">{prompt}:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          maxLength={20}
          placeholder={`Column name`}
          value={this.state.name}
          onChange={this.handleNameChange}
          onKeyDown={this.handleKeyDown}
          dir="auto"
          ref={input => input && input.focus()}
        />
        <div className="nc-dialog-error">
          {errorMessage}
        </div>
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleRenameAttribute}
            disabled={errorMessage != null}
          />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.props.onClose}/>
        </div>
      </Dialog>
    );
  }

  private getValidationError = () => {
    const { columnNameValidator: validator } = this.props;
    const { name } = this.state;
    return validator && validator(name);
  }

  private handleNameChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ name: (evt.target as HTMLInputElement).value });
  }

  private handleRenameAttribute = () => {
    if (this.props.onRenameAttribute && !this.getValidationError()) {
      this.props.onRenameAttribute(this.props.id, this.state.name);
    }
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.keyCode === 13) {
      this.handleRenameAttribute();
    }
  }

}
