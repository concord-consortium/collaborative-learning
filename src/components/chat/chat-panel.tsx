import React, { useCallback } from "react";
import { LogEventName, Logger } from "../../lib/logger";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useCommentsCollectionPath, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import { useDocumentOrCurriculumMetadata, useUIStore } from "../../hooks/use-stores";
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
  const postComment = useCallback((comment: string) => {
    if (document) {
      const numComments = postedComments ? postedComments.length : 0;
      const event = (ui.selectedTileIds.length === 0 && numComments < 1)
        ? LogEventName.CHAT_PANEL_ADD_COMMENT_FOR_DOCUMENT
        : ui.selectedTileIds.length !== 0 && numComments < 1
          ? LogEventName.CHAT_PANEL_ADD_COMMENT_FOR_TILE
          : LogEventName.CHAT_PANEL_ADD_COMMENT_RESPONSE;
      Logger.log(event);
    }
    return document
            ? postCommentMutation.mutate({ document, comment: { content: comment, tileId: focusTileId } })
            : undefined;
  }, [document, focusTileId, postCommentMutation]);
  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  const deleteCommentMutation = useDeleteDocument();
  const deleteComment = useCallback((commentId: string) => {
    if (document) {
      Logger.log(LogEventName.CHAT_PANEL_DELETE_COMMENT);
    }
    return document
      ? deleteCommentMutation.mutate(`${commentsPath}/${commentId}`)
      : undefined;
  }, [document, deleteCommentMutation, commentsPath]);

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
