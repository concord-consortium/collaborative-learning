import React from "react";
import { render, screen } from "@testing-library/react";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { CDocument, TreeManager } from "../../models/history/tree-manager";
import { FirestoreHistoryManager, HistoryStatus } from "../../models/history/firestore-history-manager";
import { PlaybackComponent } from "./playback";

// PlaybackComponent renders PlaybackControlComponent once the history has loaded, so the
// stores and Firestore hooks that the control reaches for have to be stubbed here too.
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    user: { id: "1" },
    displayedActiveNavTab: "my-work",
    class: { getUserById: () => undefined }
  }),
  usePersistentUIStore: () => ({ focusDocument: "test" })
}));

jest.mock("../../hooks/document-comment-hooks", () => ({
  useDocumentComments: () => ({ isLoading: false, isError: false, data: [], error: undefined }),
  useDocumentCommentsAtSimplifiedPath: () =>
    ({ isLoading: false, isError: false, data: [], error: undefined })
}));

jest.mock("../../hooks/use-nav-tab-panel-info", () => ({
  useNavTabPanelInfo: () => ({ setPlaybackTime: jest.fn() })
}));

function setupDocument() {
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: DocumentContentModel.create({ tileMap: {} }) as any
  });
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  treeManager.setChangeDocument(CDocument.create({
    history: [{ id: "entry-0", tree: "test", state: "complete" as const, records: [] }]
  }));
  treeManager.setNumHistoryEntriesApplied(1);
  return docModel;
}

function makeHistoryManager(historyEntryRequestError?: string) {
  return {
    historyStatus: HistoryStatus.HISTORY_LOADED,
    historyStatusString: "History is loaded",
    historyEntryRequestError,
    moveToHistoryEntryAfterLoad: jest.fn()
  } as unknown as FirestoreHistoryManager;
}

describe("PlaybackComponent", () => {
  it("shows the reason a requested history entry could not be shown", () => {
    const historyManager = makeHistoryManager(
      "Could not find the requested point in this document's history (id: no-such-id)."
    );
    render(<PlaybackComponent document={setupDocument()} historyManager={historyManager}
              requestedHistoryId="no-such-id" />);

    // The message appears after the document has loaded, so it has to announce itself.
    expect(screen.getByRole("alert"))
      .toHaveTextContent("Could not find the requested point");
  });

  it("shows no message when the requested history entry was found", () => {
    render(<PlaybackComponent document={setupDocument()} historyManager={makeHistoryManager()}
              requestedHistoryId="entry-0" />);

    expect(screen.queryByTestId("playback-history-request-error")).not.toBeInTheDocument();
  });
});
