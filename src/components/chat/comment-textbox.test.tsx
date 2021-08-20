import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";
import { act } from "react-dom/test-utils";
import { ENavTab } from "../../models/view/nav-tabs";
import { CommentTextBox } from "./comment-textbox";

describe("Comment Textbox", () => {

  const stores = { ui: { activeNavTab: ENavTab.kMyWork } };

  it("should render successfully", () => {
    const activeNavTab = "problems";
    render((
      <Provider stores={stores}>
        <CommentTextBox activeNavTab={activeNavTab} numPostedComments={5} />
      </Provider>
    ));
    expect(screen.getByTestId("comment-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("comment-post-button")).toBeInTheDocument();
    expect(screen.getByTestId("comment-cancel-button")).toBeInTheDocument();
    expect(screen.getByTestId("comment-post-button")).toHaveClass(activeNavTab);
  });

  it("should allow user to type text in the textarea and enable Post button", () => {
    const { rerender } = render((
      <Provider stores={stores}>
        <CommentTextBox numPostedComments={5}/>
      </Provider>
    ));
    const postButton = screen.getByTestId("comment-post-button");
    const textarea = screen.getByTestId("comment-textarea") as HTMLTextAreaElement;
    const text = "X"; //testing library issue when typing in more than one character
    expect(postButton).toHaveClass("disabled");
    act(() =>{
      userEvent.type(textarea, text);
    });
    rerender(
      <Provider stores={stores}>
        <CommentTextBox numPostedComments={5} />
      </Provider>);
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
      <Provider stores={stores}>
        <CommentTextBox numPostedComments={5} onPostComment={onPostComment} />
      </Provider>
    ));
    const postButton = screen.getByTestId("comment-post-button");
    const textarea = screen.getByTestId("comment-textarea") as HTMLTextAreaElement;
    const text = "X"; //testing library issue when typing in more than one character
    expect(postButton).toHaveClass("disabled");
    act(() =>{
      userEvent.type(textarea, text);
    });
    rerender(
      <Provider stores={stores}>
        <CommentTextBox numPostedComments={5} onPostComment={onPostComment} />
      </Provider>);
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
