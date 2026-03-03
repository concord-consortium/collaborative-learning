import React, {useCallback, useEffect, useRef, useState} from "react";
import { observer } from "mobx-react";
import { reaction } from "mobx";
import classNames from "classnames";
import { ILogComment, logCommentEvent } from "../../models/tiles/log/log-comment-event";
import { UserModelType } from "../../models/stores/user";
import { useCurriculumOrDocumentContent, useStores, useUIStore } from "../../hooks/use-stores";
import { getReadAloudService } from "../../models/services/read-aloud-service";
import { isCommentItem } from "../../models/services/read-aloud-queue-items";
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
  readingCommentId?: string | null;
  pendingCommentId?: string | null;
  onCommentClick?: (commentId: string) => void;
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
  readingCommentId,
  pendingCommentId,
  onCommentClick,
}) => {
  const stores = useStores();
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

  // Select this thread's tile when clicking on the comment card body.
  // When Read Aloud is active, jump to this thread directly instead of going through
  // the selectedTileIds reaction (which can't distinguish comment clicks from workspace clicks).
  const handleSelectCard = () => {
    const service = getReadAloudService(stores);
    if (service.isReadingPane("left")) {
      // Jump to the first comment item for this thread
      const originTileId = threadId === "document" ? null : threadId;
      const idx = service.queue.findIndex(
        item => isCommentItem(item) && item.originTileId === originTileId
      );
      if (idx >= 0) {
        service.jumpToItem(idx);
        return;
      }
    }
    if (threadId === "document") {
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
          readingCommentId={readingCommentId}
          pendingCommentId={pendingCommentId}
          onCommentClick={onCommentClick}
        />
      }
    </div>
  );
});

const _ChatThread: React.FC<IProps> = ({ activeNavTab, user, chatThreads,
  onPostComment, onDeleteComment, focusDocument, focusTileId, isDocumentView, docTitle}) => {

  const stores = useStores();
  // make focusId null if undefined so it can be compared with tileId below.
  const focusId = focusTileId === undefined ? null : focusTileId;
  // expandedThreads tracks which threads are currently expanded (can be multiple).
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set(focusId ? [focusId] : ['document'])
  );

  // Switching focus expands the newly-selected thread (without closing others).
  // When focusTileId becomes undefined (e.g. cross-document selection or deselection),
  // we do nothing — the document thread should only expand via explicit user action
  // (clicking its header) or pending remote comments.
  useEffect(() => {
    if (focusTileId) {
      setExpandedThreads(prev => new Set(prev).add(focusTileId));
    }
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

  const handleThreadClick = (clickedId: string | null) => {
    const threadId = clickedId || '';

    // Clear pending comment highlight when clicking a thread header
    const service = getReadAloudService(stores);
    service.setPendingCommentId(null);

    // When Read Aloud is active, jump to the first comment item for this thread directly
    // instead of going through the selectedTileIds reaction (which can't distinguish comment
    // clicks from workspace clicks).
    if (service.isReadingPane("left")) {
      const originTileId = clickedId === "document" || !clickedId ? null : clickedId;
      const idx = service.queue.findIndex(
        item => isCommentItem(item) && item.originTileId === originTileId
      );
      if (idx >= 0) {
        service.jumpToItem(idx);
        // Still expand the thread so the user can see the comments
        setExpandedThreads(prev => new Set(prev).add(threadId));
        return;
      }
    }

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

  // When Read Aloud is active, highlight the thread currently being read.
  // For tile-level threads this supplements the existing tile-selection-based highlighting.
  // For document-level and deleted-tile threads, this is the primary highlight mechanism.
  const readAloudService = getReadAloudService(stores);
  const currentReadItem = readAloudService.currentItem;

  // Derive per-comment reading state for individual comment highlighting
  const readingCommentId = currentReadItem && isCommentItem(currentReadItem)
    ? currentReadItem.commentId : null;

  // Pending comment ID for visual highlight when idle (set by clicking a comment)
  const pendingCommentId = readAloudService.pendingCommentId;

  // Clear pending comment highlight when a tile is selected from the workspace
  // (not from a comment click). Uses a MobX reaction on selectedTileIds so it
  // fires synchronously within the same event loop — avoiding multi-render
  // timing issues that plague useEffect on the focusTileId prop.
  const lastCommentClickRef = useRef(0);
  useEffect(() => {
    const disposer = reaction(
      () => Array.from(stores.ui.selectedTileIds),
      (newIds) => {
        // If this change was caused by our own comment click (which deselects
        // tiles), skip clearing. The reaction fires synchronously, so the
        // timestamp check reliably distinguishes our own call from a later user click.
        const elapsed = Date.now() - lastCommentClickRef.current;
        if (elapsed < 100) return;
        // If this change was caused by readItem() programmatically selecting a tile
        // during reading, skip clearing. Without this, starting read-aloud on a
        // comment would clear the pending ID as soon as readItem selects the
        // associated tile, breaking the next start() from jumping to the comment.
        const service = getReadAloudService(stores);
        const progElapsed = Date.now() - service.lastProgrammaticSelectionTime;
        if (progElapsed < 100) return;
        service.setPendingCommentId(null);
      }
    );
    return () => disposer();
  }, [stores]);

  // Click handler for individual comments — sets pending comment and jumps read-aloud if active
  const handleCommentClick = useCallback((commentId: string) => {
    const service = getReadAloudService(stores);
    // Record the timestamp so the reaction above can skip the tile-deselection we cause
    lastCommentClickRef.current = Date.now();
    // Deselect any selected tile — the comment is the focus now
    ui.setSelectedTileId('');
    // Always set pendingCommentId so the comment highlights visually.
    // If read-aloud starts later, it will jump to this comment.
    service.setPendingCommentId(commentId);
    if (service.isReadingPane("left")) {
      const idx = service.queue.findIndex(
        item => isCommentItem(item) && item.commentId === commentId
      );
      if (idx >= 0) {
        service.jumpToItem(idx);
      }
    }
  }, [stores, ui]);

  return (
    <div className="chat-list" data-testid="chat-list">
      {
        chatThreads?.map((commentThread: ChatCommentThread) => {
          const shouldBeFocused = commentThread.tileId === focusId;
          const isBeingRead = !!(currentReadItem
            && isCommentItem(currentReadItem)
            && currentReadItem.originTileId === commentThread.tileId);
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
              isFocused={shouldBeFocused || isBeingRead}
              readingCommentId={readingCommentId}
              pendingCommentId={pendingCommentId}
              onCommentClick={handleCommentClick}
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
          readingCommentId={readingCommentId}
          pendingCommentId={pendingCommentId}
          onCommentClick={handleCommentClick}
        />
      }
    </div>
  );
};

export const ChatThread = observer(_ChatThread);
