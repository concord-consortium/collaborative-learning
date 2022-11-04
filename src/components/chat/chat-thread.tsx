import React, {useEffect, useState} from "react";
import classNames from "classnames";
import { UserModelType } from "../../models/stores/user";
import { ILogComment, Logger } from "../../lib/logger";
import { WithId } from "../../hooks/firestore-hooks";
import { useUIStore } from "../../hooks/use-stores";
import { CommentDocument} from "../../lib/firestore-schema";
import { CommentCard } from "./comment-card";
import { getToolComponentInfo } from "../../models/tools/tool-component-info";
import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";
import {ChatCommentThread} from "./chat-comment-thread";
import { ToolIconComponent } from "./tool-icon-component";
import { ChatThreadToggle } from "./chat-thread-toggle";

import "./chat-thread.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  chatThreads?: ChatCommentThread[];
  onPostComment?: (comment: string) => void;
  onDeleteComment?: (commentId: string, commentContent: string) => void;
  focusDocument?: string;
  focusTileId?: string;
  isDocumentView?: boolean;
}

export const ChatThread: React.FC<IProps> = ({ activeNavTab, user, chatThreads,
  onPostComment, onDeleteComment, focusDocument, focusTileId, isDocumentView}) => {
  useEffect(() => {
    setExpandedThread(focusTileId || 'document');
  },[focusTileId]);

  // make focusId null if undefined so it can be compared with tileId below.
  const focusId = focusTileId === undefined ? null : focusTileId;
  const focusedItemHasNoComments = !chatThreads?.find(item => (item.tileId === focusId));
  const [expandedThread, setExpandedThread] = useState(focusId || '');
  const ui = useUIStore();

  const handleThreadClick = (clickedId: string | null) => {
    // Do the logging before we change expandedThread so we can tell whether the thread was expanded or collapsed.
    const eventPayload: ILogComment = {
      focusDocumentId: focusDocument || '',
      focusTileId: clickedId && clickedId !== "document" ? clickedId : undefined, // no focusTile for document clicks
      isFirst: false, // We're not adding a comment so this is irrelevant
      commentText: '', // This is about a thread not a single comment it doesn't make sense to log the text.
      action: clickedId === expandedThread ? "collapse" : "expand"
    };
    Logger.logCommentEvent(eventPayload);

    if (clickedId === expandedThread) {
      // We're closing the thread so clear out expanded thread.
      // The tile should stay selected though.
      setExpandedThread('');
    } else {
      // If the clickedId was the document, the selectedTile should be set to empty.
      const selectedTileId = clickedId === "document" ? '' : clickedId;
      ui.setSelectedTileId(selectedTileId || '');
      ui.setScrollTo(selectedTileId || '', focusDocument || '');
      setExpandedThread(clickedId || '');
    }
  };

  return (
    <div className="chat-list" data-testid="chat-list">
      {
        chatThreads?.map((commentThread: ChatCommentThread) => {
          const title = commentThread.title || '';
          const shouldShowUserIcon =
            commentThread.comments.some((comment: WithId<CommentDocument>) => user?.id === comment.uid);
          const numComments = commentThread.comments.length;
          const shouldBeFocused = commentThread.tileId === focusId;
          const Icon = commentThread.tileType && getToolComponentInfo(commentThread.tileType)?.Icon;
          const key= commentThread.tileId || "document";
          return (
            <div key={key}
              className={classNames("chat-thread", {
                "chat-thread-focused": shouldBeFocused,
              })}
              data-testid="chat-thread">
              <div className={classNames(`chat-thread-header ${activeNavTab}`,
                { "selected": shouldBeFocused })}
                data-testid="chat-thread-header"
                onClick={() => handleThreadClick(key)}
              >
                <div className="chat-thread-tile-info">
                {Icon && (
                    <Icon data-testid="chat-thread-tile-type"/>
                )}
                  <div className="chat-thread-title"> {title} </div>
                </div>
                <div className="chat-thread-comment-info">
                  {shouldShowUserIcon &&
                    <div className="user-icon" data-testid="chat-thread-user-icon"><UserIcon /></div>
                  }
                  <div className="chat-thread-num">{numComments}</div>
                  <ChatThreadToggle
                    isThreadExpanded={expandedThread === key}
                    activeNavTab={activeNavTab}
                      />
                </div>
              </div>
              {
                expandedThread === key &&
                <CommentCard
                  user={user}
                  activeNavTab={activeNavTab}
                  onPostComment={onPostComment}
                  onDeleteComment={onDeleteComment}
                  postedComments={commentThread.comments}
                  focusDocument={focusDocument}
                  focusTileId={focusTileId}
                />
              }
            </div>
          );
        })
      }
      {focusedItemHasNoComments  && !isDocumentView &&
        <div key={focusTileId ? focusTileId : "document"}
          className="chat-thread chat-thread-focused"
          data-testid="chat-thread">
          <div className={`chat-thread-header ${activeNavTab} selected`}
            data-testid="chat-thread-header">
            <div className="chat-thread-tile-info">
              <div className="comment-card-header comment-select" data-testid="comment-card-header">
                <div className="comment-card-header-icon" data-testid="comment-card-header-icon">
                  <div data-testid="chat-thread-tile-type">
                    <ToolIconComponent documentKey={focusDocument} tileId={focusTileId}/>
                  </div>
                </div>
              </div>
              <div className="chat-thread-comment-info">
                <div className="chat-thread-num">{0}</div>
              </div>
            </div>
          </div>
          <CommentCard
            user={user}
            activeNavTab={activeNavTab}
            onPostComment={onPostComment}
            onDeleteComment={onDeleteComment}
            postedComments={[]}
            focusDocument={focusDocument}
            focusTileId={focusTileId}
          />
        </div>
      }
    </div>
  );
};
