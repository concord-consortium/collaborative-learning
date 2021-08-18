import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import DocumentCommentIcon from "../../assets/document-id.svg";
import SendIcon from "../../assets/send-icon.svg";
import "./comment-card.scss";
import "../themes.scss";
import classNames from "classnames";

interface IProps {
}

interface IState {
  commentTextAreaHeight: number | string;
  commentAdded: boolean;
  commentText: string;
}
const minTextAreaHeight = 35;

@inject("stores")
@observer
export class CommentCard extends BaseComponent<IProps, IState> {
  state = {
    commentTextAreaHeight: minTextAreaHeight,
    commentAdded: false,
    commentText: "",
  };

  escFunction = (event: any) => {
    if(event.keyCode === 27) {
      this.setState({commentTextAreaHeight: minTextAreaHeight, commentAdded: false, commentText: ""});
    }
  }
  componentDidMount(){
    document.addEventListener("keydown", this.escFunction, false);
  }
  componentWillUnmount(){
    document.removeEventListener("keydown", this.escFunction, false);
  }

  public render() {
    const { ui } = this.stores;
    return (
      <div className={`comment-card ${ui.activeNavTab}`} data-testid="comment-card">
        {this.renderThreadHeader()}
        {this.renderCommentTextbox()}
      </div>
    );
  }

  private renderThreadHeader() {
    const { ui } = this.stores;
    return (
      <div className={`comment-card-header ${ui.activeNavTab}`}>
        <DocumentCommentIcon className="new-thread-header-icon"/>
      </div>
    );
  }
  handleCommentTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    const targetText = target.value;
    if (!targetText) {
      this.setState({commentTextAreaHeight: minTextAreaHeight, commentAdded: false, commentText: ""});
    } else {
      this.setState({commentTextAreaHeight: target.scrollHeight, commentAdded: true, commentText: targetText});
    }
  };
  handleCancelPost = () => {
    this.setState({commentTextAreaHeight: minTextAreaHeight, commentAdded: false, commentText: ""});
  }
  handleSendPost = () => {
    alert(`You are sending this comment: ${this.state.commentText}`);
    this.setState({commentTextAreaHeight: minTextAreaHeight, commentAdded: false, commentText: ""});
  }

  private renderCommentTextbox() {
    const { ui } = this.stores;
    const { commentTextAreaHeight, commentAdded, commentText } = this.state;
    const textareaStyle = {height: commentTextAreaHeight};
    const postButtonClass = classNames("comment-footer-button", "themed-negative", ui.activeNavTab,
                                       { disabled: !commentAdded, "no-action": !commentAdded });
    return (
      <div className="comment-textbox">
        <textarea
          style={textareaStyle}
          placeholder="Comment on this document..."
          value={commentText}
          data-testid="comment-textarea"
          onChange={this.handleCommentTextAreaChange}
        />
        <div className="comment-textbox-footer">
          <div className="comment-footer-button cancel"
               onClick={this.handleCancelPost}
               data-testid="comment-cancel-button">
            Cancel
          </div>
          <div className={postButtonClass} onClick={this.handleSendPost} data-testid="comment-post-button">
            <SendIcon />
            Post
          </div>
        </div>
      </div>
    );
  }
}
