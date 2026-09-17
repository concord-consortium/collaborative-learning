import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { UserModelType } from "../../models/stores/user";
import { CommentCard } from "./comment-card";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";
import { IDEAS_EMPTY_MESSAGE } from "../../models/document/ai-evaluation-messages";

// jsdom does not implement scrollIntoView, which StatusMessage calls when it renders.
window.HTMLElement.prototype.scrollIntoView = jest.fn();


const mockUpdateRating = jest.fn().mockResolvedValue(undefined);
jest.mock("../../hooks/use-update-comment-rating", () => ({
  useUpdateCommentRating: () => mockUpdateRating
}));

jest.mock("../../hooks/document-comment-hooks", () => ({
  useCommentsCollectionPath: () => "documents/doc1/comments"
}));

jest.mock("../../models/tiles/log/log-comment-event", () => ({
  logCommentEvent: jest.fn()
}));

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
    },
    commentTags: { mergedWith: (c?: Record<string, string>) => ({ ...(c ?? {}) }) }
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

  it("renders rating buttons on every comment", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello" },
      { id: "c2", uid: "2", name: "User2", createdAt: new Date(), content: "world" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getAllByTestId("comment-rating-buttons")).toHaveLength(2);
  });

  it("shows rating counts when > 0", () => {
    const postedComments: WithId<CommentDocument>[] = [
      {
        id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello",
        ratings: { "u1": "yes", "u2": "yes", "u3": "no" }
      }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByTestId("rating-yes-count")).toHaveTextContent("(2)");
    expect(screen.getByTestId("rating-no-count")).toHaveTextContent("(1)");
    expect(screen.queryByTestId("rating-not-sure-count")).not.toBeInTheDocument();
  });

  it("shows header with poster name", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "Alice", createdAt: new Date(), content: "hello" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByText("Do you agree with Alice?")).toBeInTheDocument();
  });

  it("highlights the active rating for the current user", () => {
    const currentUser = { id: "u1", name: "Me" } as UserModelType;
    const postedComments: WithId<CommentDocument>[] = [
      {
        id: "c1", uid: "other", name: "Other", createdAt: new Date(), content: "hello",
        ratings: { "u1": "no" }
      }
    ];
    render((
      <ModalProvider>
        <CommentCard user={currentUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByTestId("rating-no-button")).toHaveClass("selected");
    expect(screen.getByTestId("rating-yes-button")).not.toHaveClass("selected");
  });

  it("calls updateRating when clicking a rating button", () => {
    mockUpdateRating.mockClear();
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    fireEvent.click(screen.getByTestId("rating-yes-button"));
    expect(mockUpdateRating).toHaveBeenCalledWith("documents/doc1/comments/c1", "yes");
  });
});

describe("CommentCard with showCommentRating disabled", () => {
  const testUser = { id: "0", name: "Test Teacher" } as UserModelType;

  // Override the mock to disable ratings
  const configWithRatingsDisabled = {
    ...unitConfigDefaults,
    showCommentRating: false
  };

  beforeEach(() => {
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useStores = () => ({
      appConfig: AppConfigModel.create({ config: configWithRatingsDisabled }),
      class: {
        getUserById: () => ({ id: "0", type: "student", name: "Test Student" } as UserModelType)
      },
      commentTags: { mergedWith: (c?: Record<string, string>) => ({ ...(c ?? {}) }) }
    });
  });

  afterEach(() => {
    // Restore original mock
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useStores = () => ({
      appConfig: AppConfigModel.create({ config: unitConfigDefaults }),
      class: {
        getUserById: () => ({ id: "0", type: "student", name: "Test Student" } as UserModelType)
      },
      commentTags: { mergedWith: (c?: Record<string, string>) => ({ ...(c ?? {}) }) }
    });
  });

  it("hides rating buttons when showCommentRating is false", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.queryByTestId("comment-rating-buttons")).not.toBeInTheDocument();
  });

  it("still renders comments when ratings are hidden", () => {
    const postedComments: WithId<CommentDocument>[] = [
      { id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "hello world" }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-rating-buttons")).not.toBeInTheDocument();
  });

  it("preserves existing ratings data when buttons are hidden", () => {
    const postedComments: WithId<CommentDocument>[] = [
      {
        id: "c1", uid: "1", name: "User1", createdAt: new Date(), content: "rated comment",
        ratings: { "u1": "yes", "u2": "no" }
      }
    ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments} focusDocument="doc1" />
      </ModalProvider>
    ));
    // Comment renders but ratings UI is hidden — data is preserved in the model
    expect(screen.getByText("rated comment")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-rating-buttons")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rating-yes-button")).not.toBeInTheDocument();
  });
});

describe("the empty-document nudge, scoped to the document thread", () => {
  afterEach(() => {
    // Restore the module-level default so later tests are unaffected.
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useCurriculumOrDocumentContent = () => undefined;
  });

  it("still renders in the document thread's card when a tile is focused and the nudge is set", () => {
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useCurriculumOrDocumentContent = () => ({
      statusMessage: { message: IDEAS_EMPTY_MESSAGE, shownAt: 1 }
    });

    render((
      <ModalProvider>
        <CommentCard activeNavTab="my-work" isFocused={true} focusTileId="tile-1" focusDocument="doc1"
          isDocumentThread={true} />
      </ModalProvider>
    ));

    expect(screen.getByText(IDEAS_EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it("does not render in the document thread's card when there is no nudge", () => {
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useCurriculumOrDocumentContent = () => ({ statusMessage: null });

    render((
      <ModalProvider>
        <CommentCard activeNavTab="my-work" isFocused={true} focusTileId="tile-1" focusDocument="doc1"
          isDocumentThread={true} />
      </ModalProvider>
    ));

    expect(screen.queryByText(IDEAS_EMPTY_MESSAGE)).not.toBeInTheDocument();
  });

  it("does not render in a tile thread's card even when the nudge is set", () => {
    // Regression test: a tile thread's card shares the same document-level `content` as the
    // document thread's card, so gating only on `content?.statusMessage` (without also checking
    // which thread this card belongs to) would render the nudge redundantly in every expanded
    // tile thread too.
    const useStoresMock = jest.requireMock("../../hooks/use-stores");
    useStoresMock.useCurriculumOrDocumentContent = () => ({
      statusMessage: { message: IDEAS_EMPTY_MESSAGE, shownAt: 1 }
    });

    render((
      <ModalProvider>
        <CommentCard activeNavTab="my-work" isFocused={true} focusTileId="tile-1" focusDocument="doc1"
          isDocumentThread={false} />
      </ModalProvider>
    ));

    expect(screen.queryByText(IDEAS_EMPTY_MESSAGE)).not.toBeInTheDocument();
  });
});
