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

// A stable, clearable mock so tests can assert on it directly, rather than a fresh jest.fn()
// returned on every call.
const mockGetAiContent = jest.fn().mockResolvedValue({
  data: { text: "Mocked customized content" }
});
jest.mock("../../hooks/use-firebase-function", () => ({
  useFirebaseFunction: jest.fn(() => mockGetAiContent)
}));

// Mock the useUserContext hook to avoid user context errors during testing. classHash is absent
// by default — see Constraint C8: getAiContent is null without it, so the request path (and this
// task's guard) never runs. Tests that need to reach it swap in mockUserContextWithClassHash.
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
  // getSnapshot is left as the real implementation: the request-effect tests below give
  // document.content a real DocumentContentModel instance specifically so a real getSnapshot()
  // call is exercised, not just a mocked pass-through.
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

  // classHash is required to reach the request path at all (Constraint C8): the mocks above
  // otherwise return no classHash, so getAiContent is null and none of this runs.
  describe("the request effect, with classHash present", () => {
    // Real DocumentContentModel instances, not plain objects: documentHasStudentWork's own
    // getSnapshot() call needs a live MST node, and building one here means these tests would fail
    // if that call were ever removed from the component, rather than passing regardless.

    // Genuinely empty per documentHasStudentWork: no tiles at all.
    const emptyDocContent = () => DocumentContentModel.create({});
    // A Text tile with real content, so documentHasStudentWork is true and documentSummarizer has
    // something of the student's to describe.
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

    // AI tiles sit in authored curriculum sections (mods, clueful) too, where the tile has no
    // documentId and the lookup finds nothing — Constraint C15. There the tile must stay silent
    // and keep its authored text, not show the empty-document nudge.
    it("with no student document, leaves the tile's text unchanged and never calls getAiContent, " +
       "on mount", async () => {
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

    it("with no student document, leaves the tile's text unchanged and never calls getAiContent, " +
       "on Update", async () => {
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
        // The effect's queryAI() is fire-and-forget from the effect's own perspective, so give its
        // microtasks a chance to run within this act() before asserting.
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

    // Constraint C20: isUpdating must end false however queryAI exits, and a rejection must not
    // overwrite whatever text the tile already had.
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
  });

});
