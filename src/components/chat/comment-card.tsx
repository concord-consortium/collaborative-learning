import React, { useCallback, useRef } from "react";
import classNames from "classnames";
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
import { isSectionPath, escapeKey, RatingValue } from "../../../shared/shared";
import { useCommentsCollectionPath } from "../../hooks/document-comment-hooks";
import { useUpdateCommentRating } from "../../hooks/use-update-comment-rating";
import { logCommentEvent } from "../../models/tiles/log/log-comment-event";
import type { PostCommentFn, DeleteCommentFn } from "./chat-panel";

import DeleteMessageIcon from "../../assets/icons/delete/delete-message-icon.svg";
import YesIcon from "../../assets/yes-icon.svg";
import NoIcon from "../../assets/no-icon.svg";
import NotSureIcon from "../../assets/not-sure-icon.svg";

import "./comment-card.scss";
import "../themes.scss";

function countRatings(ratings: Record<string, RatingValue> | undefined): Record<RatingValue, number> {
  const counts: Record<RatingValue, number> = { yes: 0, no: 0, notSure: 0 };
  if (ratings) {
    Object.values(ratings).forEach(v => { counts[v]++; });
  }
  return counts;
}

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  postedComments?: WithId<CommentDocument>[];
  onPostComment?: PostCommentFn;
  onDeleteComment?: DeleteCommentFn;
  focusDocument?: string;
  focusTileId?: string;
  isFocused?: boolean;
  onSelect?: () => void;
}

export const CommentCard: React.FC<IProps> = ({ activeNavTab, user, postedComments,
                                                onPostComment, onDeleteComment,
                                                focusDocument, focusTileId, isFocused, onSelect }) => {
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

  const updateRating = useUpdateCommentRating();
  const commentsPath = useCommentsCollectionPath(focusDocument || "");
  // Comments may be stored at either the network-prefixed path or the simplified path.
  // We need the simplified path as a fallback for rating updates.
  const simplifiedCommentsPath = focusDocument
    ? (isSectionPath(focusDocument)
      ? `curriculum/${escapeKey(focusDocument)}/comments`
      : `documents/${focusDocument}/comments`)
    : "";

  const ratingButtons: { value: RatingValue; label: string; icon: JSX.Element; testId: string }[] = [
    { value: "yes", label: "Yes", icon: <YesIcon />, testId: "rating-yes-button" },
    { value: "no", label: "No", icon: <NoIcon />, testId: "rating-no-button" },
    { value: "notSure", label: "Not Sure", icon: <NotSureIcon />, testId: "rating-not-sure-button" },
  ];

  const renderRatingButtons = (comment: WithId<CommentDocument>) => {
    const counts = countRatings(comment.ratings);
    const myRating = user?.id ? comment.ratings?.[user.id] : undefined;

    return (
      <div className="comment-ratings" data-testid="comment-rating-buttons">
        <div className="comment-ratings-header">
          Do you agree with {comment.name}?
        </div>
        <div className="comment-ratings-buttons">
          {ratingButtons.map(({ value, label, icon, testId }) => {
            const count = counts[value];
            return (
              <div
                key={value}
                role="button"
                aria-label={label}
                className={classNames("rating-button", { selected: myRating === value })}
                onClick={async (e) => {
                  e.stopPropagation();
                  const newValue = myRating === value ? undefined : value;
                  if ((commentsPath || simplifiedCommentsPath) && user) {
                    const primaryPath = `${commentsPath}/${comment.id}`;
                    const fallbackPath = `${simplifiedCommentsPath}/${comment.id}`;
                    try {
                      await updateRating(primaryPath, newValue);
                    } catch {
                      if (fallbackPath !== primaryPath) {
                        try {
                          await updateRating(fallbackPath, newValue);
                        } catch {
                          // Optionally log the error; ensure no unhandled rejection.
                        }
                      }
                    }
                    logCommentEvent({
                      focusDocumentId: focusDocument || "",
                      focusTileId,
                      commentText: "",
                      action: "rate",
                      commentId: comment.id,
                      ratingValue: newValue ?? "removed",
                    });
                  }
                }}
                data-testid={testId}
              >
                {icon} {label}
                {count > 0 && (
                  <span className="rating-count"
                        data-testid={`rating-${value === "notSure" ? "not-sure" : value}-count`}>
                    ({count})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Select this thread when clicking or pressing Enter/Space on the comment card
  const handleCardClick = useCallback(() => {
    onSelect?.();
  }, [onSelect]);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only respond when the card div itself is focused, not child elements (e.g. text input)
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect?.();
    }
  }, [onSelect]);

  return (
    <div className={classNames("comment-card", { selected: isFocused })}
         data-testid="comment-card" onClick={handleCardClick}
         tabIndex={0} onKeyDown={handleCardKeyDown}
         aria-label="Select associated tile">
      <div className={classNames("comment-card-content", { selected: isFocused })} data-testid="comment-card-content">
        {
          postedComments?.map((comment, idx) => {
            const commentUser = comment.uid;
            const isOwnComment = user?.id === commentUser;
            // can't delete comment until we have a valid server-generated id
            const shouldShowDeleteIcon = isOwnComment && !comment.id.startsWith("pending-");
            const linkedDocument = comment.linkedDocumentKey &&
              documents.getDocument(comment.linkedDocumentKey);

            // if tagPrompt was posted to Firestore our comment.tags should be [""]
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
                {renderRatingButtons(comment)}
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
        />
      </div>
    </div>
  );
};
