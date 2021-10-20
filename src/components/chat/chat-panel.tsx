import React, { useCallback } from "react";
import { LogEventName, Logger } from "../../lib/logger";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useCommentsCollectionPath, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import { useDocumentOrCurriculumMetadata, useDocumentFromStore } from "../../hooks/use-stores";
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
  const focusStoreDocument = useDocumentFromStore(focusDocument);

  const focusDocumentRef = useCurrent(focusDocument);
  const focusStoreDocumentRef = useCurrent(focusStoreDocument);
  const focusTileIdRef = useCurrent(focusTileId);

  const postComment = useCallback((comment: string) => {
    if (focusDocument) {
      const numComments = postedComments ? postedComments.length : 0;
      const focusDocumentId = focusDocument;
      const eventPayload = {
        focusDocumentId,
        focusTileId,
        isFirst: (numComments < 1),
        commentText: comment,
        isAddingAComment: true
      };
      Logger.logCommentEvent(eventPayload);
    }

    return document
      ? postCommentMutation.mutate({ document, comment: { content: comment, tileId: focusTileId } })
      : undefined;
  }, [document, focusDocument, focusStoreDocument, focusTileId, postCommentMutation, postedComments]);

  const commentsPathRef = useCurrent(useCommentsCollectionPath(focusDocument || ""));
  const deleteCommentMutation = useDeleteDocument();

  const deleteComment = useCallback((commentId: string, commentText: string) => {
    if (focusDocumentRef.current) {
      const eventPayload = {
        focusDocumentId: focusDocumentRef.current,
        focusTileId: (focusTileIdRef && focusTileIdRef.current) || undefined,
        isFirst: true, // NO-OP
        commentText,
        isAddingAComment: false
      };
      Logger.logCommentEvent(eventPayload);
    }
    return commentsPathRef.current
      ? deleteCommentMutation.mutate(`${commentsPathRef.current}/${commentId}`)
      : undefined;
  }, [commentsPathRef, deleteCommentMutation, focusDocumentRef, focusStoreDocumentRef, focusTileIdRef]);

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
