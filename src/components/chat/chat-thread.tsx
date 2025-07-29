import React, {useEffect, useState} from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ILogComment, logCommentEvent } from "../../models/tiles/log/log-comment-event";
import { UserModelType } from "../../models/stores/user";
import { useCurriculumOrDocumentContent, useUIStore } from "../../hooks/use-stores";
import { CommentCard } from "./comment-card";
import {ChatCommentThread} from "./chat-comment-thread";
import { TileIconComponent } from "./tile-icon-component";
import { ChatThreadToggle } from "./chat-thread-toggle";
import type { PostCommentFn, DeleteCommentFn } from "./chat-panel";

import "./chat-thread.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  chatThreads?: ChatCommentThread[];
  onPostComment?: PostCommentFn;
  onDeleteComment?: DeleteCommentFn;
  focusDocument?: string;
  focusTileId?: string;
  isDocumentView?: boolean;
  docTitle?: string;
}

interface ChatThreadItemProps {
  threadId: string; // either a tileId or "document"
  user?: UserModelType;
  activeNavTab?: string;
  onPostComment?: PostCommentFn;
  onDeleteComment?: DeleteCommentFn;
  focusDocument?: string;
  focusTileId?: string;
  commentThread?: ChatCommentThread;
  expandedThread: string;
  onThreadClick: (clickedId: string | null) => void;
  isFocused: boolean;
  overrideTitle?: string;
}

const ChatThreadItem: React.FC<ChatThreadItemProps> = observer(({
  threadId,
  user,
  activeNavTab,
  onPostComment,
  onDeleteComment,
  focusDocument,
  focusTileId,
  commentThread,
  expandedThread,
  onThreadClick,
  isFocused,
  overrideTitle,
}) => {
  const title = overrideTitle || commentThread?.title || '';
  const numComments = commentThread?.comments.length || 0;
  const comments = commentThread?.comments || [];
  const tileId = commentThread?.tileId || focusTileId;

  return (
    <div key={threadId}
      className={classNames("chat-thread", {
        "chat-thread-focused": isFocused,
      }, `${tileId ? "chat-thread-tile" : "chat-thread-document"}`
      )}
      data-testid="chat-thread">
      <div className={classNames(`chat-thread-header ${activeNavTab}`,
        { "selected": isFocused })}
        data-testid="chat-thread-header"
        onClick={() => onThreadClick(threadId)}
      >
        <div className="chat-thread-tile-info">
          <div className="chat-thread-tile-type" data-testid="chat-thread-tile-type">
            <TileIconComponent documentKey={focusDocument} tileId={tileId}/>
          </div>
          <div className="chat-thread-title"> {title} </div>
        </div>
        <div className="chat-thread-comment-info">
          <div className="chat-thread-num">{numComments}</div>
          <ChatThreadToggle
            isThreadExpanded={expandedThread === threadId}
            activeNavTab={activeNavTab}
          />
        </div>
      </div>
      {
        expandedThread === threadId &&
        <CommentCard
          user={user}
          activeNavTab={activeNavTab}
          onPostComment={onPostComment}
          onDeleteComment={onDeleteComment}
          postedComments={comments}
          focusDocument={focusDocument}
          focusTileId={focusTileId}
        />
      }
    </div>
  );
});

const _ChatThread: React.FC<IProps> = ({ activeNavTab, user, chatThreads,
  onPostComment, onDeleteComment, focusDocument, focusTileId, isDocumentView, docTitle}) => {

  // make focusId null if undefined so it can be compared with tileId below.
  const focusId = focusTileId === undefined ? null : focusTileId;
  // expandedThread can be an id of a tile, "document", or "" if no thread is expanded.
  const [expandedThread, setExpandedThread] = useState(focusId || '');

  // Switching focus expands the newly-selected thread.
  useEffect(() => {
    setExpandedThread(focusTileId || 'document');
  }, [focusTileId]);

  // If an AI evaluation is pending, we force the document thread to be expanded.
  const content = useCurriculumOrDocumentContent(focusDocument);
  const pendingAIAnalysis = content?.awaitingAIAnalysis;
  useEffect(() => {
    if (pendingAIAnalysis) {
      setExpandedThread('document');
    }
  }, [pendingAIAnalysis]);

  const focusedItemHasNoComments = !chatThreads?.find(item => (item.tileId === focusId));
  let overrideTitle = undefined;
  if (focusedItemHasNoComments) {
    // No comment thread so we need to determine the title of the focused item.
    if (focusId) {
      const focusedItem = content?.getTile(focusId);
      overrideTitle = focusedItem?.computedTitle || '';
    } else {
      overrideTitle = docTitle || '';
    }
  }
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
    logCommentEvent(eventPayload);

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
          const shouldBeFocused = commentThread.tileId === focusId;
          const id = commentThread.tileId || "document";
          return (
            <ChatThreadItem
              key={id}
              threadId={id}
              user={user}
              activeNavTab={activeNavTab}
              onPostComment={onPostComment}
              onDeleteComment={onDeleteComment}
              focusDocument={focusDocument}
              focusTileId={focusTileId}
              commentThread={commentThread}
              expandedThread={expandedThread}
              onThreadClick={handleThreadClick}
              isFocused={shouldBeFocused}
            />
          );
        })
      }
      {focusedItemHasNoComments && !isDocumentView &&
        <ChatThreadItem
          key={focusId ? focusId : "document"}
          threadId={focusId ? focusId : "document"}
          user={user}
          activeNavTab={activeNavTab}
          onPostComment={onPostComment}
          onDeleteComment={onDeleteComment}
          focusDocument={focusDocument}
          focusTileId={focusTileId}
          commentThread={undefined}
          expandedThread={expandedThread}
          onThreadClick={handleThreadClick}
          isFocused={true}
          overrideTitle={overrideTitle}
        />
      }
    </div>
  );
};

export const ChatThread = observer(_ChatThread);
