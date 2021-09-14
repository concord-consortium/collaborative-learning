import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import SendIcon from "../../assets/send-icon.svg";
import "../themes.scss";

interface IProps {
  activeNavTab?: string;
  numPostedComments: number;
  onPostComment?: (comment: string) => void;
}

const minTextAreaHeight = 35;

export const CommentTextBox: React.FC<IProps> = ({ activeNavTab, numPostedComments, onPostComment }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentTextAreaHeight, setCommentTextAreaHeight] = useState(minTextAreaHeight);
  const [commentAdded, setCommentAdded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const textareaStyle = {height: commentTextAreaHeight};
  const postButtonClass = classNames("comment-footer-button", "themed-negative", activeNavTab,
                                     { disabled: !commentAdded, "no-action": !commentAdded });
  // resize textarea when user deletes some text
  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = minTextAreaHeight + "px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + "px";
    }
  });

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
    // do not send post if text area is empty, only has spaces or new lines
    const content = commentText.trim().replace(/\s\s+/g, " ");
    if (!(content === "" || content === "\n" || content === " ")) {
      onPostComment?.(commentText);
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentAdded(false);
      setCommentText("");
    }
  };

  const handleCommentTextboxKeyDown = (event: React.KeyboardEvent) => {
    const content = commentText.trim().replace(/\s\s+/g, " ");
    switch(event.key) {
      case "Escape":
        setCommentTextAreaHeight(minTextAreaHeight);
        setCommentAdded(false);
        setCommentText("");
        break;
      case "Enter":
        if(event.shiftKey) {
          event.preventDefault();
          setCommentText(content+"\n");
        } else if (content === "" || content === "\n" || content === " ") {
          // do not send post if text area is empty, only has spaces or new lines
          event.preventDefault();
          break;
        } else {
          event.preventDefault();
          handlePostComment();
        }
        break;
    }
  };

  return (
    <div className="comment-textbox">
      <textarea
        ref={textareaRef}
        style={textareaStyle}
        placeholder={numPostedComments < 1 ? "Comment on this document...": "Reply..."}
        value={commentText}
        data-testid="comment-textarea"
        onChange={handleCommentTextAreaChange}
        onKeyDown={handleCommentTextboxKeyDown}
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
