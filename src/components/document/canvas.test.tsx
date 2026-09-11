import { render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { CanvasComponent } from "./canvas";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { createSingleTileContent } from "../../utilities/test-utils";
import { FirestoreHistoryManager } from "../../models/history/firestore-history-manager";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

const mockGetQueryState = jest.fn();
jest.mock("react-query", () => ({
  useQueryClient: () => ({
    getQueryState: mockGetQueryState
  })
}));

describe("Canvas Component", () => {

  beforeEach(() => {
    // mock getSelection for text tool
    (window as any).getSelection = () => {
      return {
      };
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it("can render without a document or content", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" readOnly={false} />
      </Provider>
    );
    expect(screen.queryByTestId("document-content")).toBeNull();
  });

  it("can render with a document", () => {
    const document = createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: createSingleTileContent({
        type: "Text",
        text: "test"
      })
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={document} readOnly={true} />
        </ModalProvider>
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });

  it("renders spinner while loading remote document content", () => {
    mockGetQueryState.mockImplementation(() => ({ status: "loading" }));
    const document = createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      remoteContext: "remote-context",
      createdAt: 1,
      visibility: "public"
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" document={document} readOnly={true} />
      </Provider>
    );
    expect(screen.getByTestId("document-loading-spinner")).toBeInTheDocument();
  });

  it("can render with content", () => {
    const content = createSingleTileContent({
      type: "Text",
      text: "test"
    });
    const document = createDocumentModel({
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      content,
      visibility: "public"
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" content={document.content} readOnly={true} />
        </ModalProvider>
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });


  // The store hands out a history-view request once and then forgets it, so the id the canvas
  // is holding belongs to the document it was read for. Switching documents in the sort-work
  // view reuses this component, and a request left behind is applied to the wrong document.
  it("does not carry a history request over to the next document", () => {
    jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
      .mockImplementation(() => undefined);
    jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
      .mockResolvedValue(undefined);
    const moveSpy = jest.spyOn(FirestoreHistoryManager.prototype, "moveToHistoryEntryAfterLoad")
      .mockResolvedValue(undefined);

    const makeDoc = (key: string) => createDocumentModel({
      type: ProblemDocument, title: key, uid: "1", key, createdAt: 1, visibility: "public",
      content: createSingleTileContent({ type: "Text", text: "test" })
    });
    const first = makeDoc("first");
    const second = makeDoc("second");
    second.setShowPlaybackControls(true);

    const stores = specStores();
    stores.sortedDocuments.setDocumentHistoryViewRequest("first", "entry-abc");

    const { rerender } = render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={first} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );
    expect(moveSpy).toHaveBeenCalledWith("entry-abc");

    rerender(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={second} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    expect(moveSpy).toHaveBeenCalledTimes(1);
  });

});
