import * as React from "react";
import { Button, Dialog } from "@blueprintjs/core";

interface IProps {
  parentId?: string;
  onAccept: (content: string, parentId?: string) => void;
  onClose: () => void;
  content?: string;
  title?: string;
  prompt?: string;
  placeholder?: string;
  maxLength?: number;
}

interface IState {
  content: string;
}

export default
class DocumentDialog extends React.Component<IProps, IState> {

  public state = {
            content: this.props.content || ""
          };

  public render() {
    const { title, prompt, placeholder, maxLength } = this.props;
    return (
      <Dialog
        icon="text-highlight"
        isOpen={true}
        onClose={this.props.onClose}
        title={title}
        canOutsideClickClose={false}
      >
        <div className="nc-attribute-name-prompt">{prompt}:</div>
        <input
          className="nc-attribute-name-input pt-input"
          type="text"
          maxLength={maxLength ? maxLength : 100}
          placeholder={placeholder}
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
    const { onAccept, parentId } = this.props;
    const { content } = this.state;
    onAccept && onAccept(content, parentId);
  }

  private handleCancel = () => {
    const { onClose } = this.props;
    onClose && onClose();
  }

  private handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    evt.stopPropagation();
    if (evt.keyCode === 13) {
      this.handleAccept();
    } else if (evt.keyCode === 27) {
      this.handleCancel();
    }
  }

}
