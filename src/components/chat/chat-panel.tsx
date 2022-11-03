import React, { useCallback, useEffect, useState} from "react";
import { ILogComment, Logger } from "../../lib/logger";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { ChatThread } from "./chat-thread";
import { makeChatThreads} from "./chat-comment-thread";
import {
  useCommentsCollectionPath, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import {useCurriculumOrDocumentContent, useDocumentOrCurriculumMetadata } from "../../hooks/use-stores";
import { CommentedDocuments } from "./commented-documents";
import { CurriculumDocument } from "../../lib/firestore-schema";
import { ICurriculumMetadata, IDocumentMetadata, isCurriculumMetadata } from "../../../functions/src/shared";

import "./chat-panel.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab: string;
  focusDocument?: string;
  focusTileId?: string;
  onCloseChatPanel:(show:boolean) => void;
}

let storedDocument: IDocumentMetadata | ICurriculumMetadata;

export const ChatPanel: React.FC<IProps> = ({ user, activeNavTab, focusDocument, focusTileId, onCloseChatPanel }) => {

  const document = useDocumentOrCurriculumMetadata(focusDocument);
  if ( isCurriculumMetadata(document)){ //we always pass storedDocument into <CommentedDocuments>
    storedDocument = document;
  }
  const content = useCurriculumOrDocumentContent(focusDocument);
  const ordering = content?.getTilesInDocumentOrder();
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const documentComments = comments?.filter(comment => comment.tileId == null);
  const allTileComments = comments?.filter(comment=> comment.tileId != null);
  const commentsInDocumentOrder = ordering && allTileComments
    ? allTileComments.sort((a: any, b: any) => ordering.indexOf(a.tileId) - ordering.indexOf(b.tileId))
    : [];
  const postedComments = documentComments?.concat(commentsInDocumentOrder);
  const commentThreads = makeChatThreads(postedComments, content);
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

  const [isDocumentView, setIsDocumentView] = useState(false); // switches between "Comments View" vs "Document View"
  const [chatPanelTitle, setChatPanelTitle] = useState("Comments");

  const handleDocumentClick = () => {
    setIsDocumentView((prevState) => !prevState);
  };

  useEffect(()=>{ //switches title
    setChatPanelTitle(isDocumentView ? "Documents" : "Comments");
  }, [isDocumentView]);

  const newCommentCount = unreadComments?.length || 0;

  return (
    <div className={`chat-panel ${activeNavTab}`} data-testid="chat-panel">
      <ChatPanelHeader
        activeNavTab={activeNavTab}
        newCommentCount={newCommentCount}
        onCloseChatPanel={onCloseChatPanel}
        handleDocView={handleDocumentClick}
        chatPanelTitle={chatPanelTitle}
      />
      {
        isDocumentView ?
        <CommentedDocuments
          user={user}
          documentObj={storedDocument as unknown as CurriculumDocument}
          handleDocView={handleDocumentClick}
        />
        :
        focusDocument ?
        <ChatThread
          user={user}
          activeNavTab={activeNavTab}
          onPostComment={postComment}
          onDeleteComment={deleteComment}
          chatThreads={commentThreads}
          focusDocument={focusDocument}
          focusTileId={focusTileId}
          isDocumentView={isDocumentView}
        />
        :
        <div className="select-doc-message" data-testid="select-doc-message">
          Open a document to begin or view comment threads
        </div>

      }
    </div>
  );
};
