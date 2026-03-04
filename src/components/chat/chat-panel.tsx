import React, { useCallback, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ILogComment, logCommentEvent } from "../../models/tiles/log/log-comment-event";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { ChatThread } from "./chat-thread";
import { makeChatThreads, sortCommentsInDocumentOrder } from "./chat-comment-thread";
import {
  useCommentsCollectionPath, useDocumentComments,
  useDocumentCommentsAtSimplifiedPath, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDeleteDocument, useFirestore } from "../../hooks/firestore-hooks";
import {
  useAppConfig, useCurriculumOrDocumentContent, useDocumentFromStore,
  useDocumentOrCurriculumMetadata, useStores
} from "../../hooks/use-stores";
import { getReadAloudService } from "../../models/services/read-aloud-service";
import { CommentedDocuments } from "./commented-documents";
import { getSimpleDocumentPath, IClientCommentParams } from "../../../shared/shared";
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

export const ChatPanel: React.FC<IProps> = observer(({ user, activeNavTab, focusDocument, focusTileId,
    onCloseChatPanel }) => {
  const stores = useStores();
  const { persistentUI } = stores;
  const isDocumentView = persistentUI.isDocumentsView;
  const documentMetadata = useDocumentOrCurriculumMetadata(focusDocument);
  const content = useCurriculumOrDocumentContent(focusDocument);
  const document = useDocumentFromStore(focusDocument);
  const appConfig = useAppConfig();
  const { unit } = stores;
  const ordering = content?.getTilesInDocumentOrder();
  // Ignore focusTileId if it doesn't belong to the focus document.
  // This prevents orphaned comments when a teacher clicks a tile in their own workspace
  // while viewing a student's document with the chat panel open.
  const validFocusTileId = focusTileId && ordering?.includes(focusTileId) ? focusTileId : undefined;
  // This looks in the prefixed location. Should now be used only for curriculum documents.
  const { data: comments } = useDocumentComments(focusDocument);
  // This looks in the unprefixed location, which is appropriate for all user documents.
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(focusDocument);
  const { playbackTime } = useNavTabPanelInfo();
  const allComments = useMemo(() => {
    return [...comments||[], ...simplePathComments||[]]
      .filter((comment) => playbackTime ? comment.createdAt <= playbackTime : true)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [comments, simplePathComments, playbackTime]);
  const { data: unreadComments } = useUnreadDocumentComments(focusDocument);
  const postedComments = content ? sortCommentsInDocumentOrder(allComments, content) : allComments;
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
        focusTileId: validFocusTileId,
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
        { document: documentMetadata, comment: { content: comment, tileId: validFocusTileId, tags, agreeWithAi } })
      : undefined;
  }, [documentMetadata, focusDocument, validFocusTileId, postCommentMutation, postedComments]);

  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  // the "Document" in "useDeleteDocument" refers to a Firestore document (not a CLUE document)
  const deleteCommentMutation = useDeleteDocument();

  const deleteComment = useCallback(async ({ commentId, commentText }: IDeleteCommentOptions) => {
    if (focusDocument) {
      const eventPayload: ILogComment = {
        focusDocumentId: focusDocument,
        focusTileId: validFocusTileId,
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
  }, [commentsPath, deleteCommentMutation, firestore, focusDocument, validFocusTileId]);

  const handleDocumentClick = () => {
    const newState = !persistentUI.isDocumentsView;
    persistentUI.setIsDocumentsView(newState);

    const service = getReadAloudService(stores);
    if (service.isReadingPane("left")) {
      if (newState) {
        // Switching TO Documents View — stop Read Aloud (immediate)
        service.stop("user");
      }
      // Switching TO Comments View — handled by reactive rebuild in ReadAloudButton
    }
  };

  const chatPanelTitle = isDocumentView ? "Documents" : "Comments";

  // Update the comments manager when new comments arrive via hooks.
  useEffect(() => {
    document?.commentsManager?.setComments(allComments);
  }, [document, allComments]);

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
          focusTileId={validFocusTileId}
          isDocumentView={isDocumentView}
        />
        :
        <div className="select-doc-message" data-testid="select-doc-message">
          {commentInstructions}
        </div>

      }
    </div>
  );
});
