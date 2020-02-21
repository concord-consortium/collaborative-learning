import React from "react";
import { Button, Dialog } from "@blueprintjs/core";

interface IProps {
  isOpen: boolean;
  onNewAttribute: (name: string) => void;
  onClose: () => void;
}

interface IState {
  name: string;
}

export default
class NewColumnDialog extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      name: ""
    };
  }

  public render() {
    const capitalizedAttribute = "Attribute";
    return (
      <Dialog
        icon="add-column-right"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`New ${capitalizedAttribute}`}
        canOutsideClickClose={false}
      >

        <div className="nc-attribute-name-prompt">Enter a name for the new column:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          placeholder={`${capitalizedAttribute} name`}
          value={this.state.name}
          onChange={this.handleNameChange}
          onKeyDown={this.handleKeyDown}
          dir="auto"
          ref={input => input && input.focus()}
        />
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleNewAttribute}
            disabled={!this.state.name} />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.props.onClose}/>
        </div>
      </Dialog>
    );
  }

  private handleNameChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ name: (evt.target as HTMLInputElement).value });
  }

  private handleNewAttribute = () => {
    if (this.props.onNewAttribute) {
      this.props.onNewAttribute(this.state.name);
    }
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.keyCode === 13) {
      this.handleNewAttribute();
    }
  }

}
