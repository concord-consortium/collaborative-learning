import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import { getDisplayTimeDate } from "../../utilities/time";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import "./chat-panel.scss";
import { UserModelType } from "../../models/stores/user";

interface IProps {
  newCommentCount: number;
  onCloseChatPanel:(show:boolean) => void;
}

interface IState {
  commentData: { comment: string; timePosted: string; user: UserModelType}[];
}

@inject("stores")
@observer
export class ChatPanel extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      commentData: [],
    };
    this.handlePostComment = this.handlePostComment.bind(this);
  }

  public render() {
    const { newCommentCount, onCloseChatPanel } = this.props;
    const { ui, user } = this.stores;

    return (
      <div className={`chat-panel ${ui.activeNavTab}`} data-testid="chat-panel">
        <ChatPanelHeader onCloseChatPanel={onCloseChatPanel} newCommentCount={newCommentCount} />
        <CommentCard
          activeNavTab={ui.activeNavTab}
          user={user}
          onPostComment={this.handlePostComment}
          postedComments={this.state.commentData}
        />
      </div>
    );
  }

  private handlePostComment(commentStr: string) {
    const time = getDisplayTimeDate(Date.now());
    const commentDataPosted = {comment: commentStr, timePosted: time, user: this.stores.user};
    this.setState(prevState => ({commentData: [...prevState.commentData, commentDataPosted]}));
  }
}
