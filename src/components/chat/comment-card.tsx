import React, { useRef } from "react";
import { UserModelType } from "../../models/stores/user";
import { CommentTextBox } from "./comment-textbox";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { getDisplayTimeDate } from "../../utilities/time";
import { useCautionAlert } from "../utilities/use-caution-alert";
import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";
import DocumentCommentIcon from "../../assets/document-id.svg";
import DeleteMessageIcon from "../../assets/delete-message-icon.svg";
import "./comment-card.scss";
import "../themes.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  postedComments?: WithId<CommentDocument>[];
  onPostComment?: (comment: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export const CommentCard: React.FC<IProps> = ({ activeNavTab, user, postedComments,
                                                onPostComment, onDeleteComment }) => {
  const commentIdRef = useRef<string>();
  const alertContent = () => {
    return (
      <>
        <p>Delete this message?</p>
        <p>This cannot be undone.</p>
      </>
    );
  };
  const [showConfirmDeleteAlert] = useCautionAlert({
    className: "confirm-delete-alert",
    title: "Delete Message",
    content: alertContent,
    confirmLabel: "Delete",
    onConfirm: () => commentIdRef.current && onDeleteComment?.(commentIdRef.current)
  });

  const handleDeleteComment = (commentId: string) => {
    if (commentId) {
      commentIdRef.current = commentId;
      showConfirmDeleteAlert();
    }
  };

  const renderThreadHeader = () => {
    const teacherInitial = user?.name.charAt(0);
    return (
      <div className="comment-card-header comment-select" data-testid="comment-card-header">
        {postedComments && postedComments.length < 1
          ? <DocumentCommentIcon className="new-thread-header-icon" data-testid="document-comment-icon"/>
          : <div className="initial" data-testid="teacher-initial">{teacherInitial}</div>
        }
      </div>
    );
  };

  return (
    <div className={`comment-card selected`} data-testid="comment-card">
      {renderThreadHeader()}
      {postedComments?.map((comment, idx) => {
          const userInitialBackgroundColor = ["#f79999", "#ffc18a", "#99d099", "#ff9", "#b2b2ff", "#efa6ef"];
          const commenterInitial = comment.name.charAt(0);
          const userInitialBackgroundColorIndex = parseInt(comment.uid, 10) % 6;
          const isCurrentUserComment = user?.id === comment.uid;
          const backgroundStyle = isCurrentUserComment
                                    ? {backgroundColor: "white"}
                                    : {backgroundColor: userInitialBackgroundColor[userInitialBackgroundColorIndex]};
          return (
            <div key={idx} className="comment-thread" data-testid="comment-thread">
              <div className="comment-text-header">
                <div className="user-icon" style={backgroundStyle}>
                  {isCurrentUserComment ? <UserIcon /> : commenterInitial}
                </div>
                <div className="user-name">{comment.name}</div>
                <div className="time-stamp">{getDisplayTimeDate(comment.createdAt.getTime())}</div>
                {isCurrentUserComment &&
                  <div className="delete-message-icon-container" data-testid="delete-message-button"
                        onClick={() => handleDeleteComment(comment.id)}>
                    <DeleteMessageIcon />
                  </div>
                }
              </div>
              <div key={idx} className="comment-text" data-testid="comment">{comment.content}</div>
            </div>
          );
        })
      }
      <CommentTextBox
        activeNavTab={activeNavTab}
        onPostComment={onPostComment}
        numPostedComments={postedComments?.length || 0}
      />
    </div>
  );
};
