// Mock the useStores hook to provide unit.code and appConfig
const mockStores = {
  unit: { code: "test-unit" },
  appConfig: {
    getSetting: jest.fn((key: string, category: string) => {
      if (key === "systemPrompt" && category === "ai") {
        return "You are a helpful AI assistant.";
      }
      return undefined;
    })
  },
  ui: {
    selectedTileIds: [] as string[],
    isSelectedTile: () => false,
  },
  documents: { getDocument: jest.fn((): any => undefined) },
  networkDocuments: { getDocument: jest.fn((): any => undefined) },
};
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => mockStores,
  useUIStore: () => mockStores.ui,
  useSettingFromStores: (key: string, group?: string) => mockStores.appConfig.getSetting(key, group ?? ""),
}));

import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";
import { defaultAIContent } from "./ai-content";
import { AIComponent } from "./ai-tile";
import { AI_TILE_EMPTY_MESSAGE } from "../../models/document/ai-evaluation-messages";
import { DocumentContentModel } from "../../models/document/document-content";

// The starter tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./ai-registration";

// This is needed so MST can deserialize a Text tile snapshot when constructing DocumentContentModel
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

// Stable across tests, so assertions and mockClear() apply to the same instance.
const mockGetAiContent = jest.fn().mockResolvedValue({
  data: { text: "Mocked customized content" }
});
jest.mock("../../hooks/use-firebase-function", () => ({
  useFirebaseFunction: jest.fn(() => mockGetAiContent)
}));

// classHash is absent by default, so getAiContent is null and the request path never runs; tests
// that need to reach it swap in mockUserContextWithClassHash.
const mockUserContextWithoutClassHash = {
  user: { id: "test-user-id" },
  isAuthenticated: true,
  isTeacher: false,
  isStudent: true
};
const mockUserContextWithClassHash = { ...mockUserContextWithoutClassHash, classHash: "test-class-hash" };
let mockUserContext: typeof mockUserContextWithoutClassHash & { classHash?: string } = mockUserContextWithoutClassHash;
jest.mock("../../hooks/use-user-context", () => ({
  useUserContext: jest.fn(() => mockUserContext)
}));

jest.mock("mobx-state-tree", () => ({
  ...jest.requireActual("mobx-state-tree"),
  getParentOfType: jest.fn((model: any, type: any) => {
    // Return a mock DocumentContentModel with the necessary properties
    return {
      key: "test-document-key",
      getProperty: jest.fn(),
      title: "Test Document"
    };
  })
  // getSnapshot is left real: the tests below use a real DocumentContentModel, so it's genuinely
  // exercised, not just mocked through.
}));

jest.mock("../../models/document/document-utils", () => ({
  getDocumentIdentifier: jest.fn(() => "test-doc-content-id")
}));

// Logger.stores is uninitialized in this component test; mock the change logger so setPrompt/setText
// don't crash when the AI content logs changes.
jest.mock("../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

describe("AIComponent", () => {
  const content = defaultAIContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "test-doc-content-id",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {},
    onUnregisterTileApi: (facet?: string): void => {}
  };

  it("renders successfully with prompt showing", () => {
    content.setPrompt("Hello World");
    const {getByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the prompt text when the model changes", async () => {
    content.setPrompt("Hello World");
    const {getByText, queryByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    act(() => {
      content.setPrompt("New Text");
    });
    expect(getByText("New Text")).toBeInTheDocument();
    expect(queryByText("Hello World")).not.toBeInTheDocument();
  });

  // Exercises the actual focus/blur wiring (the regression risk), not just the model helper: a blur
  // logs setPrompt only when the prompt changed since focus.
  it("logs AI_TOOL_CHANGE on prompt blur, only when the prompt changed", () => {
    const aiContent = defaultAIContent();
    const aiModel = TileModel.create({ content: aiContent });
    const { container } = render(<AIComponent {...defaultProps} model={aiModel} />);
    const promptTextarea = container.querySelector(".prompt-form textarea") as HTMLTextAreaElement;
    expect(promptTextarea).toBeTruthy();

    (logTileChangeEvent as jest.Mock).mockClear();
    // Focus then blur with no edit → no log.
    fireEvent.focus(promptTextarea);
    fireEvent.blur(promptTextarea);
    expect(logTileChangeEvent).not.toHaveBeenCalled();

    // Focus, edit, blur → one log carrying the real tile id.
    fireEvent.focus(promptTextarea);
    fireEvent.change(promptTextarea, { target: { value: "ask the AI" } });
    fireEvent.blur(promptTextarea);
    expect(logTileChangeEvent).toHaveBeenCalledWith(LogEventName.AI_TOOL_CHANGE, {
      tileId: aiModel.id, operation: "setPrompt", change: { prompt: "ask the AI" }
    });
  });

  // classHash is required to reach the request path; the mocks above otherwise return none, so
  // getAiContent stays null.
  describe("the request effect, with classHash present", () => {
    // Real DocumentContentModel instances: documentHasStudentWork's getSnapshot() call needs a
    // live MST node, so these tests fail if that call is ever removed.

    // Genuinely empty per documentHasStudentWork: no tiles at all.
    const emptyDocContent = () => DocumentContentModel.create({});
    // A Text tile with real content, so documentHasStudentWork is true.
    const populatedDocContent = () => DocumentContentModel.create({
      rowMap: { row1: { id: "row1", tiles: [{ tileId: "tile1" }] } },
      rowOrder: ["row1"],
      tileMap: {
        tile1: { id: "tile1", content: { type: "Text", format: "markdown", text: "The student's answer." } }
      }
    } as any);

    function documentWith(docContent: unknown) {
      return { key: "test-doc-1", content: docContent };
    }

    beforeEach(() => {
      mockUserContext = mockUserContextWithClassHash;
    });

    afterEach(() => {
      mockUserContext = mockUserContextWithoutClassHash;
      mockStores.documents.getDocument.mockReset();
      mockStores.documents.getDocument.mockReturnValue(undefined);
      mockStores.networkDocuments.getDocument.mockReset();
      mockStores.networkDocuments.getDocument.mockReturnValue(undefined);
      mockGetAiContent.mockClear();
    });

    // AI tiles also sit in authored curriculum sections, with no documentId — the tile must stay
    // silent and keep its authored text, not show the empty-document nudge.
    it("with a documentId whose lookup finds nothing, leaves the tile's text unchanged and never " +
       "calls getAiContent, on mount", async () => {
      mockStores.documents.getDocument.mockReturnValue(undefined);
      mockStores.networkDocuments.getDocument.mockReturnValue(undefined);
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

      expect(aiContent.text).toBe(authoredText);
      expect(mockGetAiContent).not.toHaveBeenCalled();
    });

    it("with a documentId whose lookup finds nothing, leaves the tile's text unchanged and never " +
       "calls getAiContent, on Update", async () => {
      mockStores.documents.getDocument.mockReturnValue(undefined);
      mockStores.networkDocuments.getDocument.mockReturnValue(undefined);
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      // Captured before the first render, not just before refresh, so this test does not depend on
      // the mount case having already left the text alone — it independently pins both.
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      mockGetAiContent.mockClear();

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe(authoredText);
      expect(mockGetAiContent).not.toHaveBeenCalled();
    });

    // documentId itself is absent here, not just a failed lookup — the ternary short-circuits
    // before either lookup runs.
    it("with no documentId at all, leaves the tile's text unchanged, never looks up a document, " +
       "and never calls getAiContent, on mount", async () => {
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId={undefined} />));

      expect(aiContent.text).toBe(authoredText);
      expect(mockStores.documents.getDocument).not.toHaveBeenCalled();
      expect(mockStores.networkDocuments.getDocument).not.toHaveBeenCalled();
      expect(mockGetAiContent).not.toHaveBeenCalled();
    });

    it("with no documentId at all, leaves the tile's text unchanged, never looks up a document, " +
       "and never calls getAiContent, on Update", async () => {
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId={undefined} />));
      mockGetAiContent.mockClear();

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe(authoredText);
      expect(mockStores.documents.getDocument).not.toHaveBeenCalled();
      expect(mockStores.networkDocuments.getDocument).not.toHaveBeenCalled();
      expect(mockGetAiContent).not.toHaveBeenCalled();
    });

    it("on an empty document, shows the empty-tile message and never calls getAiContent, on mount", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(emptyDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () => render(
        <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
      ));

      expect(aiContent.text).toBe(AI_TILE_EMPTY_MESSAGE);
      expect(mockGetAiContent).not.toHaveBeenCalled();
      // isUpdating ended false: the loading state is not still showing.
      expect(queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("on an empty document, shows the empty-tile message and never calls getAiContent, on Update", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(emptyDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      mockGetAiContent.mockClear();
      act(() => aiContent.setText("something left over from before"));

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe(AI_TILE_EMPTY_MESSAGE);
      expect(mockGetAiContent).not.toHaveBeenCalled();
    });

    it("on a populated document, calls getAiContent with a prompt containing the summary", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

      expect(mockGetAiContent).toHaveBeenCalledTimes(1);
      const [request] = mockGetAiContent.mock.calls[0];
      expect(request.dynamicContentPrompt).toContain("The student's answer.");
      expect(request.dynamicContentPrompt).toContain("What do you think?");
      expect(aiContent.text).toBe("Mocked customized content");
    });

    // previousText here is the model's non-empty authored default, so this distinguishes
    // "restored" from "left blank" — the next test covers a real prior response.
    it("on a populated document, when getAiContent rejects: text is unchanged, Loading is gone, " +
       "and nothing escapes as an unhandled rejection", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      mockGetAiContent.mockRejectedValueOnce(new Error("network error"));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const previousText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () => render(
        <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
      ));

      expect(aiContent.text).toBe(previousText);
      expect(queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("on a populated document, when a later refresh's getAiContent rejects: a real prior " +
       "response survives, not just the authored placeholder", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      // First render succeeds and leaves a real AI response in place.
      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      expect(aiContent.text).toBe("Mocked customized content");

      mockGetAiContent.mockRejectedValueOnce(new Error("network error"));
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe("Mocked customized content");
    });

    // getAiContent resolves (not rejects) on a server-side failure, a distinct path from the
    // rejection tests above.
    it("on a populated document, when a later refresh's response carries a server-side error: " +
       "a real prior response survives, and the error is logged", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      // First render succeeds and leaves a real AI response in place.
      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      expect(aiContent.text).toBe("Mocked customized content");

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "", error: "Backend exploded" } });
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe("Mocked customized content");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to query AI", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it("on a populated document, an older refresh finishing after a newer one has started does " +
       "not hide the newer request's loading state, restore over it, or overwrite its response",
       async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      // Initial mount succeeds via the default mock resolution.
      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      expect(aiContent.text).toBe("Mocked customized content");

      let rejectOlder: (error: Error) => void;
      let resolveNewer: (value: { data: { text: string } }) => void;
      const olderPromise = new Promise((_resolve, reject) => { rejectOlder = reject; });
      const newerPromise = new Promise(resolve => { resolveNewer = resolve; });
      mockGetAiContent.mockImplementationOnce(() => olderPromise);
      mockGetAiContent.mockImplementationOnce(() => newerPromise);

      // Start the older (soon-to-be-superseded) request.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });

      // Start the newer request before the older one has finished.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });

      // Must not restore text over the newer request, or hide its loading state, while it's still
      // in flight.
      await act(async () => {
        rejectOlder!(new Error("stale network error"));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(queryByText("Loading...")).toBeInTheDocument();

      // The newer request then succeeds.
      await act(async () => {
        resolveNewer!({ data: { text: "Newer response" } });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Newer response");
      expect(queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("on a populated document, an older refresh succeeding after a newer one already " +
       "succeeded does not overwrite the newer response", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      // Initial mount succeeds via the default mock resolution.
      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      expect(aiContent.text).toBe("Mocked customized content");

      let resolveOlder: (value: { data: { text: string } }) => void;
      const olderPromise = new Promise<{ data: { text: string } }>(resolve => { resolveOlder = resolve; });
      mockGetAiContent.mockImplementationOnce(() => olderPromise);
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "Newer response" } });

      // Start the older (soon-to-be-superseded) request.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });

      // Start and finish the newer request before the older one has resolved.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Newer response");

      // The older request finally resolves — it must not overwrite the newer response.
      await act(async () => {
        resolveOlder!({ data: { text: "Stale older response" } });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Newer response");
    });
  });

});
