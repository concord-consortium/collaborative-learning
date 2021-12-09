import React, { useCallback } from "react";
import { ILogComment, Logger } from "../../lib/logger";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useCommentsCollectionPath, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import { useDocumentOrCurriculumMetadata } from "../../hooks/use-stores";
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
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const documentComments = comments?.filter(comment => comment.tileId == null);
  const tileComments = comments?.filter(comment => comment.tileId === focusTileId);
  const postedComments = focusTileId ? tileComments : documentComments;
  const postCommentMutation = usePostDocumentComment();

  const postComment = useCallback((comment: string) => {
    if (focusDocument) {
      const numComments = postedComments ? postedComments.length : 0;
      const focusDocumentId = focusDocument;
      const eventPayload: ILogComment = {
        focusDocumentId,
        focusTileId,
        isFirst: (numComments < 1),
        commentText: comment,
        action: "add"
      };
      Logger.logCommentEvent(eventPayload);
    }

    return document
      ? postCommentMutation.mutate({ document, comment: { content: comment, tileId: focusTileId } })
      : undefined;
  }, [document, focusDocument, focusTileId, postCommentMutation, postedComments]);

  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  // the "Document" in "useDeleteDocument" refers to a Firestore document (not a CLUE document)
  const deleteCommentMutation = useDeleteDocument();

  const deleteComment = useCallback((commentId: string, commentText: string) => {
    if (focusDocument) {
      const eventPayload: ILogComment = {
        focusDocumentId: focusDocument,
        focusTileId,
        commentText,
        action: "delete"
      };
      Logger.logCommentEvent(eventPayload);
    }
    return commentsPath
      ? deleteCommentMutation.mutate(`${commentsPath}/${commentId}`)
      : undefined;
  }, [commentsPath, deleteCommentMutation, focusDocument, focusTileId]);

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
