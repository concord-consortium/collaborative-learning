import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import OpenWorkspaceIcon from "./../assets/icons/1-4-up/1-up-icon-default.svg";
import PostIcon from "../../assets/post-icon";
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
    const teacherInitial = this.getTeacherInitial();
    return (
      <div className="comment-card-header">
        <div className="initial">
          {teacherInitial}
        </div>
      </div>
    );
  }

  private CommentText() {
    const { user } = this.stores;
    const teacherInitial = this.getTeacherInitial();

    return (
      <div className="comment-text">
        <div className="comment-text-header">
          <div className="user-icon">{teacherInitial}</div>
          <div className="user-name">{user.name}</div>
          <div className="time-stamp"></div>
          <div className="menu"></div>
        </div>
        <div className="comment-text">
          Lorem
        </div>
      </div>
    );
  }

  private renderCommentTextbox() {
    return (
      <div className="comment-textbox">
        <input placeholder="Reply ..."></input>
        <div className="comment-textbox-footer">
          <div className="comment-footer-button cancel">Cancel</div>
          <div className="comment-footer-button theme-dark">
            {PostIcon}
            Post
          </div>
        </div>
      </div>
    );
  }
  private renderNewThreadHeader() {
    return (
      <div className="new-thread-header">
        <OpenWorkspaceIcon />
      </div>
    );
  }

  private getTeacherInitial() {
    const { user } = this.stores;
    return user.name.charAt(0);
  }


}
