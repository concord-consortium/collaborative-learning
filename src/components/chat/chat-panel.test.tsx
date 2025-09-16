import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { DocumentContentModel } from "../../models/document/document-content";
import { ENavTab } from "../../models/view/nav-tabs";
import { ChatPanel } from "./chat-panel";
import { createSingleTileContent } from "../../utilities/test-utils";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";
import { UserModelType } from "../../models/stores/user";

const mockPostComment = jest.fn();

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

jest.mock("../../hooks/document-comment-hooks", () => ({
  useCommentsCollectionPath: (documentKeyOrSectionPath: string) => {
    return `${documentKeyOrSectionPath}/comments`;
  },
  useDocumentComments: () => ({
    isLoading: false,
    isError: false,
    data: [
      { uid: "1", name: "Teacher 1", createdAt: yesterday, content: "Comment 1" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 2" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 3" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 4" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 5" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8" }
    ],
    error: undefined
  }),
  useDocumentCommentsAtSimplifiedPath: () => ({
    isLoading: false,
    isError: false,
    data: [],
    error: undefined
  }),
  useUnreadDocumentComments: () => ({
    isLoading: false,
    isError: false,
    data: [
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8" }
    ],
    error: undefined
  }),
  usePostDocumentComment: () => ({
    mutate: () => mockPostComment()
  })
}));

let playbackTime: Date | undefined = undefined;
jest.mock("../../hooks/use-nav-tab-panel-info", () => ({
  useNavTabPanelInfo: () => ({
    playbackTime
  })
}));

const mockUseMutation = jest.fn((callback: (...args: any[]) => void) => {
  return { mutate: (...args: any[]) => callback(...args) };
});
jest.mock("react-query", () => ({
  useMutation: (callback: () => void) => mockUseMutation(callback),
}));

jest.mock("../../hooks/use-stores", () => ({
  useTypeOfTileInDocumentOrCurriculum: () => "Text",
  useDBStore: () => ({
    firestore: {
      getRootFolder: () => "firestore/root"
    },
    firebase: {
      getLastEditedTimestamp: jest.fn(() => Date.now())
    }
  }),
  useDocumentOrCurriculumMetadata: (documentKey: string) => ({
    uid: "1", key: documentKey, type: "problem"
  }),
  useDocumentFromStore: () => ({
    getProperty: (key: string) => undefined,
    title: "Test Document",
    type: "problem",
    unit: "test-unit",
    investigation: 1,
    problem: 1
  }),
  useCurriculumOrDocumentContent:(key: string) => {
    return DocumentContentModel.create(createSingleTileContent({
      type: "Text",
      title: "test title"
    }));
  },
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: []
  }),
  useAppConfig: () => AppConfigModel.create({ config: unitConfigDefaults }),
  useStores: () => ({
    appConfig: AppConfigModel.create({ config: unitConfigDefaults }),
    class: {
      getUserById: () => ({ id: "0", type: "student", name: "Test Student" } as UserModelType)
    },
    unit: {
      code: "test-unit",
      getInvestigation: () => ({
        getProblem: () => ({
          title: "Test Problem"
        })
      })
    }
  })
}));


describe("ChatPanel", () => {

  it("should render successfully", () => {
    const mockCloseChatPanel = jest.fn();
    render((
      <ModalProvider>
        <ChatPanel activeNavTab={ENavTab.kMyWork} focusDocument="document-key" onCloseChatPanel={mockCloseChatPanel}/>
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel-header")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("chat-close-button"));
    });
    expect(mockCloseChatPanel).toHaveBeenCalled();
  });
  it("should show select document message if document has not been selected", () => {
    const mockCloseChatPanel = jest.fn();
    render((
      <ModalProvider>
        <ChatPanel activeNavTab={ENavTab.kMyWork} onCloseChatPanel={mockCloseChatPanel} />
      </ModalProvider>
    ));
    expect(screen.getByTestId("select-doc-message")).toBeInTheDocument();
  });
  it("Should show chat list with thread if document selected", () => {
    const mockCloseChatPanel = jest.fn();
    render((
      <ModalProvider>
        <ChatPanel activeNavTab={ENavTab.kMyWork} focusDocument="document-key" onCloseChatPanel={mockCloseChatPanel} />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("comment-card").length).toBe(1);
    expect(screen.getAllByTestId("comment-thread").length).toBe(8);
  });
  it("should hide comments before the playback time, if set", () => {
    // set the playback time to yesterday in the mock - should only show 1 comment
    playbackTime = yesterday;
    const mockCloseChatPanel = jest.fn();
    render((
      <ModalProvider>
        <ChatPanel activeNavTab={ENavTab.kMyWork} focusDocument="document-key" onCloseChatPanel={mockCloseChatPanel} />
      </ModalProvider>
    ));
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.getAllByTestId("comment-card").length).toBe(1);
    expect(screen.getAllByTestId("comment-thread").length).toBe(1);
  });
});
