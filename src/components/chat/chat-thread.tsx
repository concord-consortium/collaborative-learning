import React, {useEffect, useRef, useState} from "react";
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

import DeletedTileIcon from "../../assets/icons/deleted-tile-icon.svg";

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
  expandedThreads: Set<string>;
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
  expandedThreads,
  onThreadClick,
  isFocused,
  overrideTitle,
}) => {
  const ui = useUIStore();
  const threadRef = useRef<HTMLDivElement>(null);
  const title = overrideTitle || commentThread?.title || '';
  const numComments = commentThread?.comments.length || 0;
  const comments = commentThread?.comments || [];
  const tileId = commentThread?.tileId || focusTileId;
  const isDeletedTile = commentThread?.isDeletedTile || false;

  // Scroll this thread into view when it becomes focused (e.g. tile selected in workspace)
  useEffect(() => {
    if (isFocused && threadRef.current) {
      threadRef.current.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [isFocused]);

  // Select this thread's tile when clicking on the comment card body
  const handleSelectCard = () => {
    if (threadId === "document") {
      // Clear tile selection so document becomes focused
      ui.setSelectedTileId('');
    } else {
      ui.setSelectedTileId(threadId);
      ui.setScrollTo(threadId, focusDocument || '');
    }
  };

  return (
    <div key={threadId}
      ref={threadRef}
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
            {isDeletedTile && <DeletedTileIcon className="deleted-tile-indicator" />}
          </div>
          <div className="chat-thread-title"> {title} </div>
        </div>
        <div className="chat-thread-comment-info">
          <div className="chat-thread-num">{numComments}</div>
          <ChatThreadToggle
            isThreadExpanded={expandedThreads.has(threadId)}
            activeNavTab={activeNavTab}
          />
        </div>
      </div>
      {
        expandedThreads.has(threadId) &&
        <CommentCard
          user={user}
          activeNavTab={activeNavTab}
          onPostComment={onPostComment}
          onDeleteComment={onDeleteComment}
          postedComments={comments}
          focusDocument={focusDocument}
          focusTileId={focusTileId}
          isFocused={isFocused}
          onSelect={handleSelectCard}
        />
      }
    </div>
  );
});

const _ChatThread: React.FC<IProps> = ({ activeNavTab, user, chatThreads,
  onPostComment, onDeleteComment, focusDocument, focusTileId, isDocumentView, docTitle}) => {

  // make focusId null if undefined so it can be compared with tileId below.
  const focusId = focusTileId === undefined ? null : focusTileId;
  // expandedThreads tracks which threads are currently expanded (can be multiple).
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set(focusId ? [focusId] : [])
  );

  // Switching focus expands the newly-selected thread (without closing others).
  useEffect(() => {
    const threadToExpand = focusTileId || 'document';
    setExpandedThreads(prev => new Set(prev).add(threadToExpand));
  }, [focusTileId]);

  // If a remote comment is pending, we force the document thread to be expanded.
  const content = useCurriculumOrDocumentContent(focusDocument);
  const pendingRemoteComment = content?.isAwaitingRemoteComment;

  useEffect(() => {
    if (pendingRemoteComment) {
      setExpandedThreads(prev => new Set(prev).add('document'));
    }
  }, [pendingRemoteComment]);

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

  // Scroll the document preview to the focused tile when selection changes in the workspace.
  // This complements the thread scroll in ChatThreadItem so both the document preview
  // and the comment thread stay in sync with the workspace selection.
  useEffect(() => {
    if (focusTileId && focusDocument) {
      ui.setScrollTo(focusTileId, focusDocument);
    }
  }, [focusTileId, focusDocument, ui]);

  const handleThreadClick = (clickedId: string | null) => {
    const threadId = clickedId || '';

    // Use the setExpandedThreads callback to read the true current state via `prev`,
    // avoiding stale closure bugs if another effect updated expandedThreads before re-render.
    setExpandedThreads(prev => {
      const isCurrentlyExpanded = prev.has(threadId);

      // Log before toggling so we capture the before-state
      const eventPayload: ILogComment = {
        focusDocumentId: focusDocument || '',
        focusTileId: clickedId && clickedId !== "document" ? clickedId : undefined,
        isFirst: false,
        commentText: '',
        action: isCurrentlyExpanded ? "collapse" : "expand"
      };
      logCommentEvent(eventPayload);

      // If expanding a thread (not collapsing), update the selected tile
      if (!isCurrentlyExpanded) {
        if (clickedId === "document") {
          ui.setSelectedTileId('');
          ui.setScrollTo('', focusDocument || '');
        } else {
          ui.setSelectedTileId(clickedId || '');
          ui.setScrollTo(clickedId || '', focusDocument || '');
        }
      }

      // Toggle the clicked thread's expanded state
      const next = new Set(prev);
      if (isCurrentlyExpanded) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
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
              expandedThreads={expandedThreads}
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
          expandedThreads={expandedThreads}
          onThreadClick={handleThreadClick}
          isFocused={true}
          overrideTitle={overrideTitle}
        />
      }
    </div>
  );
};

export const ChatThread = observer(_ChatThread);
