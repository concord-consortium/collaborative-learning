import classNames from "classnames";
import React, { useState } from "react";
import SendIcon from "../../assets/send-icon.svg";
import "../themes.scss";

interface IProps {
  activeNavTab?: string;
  numPostedComments: number;
  onPostComment?: (comment: string) => void;
}

const minTextAreaHeight = 35;

export const CommentTextBox: React.FC<IProps> = ({ activeNavTab, numPostedComments, onPostComment }) => {
  const [commentTextAreaHeight, setCommentTextAreaHeight] = useState(minTextAreaHeight);
  const [commentAdded, setCommentAdded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const textareaStyle = {height: commentTextAreaHeight};
  const postButtonClass = classNames("comment-footer-button", "themed-negative", activeNavTab,
                                     { disabled: !commentAdded, "no-action": !commentAdded });

  const handleCommentTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    const targetText = target.value;
    if (!targetText) {
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentAdded(false);
      setCommentText("");
    } else {
      setCommentTextAreaHeight(target.scrollHeight);
      setCommentAdded(true);
      setCommentText(targetText);
    }
  };

  const handleCancelPost = () => {
    setCommentTextAreaHeight(minTextAreaHeight);
    setCommentAdded(false);
    setCommentText("");
  };

  const handlePostComment = () => {
    onPostComment?.(commentText);
    setCommentTextAreaHeight(minTextAreaHeight);
    setCommentAdded(false);
    setCommentText("");
  };

  const handleEscKey = (event: React.KeyboardEvent) => {
    if(event.key === "Escape") {
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentAdded(false);
      setCommentText("");
    }
  };

  return (
    <div className="comment-textbox">
      <textarea
        style={textareaStyle}
        placeholder={numPostedComments < 1 ? "Comment on this document...": "Reply..."}
        value={commentText}
        data-testid="comment-textarea"
        onChange={handleCommentTextAreaChange}
        onKeyDown={handleEscKey}
      />
      <div className="comment-textbox-footer">
        <div className="comment-footer-button cancel"
              onClick={handleCancelPost}
              data-testid="comment-cancel-button">
          Cancel
        </div>
        <div className={postButtonClass} onClick={handlePostComment} data-testid="comment-post-button">
          <SendIcon />
          Post
        </div>
      </div>
    </div>
  );
};
