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

jest.mock("../../hooks/use-stores", () => ({
  useDocumentOrCurriculumMetadata:
  (docKeyOrSectionPath: string) => mockUseDocumentOrCurriculumMetadata(docKeyOrSectionPath),
  useNetworkDocumentKey: (documentKey: string) => `network_${documentKey}`,
  useTypeOfTileInDocumentOrCurriculum: () => "Text",
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: [],
    setSelectedTileId: () => undefined,
    setScrollTo: () => undefined
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

    // Thread 2 is expanded with comments
    expect(screen.getByText("Thread 2 Comment 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 2 Comment 2")).toBeInTheDocument();
    // Second thread has this-user comments
    expect(screen.getAllByTestId("chat-thread-user-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-thread-user-icon")[0].classList.contains("me")).toBe(true);
    expect(screen.getAllByTestId("chat-thread-user-icon")[1].classList.contains("me")).toBe(true);
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
});
