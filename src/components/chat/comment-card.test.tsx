import { render, screen } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { UserModelType } from "../../models/stores/user";
import { CommentCard } from "./comment-card";

jest.mock("../../hooks/use-stores", () => ({
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: []
  })
}));

describe("CommentCard", () => {
  const testUser  = { id: "0", name: "Test Teacher" } as UserModelType;
  const activeNavTab = "my-work";

  it("should render successfully", () => {
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} />
      </ModalProvider>
));
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card")).toHaveClass("selected");
    expect(screen.getByTestId("comment-card-header")).toBeInTheDocument();
  });
  it("should show the correct header icon when there are no comments", () => {
    const postedComments: WithId<CommentDocument>[] = [];
    const commentThread = screen.queryByTestId("comment-thread");
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments}/>
      </ModalProvider>
    ));
    // expect(screen.getByTestId("document-comment-icon")).toBeInTheDocument();
    expect(commentThread).toBeNull();
  });
  it("should show the correct header icon when there are comments and comment appears in card", () => {
    const testComment = "test comment";
    const postedComments: WithId<CommentDocument>[] = [
            { id: "1", uid: "1", name: "T1", createdAt: new Date(), content: testComment }
          ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments}/>
      </ModalProvider>
    ));
    // expect(screen.getByTestId("teacher-initial")).toHaveTextContent("T");
    expect(screen.getByTestId("comment-thread")).toBeInTheDocument();
    expect(screen.getByTestId("comment")).toHaveTextContent(testComment);
  });
});
