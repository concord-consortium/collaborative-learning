import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { ENavTab } from "../../models/view/nav-tabs";
import { ChatThread } from "./chat-thread";
import { UserModelType } from "../../models/stores/user";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";

const mockCurriculumDocument = { unit: "unit", problem: "1.1", section: "intro", path: "unit/1/1/intro" };
const mockUseDocumentOrCurriculumMetadata = jest.fn((docKeyOrSectionPath: string) => {
  return mockCurriculumDocument;
});

const mockSetSelectedTileId = jest.fn();
const mockSetScrollTo = jest.fn();

jest.mock("../../hooks/use-stores", () => ({
  useDocumentOrCurriculumMetadata:
  (docKeyOrSectionPath: string) => mockUseDocumentOrCurriculumMetadata(docKeyOrSectionPath),
  useNetworkDocumentKey: (documentKey: string) => `network_${documentKey}`,
  useTypeOfTileInDocumentOrCurriculum: () => "Text",
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: [],
    setSelectedTileId: mockSetSelectedTileId,
    setScrollTo: mockSetScrollTo
  }),
  useStores: () => ({
    appConfig: AppConfigModel.create({ config: unitConfigDefaults }),
    class: {
      getUserById: (id: string) => {
        if (id.indexOf("teacher") !== -1) {
          return { id: "0", type: "teacher", name: "Test Teacher" } as UserModelType;
        } else {
          return { id: "0", type: "student", name: "Test Student" } as UserModelType;
        }
      }
    }
  }),
  useCurriculumOrDocumentContent: () => undefined
}));

jest.mock("../../models/tiles/log/log-comment-event", () => ({
  logCommentEvent: jest.fn()
}));

const makeFakeCommentThread = (title: string, tileId: string, uid: string) => {
  return {
    title,
    tileId,
    tileType: "Image",
    comments: [
      { uid, id: "asdf", name: "Teacher 1", createdAt: new Date(), content: title + " Comment 1" },
      { uid, id: "zyxw", name: "Teacher 2", createdAt: new Date(), content: title + " Comment 2" },
    ],
    isDeletedTile: false,
  };
};
describe("CommentThread", () => {
  it("render with no threads", () => {
    render((
      <ModalProvider>
      <ChatThread activeNavTab={ENavTab.kMyWork} focusDocument="document-key"/>
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    // One empty chat thread to show the comment box
    expect(screen.queryByTestId("chat-thread")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-thread-user-icon")).not.toBeInTheDocument();
  });

  it("Render threads. No User owned comments", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "abcd", "u1"), makeFakeCommentThread("Thread 2", "jkl", "u2")];
    const testUser = {id: "uuuuuu", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread chatThreads={chatThreads}
        activeNavTab={ENavTab.kMyWork}
        user={testUser}
        focusTileId={"abcd"}
        focusDocument="document-key"/>
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(2);
    expect(screen.getByText("Thread 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 2")).toBeInTheDocument();
    expect(screen.queryAllByTestId("chat-thread-user-icon")).toHaveLength(2); // two comments in focused thread
  });

  it("Focused Thread has correct styling and shows correct comments and metadata", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "abcd", "u3"), makeFakeCommentThread("Thread 2", "jkl", "u4")];
    const testUser = {id: "u4", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "abcd"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(2);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    // First thread has other-user comments
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].classList.contains("me")).toBe(false);
    expect(screen.getAllByTestId("chat-thread-user-icon")[1].classList.contains("me")).toBe(false);

    // Thread 1 is expanded with comments
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 2")).toBeInTheDocument();

    // Thread 2 is collapsed. No comments.
    expect(screen.queryByText("Thread 2")).toBeInTheDocument();
    expect(screen.queryByText("Thread 2 Comment")).not.toBeInTheDocument();

    // Click on Thread 2 to expand it
    fireEvent.click(screen.getByText("Thread 2"));

    // Thread 2 is now expanded with comments, and Thread 1 stays expanded too
    expect(screen.getByText("Thread 2 Comment 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 2 Comment 2")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 2")).toBeInTheDocument();
    // Both threads are expanded: Thread 1 has 2 other-user comments, Thread 2 has 2 this-user comments
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(4);
    // Thread 1 icons (other user)
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].classList.contains("me")).toBe(false);
    expect(screen.getAllByTestId("chat-thread-user-icon")[1].classList.contains("me")).toBe(false);
    // Thread 2 icons (this user)
    expect(screen.getAllByTestId("chat-thread-user-icon")[2].classList.contains("me")).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")[3].classList.contains("me")).toBe(true);
  });

  it("Comment from same student user renders icon with 'me' class", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "document", "u1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "document"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(1);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].className).toBe("user-icon round me");
  });

  it("Comment from different student user renders icon without 'me' class", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "document", "u2")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "document"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(1);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].className).toBe("user-icon round");
  });

  it("Comment from teacher user renders icon with 'teacher' class", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "document", "teacher_1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "document"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(1);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].className).toBe("user-icon teacher");
  });

  it("Comment from Ada renders icon with 'ada' class", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "document", "ada_insight_1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "document"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(1);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].className).toBe("user-icon teacher ada");
  });

  it("Comment from Ivan renders icon with 'ivan' class", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "document", "ivan_idea_1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId = "document"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-thread").length).toBe(1);
    expect(screen.getAllByTestId("chat-thread")[0].classList.contains('chat-thread-focused')).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].className).toBe("user-icon round ivan");
  });

  it("clicking a thread header expands the thread and selects the tile", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "tile-abc", "u1"), makeFakeCommentThread("Thread 2", "tile-xyz", "u2")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId="tile-abc"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));

    mockSetSelectedTileId.mockClear();
    mockSetScrollTo.mockClear();

    // Thread 2 is collapsed, click to expand it
    fireEvent.click(screen.getByText("Thread 2"));
    expect(mockSetSelectedTileId).toHaveBeenCalledWith("tile-xyz");
    expect(mockSetScrollTo).toHaveBeenCalledWith("tile-xyz", "document-key");
  });

  it("collapsing a thread does not update tile selection", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "tile-abc", "u1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId="tile-abc"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));

    // Thread 1 is expanded (focused). Click to collapse.
    mockSetSelectedTileId.mockClear();
    fireEvent.click(screen.getByText("Thread 1"));

    // Collapsing should not update selection
    expect(mockSetSelectedTileId).not.toHaveBeenCalled();
  });

  it("expanding the document thread clears tile selection", () => {
    const chatThreads =
      [makeFakeCommentThread("Doc Thread", "", "u1"), makeFakeCommentThread("Tile Thread", "tile-abc", "u2")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId="tile-abc"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));

    mockSetSelectedTileId.mockClear();
    mockSetScrollTo.mockClear();

    // Click the document thread header (tileId is "" so id becomes "document")
    fireEvent.click(screen.getByText("Doc Thread"));
    expect(mockSetSelectedTileId).toHaveBeenCalledWith("");
    expect(mockSetScrollTo).toHaveBeenCalledWith("", "document-key");
  });

  it("clicking on comment card body selects the tile", () => {
    const chatThreads =
      [makeFakeCommentThread("Thread 1", "tile-abc", "u1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          focusTileId="tile-abc"
          user={testUser}
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
        />
      </ModalProvider>
    ));

    // Thread is expanded, click on the comment card
    mockSetSelectedTileId.mockClear();
    mockSetScrollTo.mockClear();
    fireEvent.click(screen.getByTestId("comment-card"));
    expect(mockSetSelectedTileId).toHaveBeenCalledWith("tile-abc");
    expect(mockSetScrollTo).toHaveBeenCalledWith("tile-abc", "document-key");
  });

  it("clicking on document comment card clears tile selection", () => {
    // A thread with empty tileId is the "document" thread.
    // When no focusTileId is set, the useEffect auto-expands "document".
    const chatThreads =
      [makeFakeCommentThread("Doc Thread", "", "u1")];
    const testUser = {id: "u1", "name": "test user"} as UserModelType;
    render((
      <ModalProvider>
        <ChatThread
          chatThreads={chatThreads}
          activeNavTab={ENavTab.kMyWork}
          focusDocument="document-key"
          isDocumentView={true}
        />
      </ModalProvider>
    ));

    // The document thread is auto-expanded by useEffect, so comment-card is visible
    mockSetSelectedTileId.mockClear();
    fireEvent.click(screen.getByTestId("comment-card"));
    expect(mockSetSelectedTileId).toHaveBeenCalledWith("");
  });
});
