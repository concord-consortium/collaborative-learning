import React, { useCallback, useRef } from "react";
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

import DeleteMessageIcon from "../../assets/delete-message-icon.svg";

import "./comment-card.scss";
import "../themes.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  postedComments?: WithId<CommentDocument>[];
  onPostComment?: (comment: string, tags: string[]) => void;
  onDeleteComment?: (commentId: string, commentContent: string) => void;
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
    commentIdRef.current && onDeleteComment?.(commentIdRef.current, commentContentRef.current);
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
    persistentUI.openResourceDocument(document, user, sortedDocuments);
    logDocumentViewEvent(document);
  };

  //appConfig holds showCommentTag, commentTags, tagPrompt fetched from "clue-curriculum" repository
  const { appConfig } = useStores();
  const { showCommentTag, commentTags, tagPrompt } = appConfig;

  const showWaitingMessage = !focusTileId || content?.awaitingAIAnalysis;

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
            //our comment.tags should be [""]
            const isTagPrompt = (comment.tags && comment.tags[0] === "") || (comment.tags === undefined);
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
          tagPrompt={tagPrompt}
        />
      </div>
    </div>
  );
};
