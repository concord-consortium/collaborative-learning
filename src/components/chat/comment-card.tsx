import React from "react";
import { UserModelType } from "../../models/stores/user";
import { CommentTextBox } from "./comment-textbox";
import UserIcon from "../../assets/icons/clue-dashboard/teacher-student.svg";
import DocumentCommentIcon from "../../assets/document-id.svg";
import "./comment-card.scss";
import "../themes.scss";
import { ICommentData } from "./chat-panel";

interface IProps {
  user?: UserModelType;
  activeNavTab?: string;
  postedComments?: ICommentData[]
  onPostComment?: (comment: string) => void;
}

export const CommentCard: React.FC<IProps> = ({ activeNavTab, user, postedComments, onPostComment }) => {
   const renderThreadHeader = () => {
    const teacherInitial = user?.name.charAt(0);
    return (
      <div className={`comment-card-header ${activeNavTab}`} data-testid="comment-card-header">
        {postedComments && postedComments.length < 1
          ? <DocumentCommentIcon className="new-thread-header-icon" data-testid="document-comment-icon"/>
          : <div className="initial" data-testid="teacher-initial">{teacherInitial}</div>
        }
      </div>
    );
  };

  return (
    <div className={`comment-card ${activeNavTab}`} data-testid="comment-card">
      {renderThreadHeader()}
      { postedComments?.map((comment, idx) => {
          const userInitialBackgroundColor = ["#f79999", "#ffc18a", "#99d099", "#ff9", "#b2b2ff", "#efa6ef"];
          const commenterInitial = comment.user.name.charAt(0);
          const userInitialBackgroundColorIndex = parseInt(comment.user.id, 10) % 6;
          const backgroundStyle = user?.id === comment.user.id
                                    ? {backgroundColor: "white"}
                                    : {backgroundColor: userInitialBackgroundColor[userInitialBackgroundColorIndex]};
          return (
            <div key={idx} className="comment-thread" data-testid="comment-thread">
              <div className="comment-text-header">
                <div className="user-icon" style={backgroundStyle}>
                  {user?.id === comment.user.id ? <UserIcon />
                                                : commenterInitial
                  }
                </div>
                <div className="user-name">{comment.user.name}</div>
                <div className="time-stamp">{comment.timePosted}</div>
                <div className="menu"></div>
              </div>
              <div key={idx} className="comment-text" data-testid="comment">{comment.comment}</div>
            </div>
          );
        })
      }
      <CommentTextBox
        activeNavTab={activeNavTab}
        onPostComment={onPostComment}
        numPostedComments={postedComments?.length || 0} />
    </div>
  );
};
