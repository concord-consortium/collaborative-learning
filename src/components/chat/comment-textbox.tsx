import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../hooks/use-stores";
import SendIcon from "../../assets/send-icon.svg";
import "../themes.scss";

interface IProps {
  activeNavTab?: string;
  numPostedComments: number;
  onPostComment?: (comment: string) => void;
  showCommentTag?: boolean;
  commentTags?: string[];
}

const minTextAreaHeight = 100;

export const CommentTextBox: React.FC<IProps> = (props) => {
  const { activeNavTab, numPostedComments, onPostComment, showCommentTag, commentTags} = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentTextAreaHeight, setCommentTextAreaHeight] = useState(minTextAreaHeight);
  const selectElt = useRef<HTMLSelectElement>(null);
  const [commentAdded, setCommentAdded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const textareaStyle = {height: commentTextAreaHeight};
  const postButtonClass = classNames("comment-footer-button", "themed-negative", activeNavTab,
                                     { disabled: !commentAdded, "no-action": !commentAdded });
  const ui = useUIStore();
  // resize textarea when user deletes some text
  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.style.height = minTextAreaHeight + "px"; //needed to resize text area when user partial delete
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = textareaRef.current?.value !== ""
                                          ? scrollHeight + "px" : minTextAreaHeight + "px";
    }
  });

  const trimContent = (content: string) => {
    const trimmed = content.trim().replace(/\s+\n/g, "\n");
    const isEmpty = !trimmed || (trimmed === "\n") || (trimmed === " ");
    return [trimmed, isEmpty] as const;
  };

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
    const [trimmedText, isEmpty] = trimContent(commentText);
    if (!isEmpty) {
      onPostComment?.(trimmedText);
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentAdded(false);
      setCommentText("");
    }
  };

  const handleCommentTextboxKeyDown = (event: React.KeyboardEvent) => {
    const [trimmedText, isEmpty] = trimContent(commentText);
    switch(event.key) {
      case "Escape":
        setCommentTextAreaHeight(minTextAreaHeight);
        setCommentAdded(false);
        setCommentText("");
        break;
      case "Enter":
        if(event.shiftKey) {
          event.preventDefault();
          setCommentText(trimmedText+"\n");
        } else if (isEmpty) {
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

  const placeholderText = ui.selectedTileIds.length === 0 && numPostedComments < 1
                            ? "Comment on this document..."
                            : ui.selectedTileIds.length !== 0 && numPostedComments < 1
                              ? "Comment on this tile..."
                              : "Reply...";

  console.log("comment-textbox:", commentTags);

  return (
    <div className="comment-textbox">
      <textarea
        ref={textareaRef}
        style={textareaStyle}
        placeholder={placeholderText}
        value={commentText}
        data-testid="comment-textarea"
        onChange={handleCommentTextAreaChange}
        onKeyDown={handleCommentTextboxKeyDown}
      />

      <select
        ref={selectElt}
        data-test="comment-textbox-dropdown"
        onChange={e => {
          console.log("changed to e.value:", e.target.value);
        }}
      >
        {
          showCommentTag && commentTags &&
          commentTags.map((option, idx) => {
            console.log("idx:", idx);
            const key = `tag${idx}` as keyof typeof commentTags;
            const value = commentTags[key] as string;
            return (
              <option key={option} value={value}>{value}</option>
            );
          })
        }
      </select>

      <div className="comment-textbox-footer">
        <div className="comment-footer-button cancel"
              onClick={handleCancelPost}
              data-testid="comment-cancel-button">
          Cancel
        </div>
        <div
          className={postButtonClass}
          onClick={handlePostComment}
          data-testid="comment-post-button"
        >
          <SendIcon />
          Post
        </div>
      </div>
    </div>
  );
};
