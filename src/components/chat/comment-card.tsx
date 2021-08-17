import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import DocumentCommentIcon from "../../assets/document-id.svg";
import SendIcon from "../../assets/send-icon.svg";
import "./comment-card.scss";
import "../themes.scss";

interface IProps {
}

interface IState {
  commentTextAreaHeight: number | string;
  commentAdded: boolean;
  commentText: string;
}

@inject("stores")
@observer
export class CommentCard extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.handleCommentTextAreaChange = this.handleCommentTextAreaChange.bind(this);
    this.handleCancelPost = this.handleCancelPost.bind(this);
    this.handleSendPost = this.handleSendPost.bind(this);

    this.state = {
      commentTextAreaHeight: 35,
      commentAdded: false,
      commentText: "",
    }
  }

  public render() {
    // eslint-disable-next-line no-empty-pattern
    const {} = this.props;
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
  handleCommentTextAreaChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    const targetText = target.value;
    if (targetText === "") {
      this.setState({commentTextAreaHeight: 35, commentAdded: false, commentText: ""});
    } else {
      this.setState({commentTextAreaHeight: target.scrollHeight, commentAdded: true, commentText: targetText});
    }
  };
  handleCancelPost = () => {
    this.setState({commentTextAreaHeight: 35, commentAdded: false, commentText: ""});
  }
  handleSendPost = () => {
    alert(`You are sending this comment: ${this.state.commentText}`);
  }

  private renderCommentTextbox() {
    const { ui } = this.stores;
    const { commentTextAreaHeight, commentAdded, commentText } = this.state;
    const textareaStyle = {height: commentTextAreaHeight};
    const postButtonClass = `comment-footer-button themed-negative ${ui.activeNavTab} ${!commentAdded ? "disabled no-action" : "" }`;
    return (
      <div className="comment-textbox">
        <textarea
          className="comment-textarea"
          style={textareaStyle}
          placeholder="Comment on this document..."
          value={commentText}
          onChange={this.handleCommentTextAreaChange}
        />
        <div className="comment-textbox-footer">
          <div className="comment-footer-button cancel" onClick={this.handleCancelPost}>Cancel</div>
          <div className={postButtonClass} onClick={this.handleSendPost}>
            <SendIcon />
            Post
          </div>
        </div>
      </div>
    );
  }
}
