import React, { useCallback, useEffect, useState} from "react";
import { ILogComment, logCommentEvent } from "../../models/tiles/log/log-comment-event";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { ChatThread } from "./chat-thread";
import { makeChatThreads} from "./chat-comment-thread";
import {
  useCommentsCollectionPath, useDocumentComments,
  useDocumentCommentsAtSimplifiedPath, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument } from "../../hooks/firestore-hooks";
import { useCurriculumOrDocumentContent, useDocumentOrCurriculumMetadata } from "../../hooks/use-stores";
import { CommentedDocuments } from "./commented-documents";
import WaitingMessage from "./waiting-message";

import "./chat-panel.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab: string;
  focusDocument?: string;
  focusTileId?: string;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ user, activeNavTab, focusDocument, focusTileId, onCloseChatPanel }) => {
  const [isDocumentView, setIsDocumentView] = useState(false); // switches between "Comments View" vs "Document View"
  const [chatPanelTitle, setChatPanelTitle] = useState("Comments");
  const document = useDocumentOrCurriculumMetadata(focusDocument);
  const content = useCurriculumOrDocumentContent(focusDocument);
  const ordering = content?.getTilesInDocumentOrder();
  const { data: comments } = useDocumentComments(focusDocument);
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  const allComments = [...comments||[], ...simplePathComments||[]]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const documentComments = allComments?.filter(comment => comment.tileId == null);
  const allTileComments = allComments?.filter(comment=> comment.tileId != null);
  const commentsInDocumentOrder = ordering && allTileComments
    ? allTileComments.sort((a: any, b: any) => ordering.indexOf(a.tileId) - ordering.indexOf(b.tileId))
    : [];
  const postedComments = documentComments?.concat(commentsInDocumentOrder);
  const commentThreads = makeChatThreads(postedComments, content);
  const postCommentMutation = usePostDocumentComment();

  const postComment = useCallback((comment: string, tags?: string[]) => {
    if (focusDocument) {
      const numComments = postedComments ? postedComments.length : 0;
      const focusDocumentId = focusDocument;
      const eventPayload: ILogComment = {
        focusDocumentId,
        focusTileId,
        isFirst: (numComments < 1),
        commentText: comment,
        action: "add",
        tags
      };
      logCommentEvent(eventPayload);
    }
    return document
      ? postCommentMutation.mutate({ document, comment: { content: comment, tileId: focusTileId, tags } })
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
      logCommentEvent(eventPayload);
    }
    return commentsPath
      ? deleteCommentMutation.mutate(`${commentsPath}/${commentId}`)
      : undefined;
  }, [commentsPath, deleteCommentMutation, focusDocument, focusTileId]);

  const handleDocumentClick = () => {
    setIsDocumentView((prevState) => !prevState);
  };

  useEffect(()=>{ //switches title
    setChatPanelTitle(isDocumentView ? "Documents" : "Comments");
  }, [isDocumentView]);

  // Remove the "Waiting..." message when a new comment appears or the document changes.
  // This could have false positives (since it acts on any change to the list of comments),
  // but since the message should only be shown for a few seconds, it's low risk.
  useEffect(() => {
    content?.setAwaitingAIAnalysis(false);
  }, [content, documentComments]);

  const newCommentCount = unreadComments?.length || 0;
  const isStudentWorkspace = activeNavTab === "student-work";
  const commentInstructions =
    isStudentWorkspace ?
    <>
      <p>You cannot make comments on groups.</p>
      <br></br>
      <p>Choose a student in the group to begin or view comment threads.</p>
    </>
    :
    "Open a document to begin or view comment threads";

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
          handleDocView={handleDocumentClick}
        />
        :
        focusDocument ?
        <>
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
          <WaitingMessage content={content} />
        </>
        :
        <div className="select-doc-message" data-testid="select-doc-message">
          {commentInstructions}
        </div>

      }
    </div>
  );
};
