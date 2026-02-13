import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { UserModelType } from "../../models/stores/user";
import { CommentCard } from "./comment-card";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";


jest.mock("../../hooks/use-stores", () => ({
  useTypeOfTileInDocumentOrCurriculum: () => "Text",
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: []
  }),
  useStores: () => ({
    appConfig: AppConfigModel.create({ config: unitConfigDefaults }),
    class: {
      getUserById: () => ({ id: "0", type: "student", name: "Test Student" } as UserModelType)
    }
  }),
  useCurriculumOrDocumentContent: () => undefined
}));

describe("CommentCard", () => {
  const testUser  = { id: "0", name: "Test Teacher" } as UserModelType;
  const activeNavTab = "my-work";

  it("should render successfully", () => {
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} isFocused={true} />
      </ModalProvider>
    ));
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card-content")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card-content")).toHaveClass("selected");
  });
  it("should show the correct header icon when there are no comments", () => {
    const postedComments: WithId<CommentDocument>[] = [];
    const commentThread = screen.queryByTestId("comment-thread");
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments}/>
      </ModalProvider>
    ));
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
    expect(screen.getByTestId("comment-thread")).toBeInTheDocument();
    expect(screen.getByTestId("comment")).toHaveTextContent(testComment);
  });

  it("calls onSelect when clicking on the comment card", () => {
    const mockOnSelect = jest.fn();
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} onSelect={mockOnSelect} isFocused={true} />
      </ModalProvider>
    ));
    fireEvent.click(screen.getByTestId("comment-card"));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when pressing Enter on the comment card", () => {
    const mockOnSelect = jest.fn();
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} onSelect={mockOnSelect} isFocused={true} />
      </ModalProvider>
    ));
    const card = screen.getByTestId("comment-card");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when pressing Space on the comment card", () => {
    const mockOnSelect = jest.fn();
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} onSelect={mockOnSelect} isFocused={true} />
      </ModalProvider>
    ));
    const card = screen.getByTestId("comment-card");
    fireEvent.keyDown(card, { key: " " });
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect for non-Enter/Space keys", () => {
    const mockOnSelect = jest.fn();
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} onSelect={mockOnSelect} isFocused={true} />
      </ModalProvider>
    ));
    const card = screen.getByTestId("comment-card");
    fireEvent.keyDown(card, { key: "Tab" });
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("comment card has tabIndex and aria-label for keyboard accessibility", () => {
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} isFocused={true} />
      </ModalProvider>
    ));
    const card = screen.getByTestId("comment-card");
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card).toHaveAttribute("aria-label", "Select associated tile");
  });
});
