import React, { useCallback } from "react";
import { LogEventName, Logger } from "../../lib/logger";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useCommentsCollectionPath, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import { useDocumentOrCurriculumMetadata, useUIStore, useDocumentFromStore } from "../../hooks/use-stores";
import { useCurrent } from "../../hooks/use-current";
import "./chat-panel.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab: string;
  focusDocument?: string;
  focusTileId?: string;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ user, activeNavTab, focusDocument, focusTileId, onCloseChatPanel }) => {
  const document = useDocumentOrCurriculumMetadata(focusDocument);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading, data: comments } = useDocumentComments(focusDocument);
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const documentComments = comments?.filter(comment => comment.tileId == null);
  const tileComments = comments?.filter(comment => comment.tileId === focusTileId);
  const postedComments = focusTileId ? tileComments : documentComments;
  const postCommentMutation = usePostDocumentComment();
  const ui = useUIStore();
  const focusStoreDocument = useDocumentFromStore(focusDocument);

  const focusDocumentRef = useCurrent(focusDocument);
  const focusTileIdRef = useCurrent(focusTileId);

  const postComment = useCallback((comment: string) => {
    if (focusDocument) {
      const commentTile = focusTileId && focusStoreDocument?.content?.getTile(focusTileId);
      const numComments = postedComments ? postedComments.length : 0;
      if (!focusTileId) {
        if (focusStoreDocument) {
          Logger.logDocumentEvent(numComments < 1
            ? LogEventName.CHAT_PANEL_ADD_INITIAL_COMMENT_FOR_DOCUMENT
            : LogEventName.CHAT_PANEL_ADD_RESPONSE_COMMENT_FOR_DOCUMENT,
            focusStoreDocument, comment);
        }
      } else {
        if (commentTile) {
          Logger.logTileEvent(numComments < 1
            ? LogEventName.CHAT_PANEL_ADD_INITIAL_COMMENT_FOR_TILE
            : LogEventName.CHAT_PANEL_ADD_RESPONSE_COMMENT_FOR_TILE,
            commentTile, undefined, comment);
        }
      }
    }

    return document
      ? postCommentMutation.mutate({ document, comment: { content: comment, tileId: focusTileId } })
      : undefined;
  }, [document, focusTileId, postCommentMutation, postedComments, focusDocument, focusStoreDocument,
    ui.selectedTileIds.length]);

  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  const deleteCommentMutation = useDeleteDocument();
  const deleteComment = useCallback((commentId: string, commentText: string) => {
    if (focusDocumentRef.current) {
      if (!focusTileIdRef.current) {
        if (focusStoreDocument) {
          Logger.logDocumentEvent(LogEventName.CHAT_PANEL_DELETE_COMMENT_FOR_DOCUMENT, focusStoreDocument, commentText);
        }
      } else {
        const commentTile = focusStoreDocument?.content?.getTile(focusTileIdRef.current);
        if (commentTile) {
          Logger.logTileEvent(LogEventName.CHAT_PANEL_DELETE_COMMENT_FOR_TILE, commentTile, undefined, commentText);
        }
      }
    }

    return document
      ? deleteCommentMutation.mutate(`${commentsPath}/${commentId}`)
      : undefined;
  }, [document, deleteCommentMutation, commentsPath, focusStoreDocument, ui.selectedTileIds.length, focusDocumentRef,
    focusTileIdRef]);

  const newCommentCount = unreadComments?.length || 0;

  return (
    <div className={`chat-panel ${activeNavTab}`} data-testid="chat-panel">
      <ChatPanelHeader activeNavTab={activeNavTab} newCommentCount={newCommentCount}
                       onCloseChatPanel={onCloseChatPanel} />
      {focusDocument
        ? <CommentCard
            user={user}
            activeNavTab={activeNavTab}
            onPostComment={postComment}
            onDeleteComment={deleteComment}
            postedComments={postedComments}
            focusDocument={focusDocument}
            focusTileId={focusTileId}
          />
        : <div className="select-doc-message" data-testid="select-doc-message">
            Open a document to begin or view comment threads
          </div>
      }
    </div>
  );
};
