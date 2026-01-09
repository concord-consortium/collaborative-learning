import React, { useCallback, useEffect, useState} from "react";
import classNames from "classnames";
import { ILogComment, logCommentEvent } from "../../models/tiles/log/log-comment-event";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { ChatThread } from "./chat-thread";
import { makeChatThreads} from "./chat-comment-thread";
import {
  useCommentsCollectionPath, useDocumentComments,
  useDocumentCommentsAtSimplifiedPath, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument, useFirestore } from "../../hooks/firestore-hooks";
import { useAppConfig, useCurriculumOrDocumentContent, useDBStore,
  useDocumentFromStore,
  useDocumentOrCurriculumMetadata, useStores } from "../../hooks/use-stores";
import { CommentedDocuments } from "./commented-documents";
import { getSimpleDocumentPath, IClientCommentParams, kAnalyzerUserParams } from "../../../shared/shared";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { AppConfigModelType } from "../../models/stores/app-config-model";
import { UnitModelType } from "../../models/curriculum/unit";
import { DocumentModelType } from "../../models/document/document";
import { useNavTabPanelInfo } from "../../hooks/use-nav-tab-panel-info";

import "./chat-panel.scss";

interface IPostCommentOptions {
  comment: IClientCommentParams["content"];
  tags?: IClientCommentParams["tags"];
  agreeWithAi?: IClientCommentParams["agreeWithAi"];
}
export type PostCommentFn = (options: IPostCommentOptions) => void;

interface IDeleteCommentOptions {
  commentId: string;
  commentText: string;
}
export type DeleteCommentFn = (options: IDeleteCommentOptions) => Promise<void>;

interface IProps {
  user?: UserModelType;
  activeNavTab: string;
  focusDocument?: string;
  focusTileId?: string;
  onCloseChatPanel:(show:boolean) => void;
}

function getDocTitle(document: DocumentModelType,
    unit: UnitModelType,
    appConfig: AppConfigModelType): string | undefined {
  return getDocumentDisplayTitle(unit, document, appConfig) || undefined;
}

export const ChatPanel: React.FC<IProps> = ({ user, activeNavTab, focusDocument, focusTileId, onCloseChatPanel }) => {
  const [isDocumentView, setIsDocumentView] = useState(false); // switches between "Comments View" vs "Document View"
  const [chatPanelTitle, setChatPanelTitle] = useState("Comments");
  const documentMetadata = useDocumentOrCurriculumMetadata(focusDocument);
  const content = useCurriculumOrDocumentContent(focusDocument);
  const document = useDocumentFromStore(focusDocument);
  const { firebase } = useDBStore();
  const appConfig = useAppConfig();
  const { unit } = useStores();
  const ordering = content?.getTilesInDocumentOrder();
  // This looks in the prefixed location. Should now be used only for curriculum documents.
  const { data: comments } = useDocumentComments(focusDocument);
  // This looks in the unprefixed location, which is appropriate for all user documents.
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  const { playbackTime } = useNavTabPanelInfo();
  const allComments = [...comments||[], ...simplePathComments||[]]
    .filter((comment) => playbackTime ? comment.createdAt <= playbackTime : true)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const documentComments = allComments?.filter(comment => comment.tileId == null);
  const allTileComments = allComments?.filter(comment=> comment.tileId != null);
  const commentsInDocumentOrder = ordering && allTileComments
    ? allTileComments.sort((a: any, b: any) => ordering.indexOf(a.tileId) - ordering.indexOf(b.tileId))
    : [];
  const postedComments = documentComments?.concat(commentsInDocumentOrder);
  const docTitle = document ? getDocTitle(document, unit, appConfig) : undefined;
  const commentThreads = makeChatThreads(postedComments, content, docTitle);
  const postCommentMutation = usePostDocumentComment();
  const firestore = useFirestore();

  const postComment = useCallback(({ comment, tags, agreeWithAi }: IPostCommentOptions) => {
    if (focusDocument) {
      const numComments = postedComments ? postedComments.length : 0;
      const focusDocumentId = focusDocument;
      const eventPayload: ILogComment = {
        focusDocumentId,
        focusTileId,
        isFirst: (numComments < 1),
        commentText: comment,
        action: "add",
        tags,
        agreeWithAi
      };
      logCommentEvent(eventPayload);
    }
    return documentMetadata
      ? postCommentMutation.mutate(
        { document: documentMetadata, comment: { content: comment, tileId: focusTileId, tags, agreeWithAi } })
      : undefined;
  }, [documentMetadata, focusDocument, focusTileId, postCommentMutation, postedComments]);

  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  // the "Document" in "useDeleteDocument" refers to a Firestore document (not a CLUE document)
  const deleteCommentMutation = useDeleteDocument();

  const deleteComment = useCallback(async ({ commentId, commentText }: IDeleteCommentOptions) => {
    if (focusDocument) {
      const eventPayload: ILogComment = {
        focusDocumentId: focusDocument,
        focusTileId,
        commentText,
        action: "delete"
      };
      logCommentEvent(eventPayload);
    } else {
      console.warn("deleteComment called with empty focusDocument");
      return;
    }

    // Check if the comment exists at the legacy path
    const primaryDocRef = firestore[0].doc(`${commentsPath}/${commentId}`);
    const primaryDocSnap = await primaryDocRef.get();

    if (primaryDocSnap.exists) {
      return deleteCommentMutation.mutate(`${commentsPath}/${commentId}`);
    } else {
      // Try the alternate (simplified) path
      const altCommentsPath = `${getSimpleDocumentPath(focusDocument)}/comments`;
      const altDocRef = firestore[0].doc(`${altCommentsPath}/${commentId}`);
      const altDocSnap = await altDocRef.get();

      if (altDocSnap.exists) {
        return deleteCommentMutation.mutate(`${altCommentsPath}/${commentId}`);
      } else {
        return undefined;
      }
    }
  }, [commentsPath, deleteCommentMutation, firestore, focusDocument, focusTileId]);

  const handleDocumentClick = () => {
    setIsDocumentView((prevState) => !prevState);
  };

  useEffect(()=>{ //switches title
    setChatPanelTitle(isDocumentView ? "Documents" : "Comments");
  }, [isDocumentView]);

  // AI evaluation is triggered when the document edit time is updated, so we can
  // remove the "Waiting..." message when we see a comment from AI analysis newer than
  // the document last edited time, and then post any queued exemplar comments.
  useEffect(() => {
    if (user && focusDocument && content?.awaitingAIAnalysis && documentComments?.length > 0) {
      const lastAIAnalysisComment = [...documentComments]
        .reverse()
        .find(comment => comment.uid === kAnalyzerUserParams.id);

      if (lastAIAnalysisComment?.createdAt) {
        firebase.getLastEditedTimestamp(user, focusDocument).then(
          async (docLastEditedTime) => {
            if (docLastEditedTime && lastAIAnalysisComment.createdAt > docLastEditedTime) {
              if (content.postQueuedExemplarComments) {
                await content.postQueuedExemplarComments();
              }
            }
            content.setAwaitingAIAnalysis(false);
          }
        ).catch(() => {
          // Ensure awaiting AI analysis state is cleared even if timestamp fetch fails.
          content.setAwaitingAIAnalysis(false);
       });
      }
    }
  }, [content, documentComments, firebase, focusDocument, user]);

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

  const theme = isDocumentView ? "student-work" : activeNavTab;
  const chatPanelClass = classNames("chat-panel", theme);

  return (
    <div className={chatPanelClass} data-testid="chat-panel">
      <ChatPanelHeader
        theme={theme}
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
        <ChatThread
          user={user}
          activeNavTab={activeNavTab}
          onPostComment={postComment}
          onDeleteComment={deleteComment}
          chatThreads={commentThreads}
          focusDocument={focusDocument}
          docTitle={docTitle}
          focusTileId={focusTileId}
          isDocumentView={isDocumentView}
        />
        :
        <div className="select-doc-message" data-testid="select-doc-message">
          {commentInstructions}
        </div>

      }
    </div>
  );
};
