import { observer } from "mobx-react";
import React, {Dispatch, SetStateAction} from "react";
import ChatIcon from "../../assets/chat-icon.svg";
import NotificationIcon from "../../assets/notifications-icon.svg";
import DocumentsWithCommentsIcon  from "../../assets/documents-list-icon.svg";

import "./chat-panel-header.scss";
import "../themes.scss";

interface IProps {
  activeNavTab: string;
  newCommentCount: number;
  onCloseChatPanel:(show:boolean) => void;
  isDocumentView: boolean;
  setIsDocumentView: Dispatch<SetStateAction<boolean>>;
}

export const ChatPanelHeader: React.FC<IProps> = observer(({activeNavTab, newCommentCount, onCloseChatPanel,
  isDocumentView, setIsDocumentView}) => {

  const renderNotification = () => {
    return (
      <div className="notification-toggle">
        <div className={`notification-icon themed-negative ${activeNavTab}`}>
          {/* <NotificationIcon className={`icon-image themed-negative ${activeNavTab}`}/> */}
          <DocumentsWithCommentsIcon
            className={`icon-image themed-negative ${activeNavTab}`}
            onClick={()=> setIsDocumentView((prevState) => !prevState)}
          />
        </div>
        {/* The next line of code is commented out, but deliberately not removed,
            per: https://www.pivotaltracker.com/story/show/179754830 */}
        {/* <div className="new-comment-badge">{newCommentCount}</div> */}
      </div>
    );
  };

  return (
    <div className="chat-panel-header" data-testid="chat-panel-header">
      <ChatIcon className={`chat-icon themed ${activeNavTab} no-action`}/>
      {isDocumentView ? "Documents" : "Comments"}
      {renderNotification()}
      <button className={`chat-close-button themed ${activeNavTab}`}
              data-testid="chat-close-button"
              onClick={() => onCloseChatPanel(false)}/>
    </div>
  );
});
