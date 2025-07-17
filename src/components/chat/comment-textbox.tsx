import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../hooks/use-stores";
import SendIcon from "../../assets/send-icon.svg";
import "../themes.scss";

interface IProps {
  activeNavTab?: string;
  numPostedComments: number;
  onPostComment?: (comment: string, tags: string[]) => void;
  showCommentTag?: boolean;
  commentTags?: Record<string, string>;
  tagPrompt?: string;
}

export const CommentTextBox: React.FC<IProps> = (props) => {
  const { activeNavTab, numPostedComments, onPostComment, showCommentTag, commentTags, tagPrompt } = props;
  const minTextAreaHeight = showCommentTag ? 100 : 35;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentTextAreaHeight, setCommentTextAreaHeight] = useState(minTextAreaHeight);
  const selectElt = useRef<HTMLSelectElement>(null);
  const [commentAdded, setCommentAdded] = useState(false);
  const [commentText, setCommentText] = useState("");
   //all the AI tags pertaining to one comment - length is 1 for now
  const [allTags, setAllTags] = useState([""]);
  const textareaStyle = {height: commentTextAreaHeight};

  const commentEmptyNoTags =  (!commentAdded && !showCommentTag);
  const postButtonClass = classNames("comment-footer-button", "themed", activeNavTab,
                                      { disabled: commentEmptyNoTags,
                                      "no-action": commentEmptyNoTags });

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
    if (!isEmpty || (showCommentTag && allTags[0] !== "" )){
      //do not post to Firestore if select tag is tagPrompt
      onPostComment?.(trimmedText, allTags);
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentAdded(false);
      setCommentText("");
      setAllTags((oldArray) => [""]); //select will go back to top choice (tagPrompt)
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

  const handleSelectDropDown = (val: string) => {
    if (tagPrompt && val !== tagPrompt){ //do not save comments with default tag
      setAllTags((oldArray) => [val]);
    }
    else {
      setAllTags((oldArray) => [""]);
    }
  };

  return (
    <div className="comment-textbox">
      <textarea
        className={classNames({"shift-down" : showCommentTag})}
        ref={textareaRef}
        style={textareaStyle}
        placeholder={placeholderText}
        value={commentText}
        data-testid="comment-textarea"
        onChange={handleCommentTextAreaChange}
        onKeyDown={handleCommentTextboxKeyDown}
      />
      {
        showCommentTag && commentTags &&
        <select
          ref={selectElt}
          data-test="comment-textbox-dropdown"
          onChange={(e) => {
            handleSelectDropDown(e.target.value);
          }}
          value={allTags[0]}
        >
          {
            tagPrompt &&
            <option key={"sel-ss"} value={tagPrompt}> { tagPrompt } </option>
          }
          {
            Object.keys(commentTags).map(key => {
              const value = commentTags[key];
              return (
                <option key={key} value={key}> {value} </option>
              );
            })
          }
        </select>
      }

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
