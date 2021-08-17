import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import DocumentCommentIcon from "../../assets/document-id.svg";
import SendIcon from "../../assets/send-icon.svg";
import "./comment-card.scss";
import "../themes.scss";

interface IProps {
}

@inject("stores")
@observer
export class CommentCard extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
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

  private renderCommentTextbox() {
    const { ui } = this.stores;
    return (
      <div className="comment-textbox">
        <textarea placeholder="Comment on this document..."></textarea>
        <div className="comment-textbox-footer">
          <div className="comment-footer-button cancel">Cancel</div>
          <div className={`comment-footer-button themed-negative ${ui.activeNavTab}`}>
            <SendIcon />
            Post
          </div>
        </div>
      </div>
    );
  }
}
