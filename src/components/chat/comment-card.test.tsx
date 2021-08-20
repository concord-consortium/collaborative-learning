import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { UserModelType } from "../../models/stores/user";
import { ENavTab } from "../../models/view/nav-tabs";
import { ICommentData } from "./chat-panel";
import { CommentCard } from "./comment-card";

describe("CommentCard", () => {

  const stores = { ui: { activeNavTab: ENavTab.kMyWork } };
  const activeNavTab = stores.ui.activeNavTab;
  const testUser  = { id: "0", name: "Test Teacher" } as UserModelType;

  it("should render successfully", () => {
    render((
      <Provider stores={stores}>
        <CommentCard activeNavTab={activeNavTab} />
      </Provider>
    ));
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card")).toHaveClass(activeNavTab);
    expect(screen.getByTestId("comment-card-header")).toBeInTheDocument();
  });
  it("should show the correct header icon when there are no comments", () => {
    const postedComments:ICommentData[] = [];
    const commentThread = screen.queryByTestId("comment-thread");
    render((
      <CommentCard user={testUser} postedComments={postedComments}/>
    ));
    expect(screen.getByTestId("document-comment-icon")).toBeInTheDocument();
    expect(commentThread).toBeNull();
  });
  it("should show the correct header icon when there are comments and comment appears in card", () => {
    const testComment = "test comment";
    const postedComments:ICommentData[] = [{comment: testComment, timePosted: 1573761933537, user: testUser}];
    render((
      <CommentCard user={testUser} postedComments={postedComments}/>
    ));
    expect(screen.getByTestId("teacher-initial")).toHaveTextContent("T");
    expect(screen.getByTestId("comment-thread")).toBeInTheDocument();
    expect(screen.getByTestId("comment")).toHaveTextContent(testComment);
  });
});
