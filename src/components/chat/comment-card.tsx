import React, { useCallback, useMemo, useRef } from "react";
import { UserModelType } from "../../models/stores/user";
import { CommentTextBox } from "./comment-textbox";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { getDisplayTimeDate } from "../../utilities/time";
import { useCautionAlert } from "../utilities/use-caution-alert";
import { useCurriculumOrDocumentContent, useStores } from "../../hooks/use-stores";
import { logDocumentViewEvent } from "../../models/document/log-document-event";
import { DocumentModelType } from "../../models/document/document";
import ChatAvatar from "./chat-avatar";
import WaitingMessage from "./waiting-message";
import { IAgreeWithAi, kAnalyzerUserParams } from "../../../shared/shared";
import type { PostCommentFn, DeleteCommentFn } from "./chat-panel";

import DeleteMessageIcon from "../../assets/icons/delete/delete-message-icon.svg";
import YesIcon from "../../assets/yes-icon.svg";
import NoIcon from "../../assets/no-icon.svg";
import NotSureIcon from "../../assets/not-sure-icon.svg";

import "./comment-card.scss";
import "../themes.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  postedComments?: WithId<CommentDocument>[];
  onPostComment?: PostCommentFn;
  onDeleteComment?: DeleteCommentFn;
  focusDocument?: string;
  focusTileId?: string;
}

export const CommentCard: React.FC<IProps> = ({ activeNavTab, user, postedComments,
                                                onPostComment, onDeleteComment,
                                                focusDocument, focusTileId }) => {
  const commentIdRef = useRef<string>();
  const commentContentRef = useRef<string>("");
  const { documents, persistentUI, sortedDocuments } = useStores();
  const content = useCurriculumOrDocumentContent(focusDocument);

  const alertContent = () => {
    return (
      <>
        <p>Delete this comment?</p>
        <p>This cannot be undone.</p>
      </>
    );
  };

  const handleConfirm = useCallback(() => {
    commentIdRef.current &&
      onDeleteComment?.({ commentId: commentIdRef.current, commentText: commentContentRef.current });
  }, [onDeleteComment]);

  const [showConfirmDeleteAlert] = useCautionAlert({
    className: "confirm-delete-alert",
    title: "Delete Comment",
    content: alertContent,
    confirmLabel: "Delete",
    onConfirm: handleConfirm
  });

  const handleDeleteComment = (commentId: string, commentContent: string) => {
    if (commentId) {
      commentIdRef.current = commentId;
      commentContentRef.current = commentContent;
      showConfirmDeleteAlert();
    }
  };

  const handleOpenLinkedDocument = (e: React.MouseEvent<HTMLAnchorElement>, document: DocumentModelType) => {
    e.preventDefault();
    persistentUI.toggleShowChatPanel(false);
    persistentUI.openResourceDocument(document, appConfig, user, sortedDocuments);
    logDocumentViewEvent(document);
  };

  const { appConfig } = useStores();
  const { showCommentTag, commentTags } = appConfig;

  const showWaitingMessage = !focusTileId || content?.isAwaitingRemoteComment;

  const showAgreeButtons = useMemo(() => {
    if (!postedComments || !user) {
      // no comments or user, so no agree buttons
      return false;
    }
    // findLastIndex isn't supported in our current compiler target (ES2015) so just reverse the array and use findIndex
    const reversedComments = [...postedComments].reverse();
    const lastAdaCommentIndex = reversedComments.findIndex((comment) => comment.uid === kAnalyzerUserParams.id);
    const lastUserAgreedCommentIndex = reversedComments.findIndex(
      (comment) => comment.uid === user?.id && comment.agreeWithAi // agreeWithAi is undefined/null when not set
    );
    if (lastAdaCommentIndex === -1) {
      return false; // no comments from Ada, so no agree buttons
    }
    if (lastUserAgreedCommentIndex === -1) {
      return true; // no comments from the user agreeing with Ada, so show agree buttons
    }
    // show agree buttons if the last Ada comment is after the last user agreed comment
    // note: < is used here as we have reversed the array
    return lastAdaCommentIndex < lastUserAgreedCommentIndex;
  }, [postedComments, user]);

  const renderAgreeWithAi = (comment: WithId<CommentDocument>) => {
    // agreeWithAi is an optional field, so we need to handle cases where it might be undefined/null
    const { value } = comment.agreeWithAi ?? { value: null };
    const messages: Record<IAgreeWithAi["value"], {text: string, icon: JSX.Element, testId: string}> = {
      yes: {text: "Yes, I agree with Ada!", icon: <YesIcon />, testId: "comment-agree-message-yes"},
      no: {text: "No, I disagree with Ada.", icon: <NoIcon />, testId: "comment-agree-message-no"},
      notSure: {text: "Not sure I agree with Ada.", icon: <NotSureIcon />, testId: "comment-agree-message-not-sure"},
    };
    const message = value && messages[value as IAgreeWithAi["value"]];
    if (!message) {
      return null; // no agree with AI message to display
    }
    return (
      <div className="comment-agree-message" data-testid="comment-agree-message">
        <div className="comment-agree-icon" data-testid="comment-agree-icon">{message.icon}</div>
        <div data-testid={message.testId}>{message.text}</div>
      </div>
    );
  };

  return (
    <div className="comment-card selected" data-testid="comment-card">
      <div className="comment-card-content selected" data-testid="comment-card-content">
        {
          postedComments?.map((comment, idx) => {
            const commentUser = comment.uid;
            const isOwnComment = user?.id === commentUser;
            // can't delete comment until we have a valid server-generated id
            const shouldShowDeleteIcon = isOwnComment && !comment.id.startsWith("pending-");
            const linkedDocument = comment.linkedDocumentKey &&
              documents.getDocument(comment.linkedDocumentKey);

            //if tagPrompt was posted to Firestore - for ex: SAS unit (where tagPrompt = "Select Student Strategy")
            //our comment.tags[0] should be [""]
            const isTagPrompt = comment.tags === undefined || comment.tags[0] === "";
            const displayTags = showCommentTag && !isTagPrompt && comment.tags && comment.tags.length > 0;

            return (

              <div key={idx} className="comment-thread" data-testid="comment-thread">
                <div className="comment-text-header">
                  <ChatAvatar uid={commentUser} isMe={isOwnComment} />
                  <div className="user-name">{comment.name}</div>
                  <div className="time-stamp">{getDisplayTimeDate(comment.createdAt.getTime())}</div>
                  {shouldShowDeleteIcon &&
                    <div className="delete-message-icon-container" data-testid="delete-message-button"
                          onClick={() => handleDeleteComment(comment.id, comment.content)}>
                      <DeleteMessageIcon />
                    </div>
                  }
                </div>
                {renderAgreeWithAi(comment)}
                {
                  displayTags &&
                  <div className="comment-dropdown-tag">
                    {
                      comment.tags?.map((tag) => {
                        return commentTags && (commentTags[tag]);
                      }).join(", ")
                    }
                  </div>
                }
                <div key={idx} className="comment-text" data-testid="comment">
                  {comment.content}
                  {linkedDocument &&
                      <a href="#" onClick={(e) => handleOpenLinkedDocument(e, linkedDocument)}>
                        {linkedDocument.title}
                      </a>
                  }
                </div>
              </div>
            );
          })
        }
        { showWaitingMessage && <WaitingMessage content={content} /> }
        <CommentTextBox
          activeNavTab={activeNavTab}
          onPostComment={onPostComment}
          numPostedComments={postedComments?.length || 0}
          showCommentTag={showCommentTag || false}
          commentTags={commentTags}
          showAgreeButtons={showAgreeButtons}
        />
      </div>
    </div>
  );
};
