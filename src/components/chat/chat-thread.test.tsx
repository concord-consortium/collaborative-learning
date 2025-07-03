import { render, screen } from "@testing-library/react";
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
    selectedTileIds: []
  }),
  useStores: () => ({
    appConfig: AppConfigModel.create({ config: unitConfigDefaults })
  }),
  useCurriculumOrDocumentContent: () => undefined
}));

const makeFakeCommentThread = (title: string, tileId: string, uid: string) => {
  return {
    title,
    tileId,
    tileType: "Image",
    comments: [
      { uid, id: "asdf", name: "Teacher 1", createdAt: new Date(), content: title + " Comment 1" },
      { uid, id: "zyxw", name: "Teacher 2", createdAt: new Date(), content: title + " Comment 2" },
    ]
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
    expect(screen.queryByTestId("chat-thread-user-icon")).not.toBeInTheDocument();
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

    // One of the comments is owned by the current user so icon is shown.
    expect(screen.getAllByTestId("chat-thread-user-icon").length).toBe(1);

    // Thread 1 is expanded with comments
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 1")).toBeInTheDocument();
    expect(screen.getByText("Thread 1 Comment 2")).toBeInTheDocument();

    // Thread 2 is collapsed. No comments.
    expect(screen.queryByText("Thread 2")).toBeInTheDocument();
    expect(screen.queryByText("Thread 2 Comment")).not.toBeInTheDocument();
  });
});
