import React from "react";
import { BaseComponent } from "../base";
import  ChatIcon from "../../assets/chat-icon.svg";
import  NotificationIcon from "../../assets/notifications-icon.svg";
// import CloseIcon from "../../assets/icons/close.svg";

import "./chat-panel-header.scss";
import "../themes.scss";
import { inject, observer } from "mobx-react";

interface IProps {
  onCloseChatPanel:(show:boolean) => void;
}

@inject("stores")
@observer
export class ChatPanelHeader extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }
  render () {
    const { onCloseChatPanel } = this.props;
    const { ui } = this.stores;
   return (
      <div className="chat-panel-header">
        <ChatIcon className={`chat-icon themed ${ui.activeNavTab}`}/>
        Comments
        {this.renderNotification()}
        <button className={`close-button themed ${ui.activeNavTab}`} onClick={() => onCloseChatPanel(false)}/>
      </div>
    );
  }

  private renderNotification = () => {
    const newCommentCount = 88;
    const { ui } = this.stores;
    return (
      <div className="notification-toggle">
        <div className={`notification-icon themed-negative ${ui.activeNavTab}`}>
          <NotificationIcon className={`icon-image  themed-negative ${ui.activeNavTab}`}/>
        </div>
        <div className="new-comment-badge">{newCommentCount}</div>
      </div>
    );
  };
}
