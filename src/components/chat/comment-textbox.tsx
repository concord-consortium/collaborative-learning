import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import type { IAgreeWithAi } from "shared/shared";
import { useUIStore } from "../../hooks/use-stores";
import { getTermOverride } from "../../utilities/translation/translate";
import type { PostCommentFn } from "./chat-panel";

import SendIcon from "../../assets/send-icon.svg";
import NoIcon from "../../assets/no-icon.svg";
import NotSureIcon from "../../assets/not-sure-icon.svg";
import YesIcon from "../../assets/yes-icon.svg";

import "../themes.scss";

interface IProps {
  activeNavTab?: string;
  numPostedComments: number;
  onPostComment?: PostCommentFn;
  showCommentTag?: boolean;
  commentTags?: Record<string, string>;
  showAgreeButtons?: boolean;
}

export const CommentTextBox: React.FC<IProps> = (props) => {
  const { activeNavTab, numPostedComments, onPostComment, showCommentTag, commentTags, showAgreeButtons } = props;
  const tagPrompt = getTermOverride("strategy");
  const minTextAreaHeight =
    showCommentTag && showAgreeButtons ? 120 :
    showCommentTag || showAgreeButtons ? 100 :
    35;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentTextAreaHeight, setCommentTextAreaHeight] = useState(minTextAreaHeight);
  const selectElt = useRef<HTMLSelectElement>(null);
  const [commentText, setCommentText] = useState("");
   //all the AI tags pertaining to one comment - length is 1 for now
  const [allTags, setAllTags] = useState([""]);
  const [agreeWithAi, setAgreeWithAi] = useState<IAgreeWithAi|undefined>();
  const textareaStyle = {height: commentTextAreaHeight};

  const trimContent = (content: string) => {
    const trimmed = content.trim().replace(/\s+\n/g, "\n");
    const isEmpty = !trimmed || (trimmed === "\n") || (trimmed === " ");
    return [trimmed, isEmpty] as const;
  };

  const hasContentToPost = () => {
    const [, isEmpty] = trimContent(commentText);
    return !isEmpty || (showCommentTag && allTags[0] !== "");
  };

  const commentEmptyNoTags = !hasContentToPost();
  const postButtonClass = classNames("comment-footer-button", "post","themed", activeNavTab,
                                      { disabled: commentEmptyNoTags,
                                      "no-action": commentEmptyNoTags });
  const cancelButtonClass = classNames("comment-footer-button", "cancel",
    { disabled: commentEmptyNoTags, "no-action": commentEmptyNoTags });

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

  const handleCommentTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    const targetText = target.value;
    if (!targetText) {
      setCommentTextAreaHeight(minTextAreaHeight);
      setCommentText("");
    } else {
      setCommentTextAreaHeight(target.scrollHeight);
      setCommentText(targetText);
    }
  };

  const resetInputs = () => {
    setCommentTextAreaHeight(minTextAreaHeight);
    setCommentText("");
    setAllTags([""]); //select will go back to top choice (tagPrompt)
    setAgreeWithAi(undefined);
  };

  const handleCancelPost = () => {
    resetInputs();
  };

  const handlePostComment = () => {
    // do not send post if text area is empty, only has spaces or new lines
    if (hasContentToPost()){
      const [trimmedText] = trimContent(commentText);
      //do not post to Firestore if select tag is tagPrompt
      onPostComment?.({comment: trimmedText, tags: allTags, agreeWithAi});
      resetInputs();
    }
  };

  const handleCommentTextboxKeyDown = (event: React.KeyboardEvent) => {
    const [trimmedText] = trimContent(commentText);
    switch(event.key) {
      case "Escape":
        resetInputs();
        break;
      case "Enter":
        if(event.shiftKey) {
          event.preventDefault();
          setCommentText(trimmedText+"\n");
        } else if (!hasContentToPost()) {
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
    // Do not save comments with default tag
    setAllTags(tagPrompt && val !== tagPrompt ? [val] : [""]);
  };

  const handleToggleAgreeWithAi = (value: IAgreeWithAi["value"]) => {
    return () => {
      setAgreeWithAi((prev) => {
        if (prev?.value === value) {
          return undefined;
        }
        return { version: 1, value };
      });
    };
  };

  return (
    <div className="comment-textbox">
      <textarea
        className={classNames({
          "has-tags" : showCommentTag,
          "has-agree": showAgreeButtons,
          "has-tags-and-agree": showCommentTag && showAgreeButtons
        })}
        ref={textareaRef}
        style={textareaStyle}
        placeholder={placeholderText}
        value={commentText}
        data-testid="comment-textarea"
        onChange={handleCommentTextAreaChange}
        onKeyDown={handleCommentTextboxKeyDown}
      />
      {showAgreeButtons && (
        <div className="comment-agree" data-testid="comment-agree">
          <div className="comment-agree-header" data-testid="comment-agree-header">Do you agree with Ada?</div>
          <div className="comment-agree-buttons" data-testid="comment-agree-buttons">
            <div
              role="button"
              aria-label="Yes"
              title="Agree with Ada"
              className={classNames({"selected": agreeWithAi?.value === "yes"})}
              onClick={handleToggleAgreeWithAi("yes")}
              data-testid="comment-agree-yes-button">
              <YesIcon /> Yes
            </div>
            <div
              role="button"
              aria-label="No"
              title="Disagree with Ada"
              className={classNames({"selected": agreeWithAi?.value === "no"})}
              onClick={handleToggleAgreeWithAi("no")}
              data-testid="comment-agree-no-button">
              <NoIcon /> No
            </div>
            <div
              role="button"
              aria-label="Not Sure"
              title="Not sure if you agree with Ada"
              className={classNames({"selected": agreeWithAi?.value === "notSure"})}
              onClick={handleToggleAgreeWithAi("notSure")}
              data-testid="comment-agree-not-sure-button">
              <NotSureIcon /> &hellip;?
            </div>
          </div>
        </div>
      )}
      {
        showCommentTag && commentTags &&
        <select
          ref={selectElt}
          className={classNames({"shift-down-with-agree": showAgreeButtons})}
          data-testid="comment-textbox-dropdown"
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
        <button className={cancelButtonClass}
              onClick={handleCancelPost}
              data-testid="comment-cancel-button">
          Cancel
        </button>
        <button
          className={postButtonClass}
          onClick={handlePostComment}
          data-testid="comment-post-button"
        >
          <SendIcon />
          Post
        </button>
      </div>
    </div>
  );
};
