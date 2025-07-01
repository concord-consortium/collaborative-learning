import React, { useCallback, useRef } from "react";
import { UserModelType } from "../../models/stores/user";
import { CommentTextBox } from "./comment-textbox";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { getDisplayTimeDate } from "../../utilities/time";
import { useCautionAlert } from "../utilities/use-caution-alert";
import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";
import DeleteMessageIcon from "../../assets/delete-message-icon.svg";
import { useCurriculumOrDocumentContent, useStores } from "../../hooks/use-stores";
import WaitingMessage from "./waiting-message";

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

  //appConfig holds showCommentTag, commentTags, tagPrompt fetched from "clue-curriculum" repository
  const { appConfig } = useStores();
  const { showCommentTag, commentTags, tagPrompt } = appConfig;

  return (
    <div className="comment-card selected" data-testid="comment-card">
      <div className="comment-card-content selected" data-testid="comment-card-content">
        {
          postedComments?.map((comment, idx) => {
            const userInitialBackgroundColor = ["#f79999", "#ffc18a", "#99d099", "#ff9", "#b2b2ff", "#efa6ef"];
            const commenterInitial = comment.name.charAt(0);
            const userInitialBackgroundColorIndex = parseInt(comment.uid, 10) % 6;
            const isOwnComment = user?.id === comment.uid;
            const shouldShowUserIcon = isOwnComment;
            // can't delete comment until we have a valid server-generated id
            const shouldShowDeleteIcon = isOwnComment && !comment.id.startsWith("pending-");
            const backgroundStyle = shouldShowUserIcon
                                      ? {backgroundColor: "white"}
                                      : {backgroundColor: userInitialBackgroundColor[userInitialBackgroundColorIndex]};

            //if tagPrompt was posted to Firestore - for ex: SAS unit (where tagPrompt = "Select Student Strategy")
            //our comment.tags should be [""]
            const isTagPrompt = (comment.tags && comment.tags[0] === "") || (comment.tags === undefined);

            return (

              <div key={idx} className="comment-thread" data-testid="comment-thread">
                <div className="comment-text-header">
                  <div className="user-icon" style={backgroundStyle}>
                    { shouldShowUserIcon ? <UserIcon /> : commenterInitial }
                  </div>
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
                  showCommentTag && !isTagPrompt &&
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
                </div>
              </div>
            );
          })
        }
        <WaitingMessage content={content} />
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
