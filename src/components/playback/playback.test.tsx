import React from "react";
import { act, render, screen } from "@testing-library/react";
import { Instance } from "mobx-state-tree";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../../models/stores/user-context-provider";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
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

// A real manager, so that the MobX wiring is part of what is covered. A stubbed manager
// holds a plain field, which renders the same way whether or not historyEntryRequestError
// is declared observable — and without that declaration the alert never appears in the app,
// because nothing re-renders when the seek fails.
function makeRealHistoryManager(docModel: DocumentModelType) {
  const firestore = {
    doc: () => ({
      onSnapshot: (callback: (doc: { exists: boolean }) => void) => {
        callback({ exists: true });
        return jest.fn();
      }
    }),
    getFullPath: (path: string) => path
  } as unknown as Firestore;

  return new FirestoreHistoryManager({
    firestore,
    userContextProvider: { userContext: { uid: "1234" } } as unknown as UserContextProvider,
    treeManager: docModel.treeManagerAPI as Instance<typeof TreeManager>,
    uploadLocalHistory: false,
    syncRemoteHistory: false
  });
}

describe("PlaybackComponent", () => {
  it("shows the reason a requested history entry could not be shown", () => {
    const historyManager = makeHistoryManager(
      "Could not find the requested point in this document's history (id: no-such-id)."
    );
    render(<PlaybackComponent document={setupDocument()} historyManager={historyManager}
              requestedHistoryId="no-such-id" />);

    expect(screen.getByRole("alert"))
      .toHaveTextContent("Could not find the requested point");
  });

  // The seek resolves well after the reader's attention has moved on, so the message has to
  // arrive into a live region rather than be present when one is first rendered.
  it("announces a request failure that arrives after the document has loaded", async () => {
    const docModel = setupDocument();
    const historyManager = makeRealHistoryManager(docModel);
    render(<PlaybackComponent document={docModel} historyManager={historyManager}
              requestedHistoryId={undefined} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      historyManager.setHistoryEntryRequestError(
        "Could not find the requested point in this document's history (id: no-such-id).");
    });

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Could not find the requested point");
  });

  it("renders nothing when there is no request error", () => {
    const historyManager = makeHistoryManager();
    render(<PlaybackComponent document={setupDocument()} historyManager={historyManager}
              requestedHistoryId="entry-0" />);

    expect(screen.queryByTestId("playback-history-request-error")).not.toBeInTheDocument();
    expect(historyManager.moveToHistoryEntryAfterLoad).toHaveBeenCalledWith("entry-0");
  });
});
