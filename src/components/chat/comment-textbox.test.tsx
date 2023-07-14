import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { act } from "react-dom/test-utils";
import { CommentTextBox } from "./comment-textbox";

jest.mock("../../hooks/use-stores", () => ({
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: []
  })
}));

describe("Comment Textbox", () => {
  it("should render successfully", () => {
    const activeNavTab = "problems";
    render((
      <CommentTextBox activeNavTab={activeNavTab} numPostedComments={5} />
    ));
    expect(screen.getByTestId("comment-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("comment-post-button")).toBeInTheDocument();
    expect(screen.getByTestId("comment-cancel-button")).toBeInTheDocument();
    expect(screen.getByTestId("comment-post-button")).toHaveClass(activeNavTab);
  });

  it("should allow user to type text in the textarea and enable Post button", () => {
    const { rerender } = render((
      <CommentTextBox numPostedComments={5}/>
    ));
    const postButton = screen.getByTestId("comment-post-button");
    const textarea = screen.getByTestId("comment-textarea") as HTMLTextAreaElement;
    const text = "X"; //testing library issue when typing in more than one character
    expect(postButton).toHaveClass("disabled");
    act(() =>{
      userEvent.type(textarea, text);
    });
    rerender(
      <CommentTextBox numPostedComments={5} />
    );
    expect(textarea.value).toBe(text);
    expect(postButton).not.toHaveClass("disabled");
    act(() => {
      userEvent.click(screen.getByTestId("comment-cancel-button"));
    });
    expect(textarea.value).toBe("");
    expect(postButton).toHaveClass("disabled");
  });
  it("should allow user to type text in the textarea and enable Post button", () => {
    const onPostComment = jest.fn();
    window.alert = jest.fn();
    const { rerender } = render((
      <CommentTextBox numPostedComments={5} onPostComment={onPostComment} />
    ));
    const postButton = screen.getByTestId("comment-post-button");
    const textarea = screen.getByTestId("comment-textarea") as HTMLTextAreaElement;
    const text = "X"; //testing library issue when typing in more than one character
    expect(postButton).toHaveClass("disabled");
    act(() =>{
      userEvent.type(textarea, text);
    });
    rerender(
      <CommentTextBox numPostedComments={5} onPostComment={onPostComment} />
    );
    expect(textarea.value).toBe(text);
    expect(postButton).not.toHaveClass("disabled");
    act(() => {
      userEvent.click(postButton);
    });
    expect(textarea.value).toBe("");
    expect(postButton).toHaveClass("disabled");
    expect(onPostComment).toHaveBeenCalled();
  });
});
