import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";

interface IProps {
  id: string;
  isOpen: boolean;
  onAccept: (id: string, name: string) => void;
  onClose: () => void;
  content: string;
}

interface IState {
  content: string;
}

export default
class CommentDialog extends React.Component<IProps, IState> {

  public state = {
            content: this.props.content || ""
          };

  public render() {
    const prompt = "Comment";
    return (
      <Dialog
        icon="text-highlight"
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        title={`Edit Comment`}
        canOutsideClickClose={false}
      >
        <div className="nc-attribute-name-prompt">{prompt}:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          maxLength={500}
          placeholder={"Type comment here"}
          value={this.state.content}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          dir="auto"
          ref={input => input && input.focus()}
        />
        <div className="nc-dialog-buttons">
          <Button
            className="nc-dialog-button pt-intent-primary"
            text="OK"
            onClick={this.handleAccept}
          />
          <Button className="nc-dialog-button" text="Cancel"  onClick={this.handleCancel}/>
        </div>
      </Dialog>
    );
  }

  private handleChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ content: (evt.target as HTMLInputElement).value });
  }

  private handleAccept = () => {
    if (this.props.onAccept) {
      this.props.onAccept(this.props.id, this.state.content);
    }
  }

  private handleCancel = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.keyCode === 13) {
      this.handleAccept();
    } else if (evt.keyCode === 27) {
      this.handleCancel();
    }
  }

}
