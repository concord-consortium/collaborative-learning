import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent } from "../base";
import { ChatPanelHeader } from "./chat-panel-header";
import "./chat-panel.scss";

interface IProps {
  newCommentCount: number;
  onCloseChatPanel:(show:boolean) => void;
}

@inject("stores")
@observer
export class ChatPanel extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { newCommentCount, onCloseChatPanel } = this.props;
    const { ui } = this.stores;
    return (
      <div className={`chat-panel ${ui.activeNavTab}`}>
        <ChatPanelHeader onCloseChatPanel={onCloseChatPanel} newCommentCount={newCommentCount} />
      </div>
    );
  }
}
