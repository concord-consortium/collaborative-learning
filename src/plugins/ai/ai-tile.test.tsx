// Mock the useStores hook to provide unit.code and appConfig
const mockStores = {
  unit: {
    code: "test-unit",
    // Shaped like a real UnitModelType's investigations/problems tree -- liveProblemsFromUnit
    // only reads .ordinal/.problems/.title, so a plain object tree is enough.
    investigations: [
      { ordinal: 1, problems: [{ ordinal: 1, title: "Problem 1.1" }, { ordinal: 2, title: "Problem 1.2" }] }
    ],
    config: undefined as { aiUnitSummary?: unknown } | undefined,
  },
  appConfig: {
    getSetting: jest.fn((key: string, category: string): string | undefined => {
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

import { act, fireEvent, render, screen } from "@testing-library/react";
import { destroy, getLivelinessChecking, setLivelinessChecking, unprotect } from "mobx-state-tree";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { ITileModel, TileModel } from "../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../lib/logger-types";
import { Logger } from "../../lib/logger";
import { defaultAIContent } from "./ai-content";
import { AIComponent } from "./ai-tile";
import {
  AI_TILE_EMPTY_MESSAGE, AI_TILE_REQUEST_FAILED_MESSAGE, AI_TILE_UNCHANGED_MESSAGE
} from "../../models/document/ai-evaluation-messages";
import { DocumentContentModel } from "../../models/document/document-content";
import { ReadOnlyContext } from "../../components/document/read-only-context";
import { hashString } from "../../../shared/hash-string";

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

// The failure event goes through Logger directly, deliberately bypassing the tile-change helper
// (which would also emit QUESTION_ANSWERS_CHANGE for a tile inside a Question tile).
jest.mock("../../lib/logger", () => ({ Logger: { log: jest.fn() } }));

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
    const populatedDocContent = (text = "The student's answer.") => DocumentContentModel.create({
      rowMap: { row1: { id: "row1", tiles: [{ tileId: "tile1" }] } },
      rowOrder: ["row1"],
      tileMap: {
        tile1: { id: "tile1", content: { type: "Text", format: "markdown", text } }
      }
    } as any);

    function documentWith(
      docContent: unknown,
      curriculum?: { unit?: string; investigation?: string; problem?: string }
    ) {
      return { key: "test-doc-1", content: docContent, ...curriculum };
    }

    // The gate lets a refresh through only when the document's summary changed, so a test that
    // needs a second request has to edit the document first, as a student would before asking again.
    let studentEdits = 0;
    const editDocument = () => mockStores.documents.getDocument.mockReturnValue(
      documentWith(populatedDocContent(`The student's answer, edit ${++studentEdits}.`)));

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
      mockStores.unit.config = undefined;
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

      expect(queryByText(AI_TILE_EMPTY_MESSAGE)).toBeInTheDocument();
      // The message is shown, not stored: nothing transient is written into the document.
      expect(aiContent.text).toBe(defaultAIContent().text);
      expect(mockGetAiContent).not.toHaveBeenCalled();
      // isUpdating ended false: the loading state is not still showing.
      expect(queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("on an empty document, shows the empty-tile message and never calls getAiContent, on Update", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(emptyDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      mockGetAiContent.mockClear();
      act(() => aiContent.setText("an earlier analysis"));

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(queryByText(AI_TILE_EMPTY_MESSAGE)).toBeInTheDocument();
      // The earlier analysis is still there to read while they add work.
      expect(aiContent.text).toBe("an earlier analysis");
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

    describe("the document-changed gate", () => {
      // Hashing the request the tile actually sent, rather than rebuilding it here, keeps these
      // from passing against a request the production code no longer makes.
      // Built from the request the tile actually sent, including the system prompt, which is
      // part of what the model is given and so part of what the gate must notice changing.
      const hashOfLastRequest = () => {
        const sent = mockGetAiContent.mock.calls[mockGetAiContent.mock.calls.length - 1][0];
        return hashString(`${sent.systemPrompt ?? ""}\u0000${sent.dynamicContentPrompt}`);
      };

      // A content model can only ever belong to one TileModel, so remount tests reuse the model
      // rather than wrapping the same content twice.
      const tileWithPrompt = () => {
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        return { aiContent, aiModel: TileModel.create({ content: aiContent }) };
      };

      const renderTile = (aiModel: ITileModel) => act(async () => {
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />);
      });

      const pressUpdate = (aiContent: ReturnType<typeof defaultAIContent>) => act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      it("records the hash of the request it evaluated after a successful refresh", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);

        expect(aiContent.text).toBe("Mocked customized content");
        expect(aiContent.evaluatedRequestHash).toBe(hashOfLastRequest());
      });

      // The whole point of hashing the request rather than the document history index: the tile's
      // own setText writes advance that index, so an index gate would be stale the moment it was
      // recorded and a second run would always bill another request.
      it("after a real refresh, a second run against the same document makes no request", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        expect(mockGetAiContent).toHaveBeenCalledTimes(1);

        await pressUpdate(aiContent);

        expect(mockGetAiContent).toHaveBeenCalledTimes(1);
      });

      // The prompt is part of the request even though it is not part of the document. An author
      // revising the prompt and pressing Update has changed what is being asked, and a gate on the
      // document summary alone would tell them nothing had changed and never send the new prompt.
      it("sends the request when the prompt changed but the document did not", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        expect(mockGetAiContent).toHaveBeenCalledTimes(1);

        await act(async () => { aiContent.setPrompt("Now ask something else entirely"); });
        await pressUpdate(aiContent);

        expect(mockGetAiContent).toHaveBeenCalledTimes(2);
        expect(mockGetAiContent.mock.calls[1][0].dynamicContentPrompt)
          .toContain("Now ask something else entirely");
      });

      // systemPrompt is authored, and is sent with every request. A change to it changes what
      // the model is told to do, even though the document and the tile's prompt are untouched.
      it("sends the request when the system prompt changed but the document did not", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        expect(mockGetAiContent).toHaveBeenCalledTimes(1);

        mockStores.appConfig.getSetting.mockImplementation((key: string, category: string) =>
          key === "systemPrompt" && category === "ai" ? "You are a terse AI assistant." : undefined);

        await pressUpdate(aiContent);

        expect(mockGetAiContent).toHaveBeenCalledTimes(2);
      });

      // An OpenAI failure is cached server-side as empty text, and the retry that reads that
      // cache entry reports no error at all. Taken at face value it would blank the analysis and
      // record the hash, leaving the student unable to retry.
      it("on an empty response, keeps the analysis, reports failure, and does not record the gate",
         async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        expect(aiContent.text).toBe("Mocked customized content");
        const goodHash = aiContent.evaluatedRequestHash;

        editDocument();
        mockGetAiContent.mockResolvedValueOnce({ data: { text: "", error: null } });
        await pressUpdate(aiContent);

        expect(aiContent.text).toBe("Mocked customized content");
        expect(screen.queryByText(AI_TILE_REQUEST_FAILED_MESSAGE)).toBeInTheDocument();
        // Still the hash of the request that really produced this analysis, so the next refresh
        // of the edited document goes through rather than being told nothing has changed.
        expect(aiContent.evaluatedRequestHash).toBe(goodHash);
      });

      // Under lock contention the server hands back whatever the lock holder generated, which can
      // be an answer for a different revision of this tile. Recording our hash against it would
      // gate away the request we actually made.
      it("does not record the gate when the server answered a different prompt", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        const goodHash = aiContent.evaluatedRequestHash;

        editDocument();
        mockGetAiContent.mockResolvedValueOnce(
          { data: { text: "an answer to someone else's prompt", prompt: "a different prompt" } });
        await pressUpdate(aiContent);

        expect(aiContent.text).toBe("an answer to someone else's prompt");
        expect(aiContent.evaluatedRequestHash).toBe(goodHash);
      });

      // A mount is nobody asking, and the nudge is document content: writing it would replace the
      // saved answer permanently, for a student who never pressed anything. This is the student
      // case -- a copied tile has hidePrompt set, so there is no Update button in a workspace.
      it("on mount with nothing changed, makes no request and leaves the saved answer alone", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        mockGetAiContent.mockClear();
        aiContent.setText("the saved answer");

        await renderTile(aiModel);

        expect(aiContent.text).toBe("the saved answer");
        expect(mockGetAiContent).not.toHaveBeenCalled();
      });

      // Update exists only in the authoring view. Leaving the old text there would look like a
      // refresh that silently did nothing.
      it("on an Update with nothing changed, shows the nudge and makes no request", async () => {
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const { aiContent, aiModel } = tileWithPrompt();

        await renderTile(aiModel);
        mockGetAiContent.mockClear();

        await pressUpdate(aiContent);

        expect(screen.queryByText(AI_TILE_UNCHANGED_MESSAGE)).toBeInTheDocument();
        // The nudge is shown beside the analysis, never written over it.
        expect(aiContent.text).toBe("Mocked customized content");
        expect(mockGetAiContent).not.toHaveBeenCalled();
      });
    });

    describe("the unit-summary slice", () => {
      // Matches mockStores.unit's investigations tree (ordinals "1.1"/"1.2", the same titles).
      function unitSummaryWithDigest(digest: string) {
        return {
          generatedAt: "2026-01-01T00:00:00.000Z", sourceHash: "h", overview: "o",
          sourceManifest: [
            { ordinal: "1.1", title: "Problem 1.1", problemHash: "h1" },
            { ordinal: "1.2", title: "Problem 1.2", problemHash: "h2" },
          ],
          entries: [
            { ordinal: "1.1", priorKnowledge: "", problemDigest: digest },
            { ordinal: "1.2", priorKnowledge: "knows things", problemDigest: "digest two" },
          ],
        };
      }
      const unitContextHeading = "This is a summary of the unit's current and nearby problems.";

      it("in a curriculum document of the loaded unit, prepends the slice ahead of the document " +
         "summary", async () => {
        mockStores.unit.config = { aiUnitSummary: unitSummaryWithDigest("digest one") };
        mockStores.documents.getDocument.mockReturnValue(
          documentWith(populatedDocContent(), { unit: "test-unit", investigation: "1", problem: "1" })
        );
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        const aiModel = TileModel.create({ content: aiContent });

        await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

        const [request] = mockGetAiContent.mock.calls[0];
        expect(request.dynamicContentPrompt).toContain(unitContextHeading);
        expect(request.dynamicContentPrompt).toContain("digest one");
        expect(request.dynamicContentPrompt).toContain("The student's answer.");
        // The unit context comes first, ahead of the document summary.
        expect(request.dynamicContentPrompt.indexOf(unitContextHeading))
          .toBeLessThan(request.dynamicContentPrompt.indexOf("The student's answer."));
      });

      it("in a personal document (no curriculum fields), sends no unit-summary slice", async () => {
        mockStores.unit.config = { aiUnitSummary: unitSummaryWithDigest("digest one") };
        mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        const aiModel = TileModel.create({ content: aiContent });

        await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

        const [request] = mockGetAiContent.mock.calls[0];
        expect(request.dynamicContentPrompt).not.toContain(unitContextHeading);
        expect(request.dynamicContentPrompt).toContain("The student's answer.");
      });

      it("in a document from a different unit than the one loaded, sends no unit-summary slice", async () => {
        mockStores.unit.config = { aiUnitSummary: unitSummaryWithDigest("digest one") };
        mockStores.documents.getDocument.mockReturnValue(
          documentWith(populatedDocContent(), { unit: "other-unit", investigation: "1", problem: "1" })
        );
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        const aiModel = TileModel.create({ content: aiContent });

        await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

        const [request] = mockGetAiContent.mock.calls[0];
        expect(request.dynamicContentPrompt).not.toContain(unitContextHeading);
        expect(request.dynamicContentPrompt).toContain("The student's answer.");
      });

      it("for a unit with no aiUnitSummary authored, sends no unit-summary slice even for a " +
         "matching document", async () => {
        mockStores.documents.getDocument.mockReturnValue(
          documentWith(populatedDocContent(), { unit: "test-unit", investigation: "1", problem: "1" })
        );
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        const aiModel = TileModel.create({ content: aiContent });

        await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

        const [request] = mockGetAiContent.mock.calls[0];
        expect(request.dynamicContentPrompt).not.toContain(unitContextHeading);
        expect(request.dynamicContentPrompt).toContain("The student's answer.");
      });

      it("when the summary's sourceManifest no longer matches the unit's live problems, sends no " +
         "unit-summary slice", async () => {
        const staleSummary = unitSummaryWithDigest("digest one");
        staleSummary.sourceManifest = [
          { ordinal: "1.1", title: "Renamed Problem", problemHash: "h1" },
          { ordinal: "1.2", title: "Problem 1.2", problemHash: "h2" },
        ];
        mockStores.unit.config = { aiUnitSummary: staleSummary };
        mockStores.documents.getDocument.mockReturnValue(
          documentWith(populatedDocContent(), { unit: "test-unit", investigation: "1", problem: "1" })
        );
        const aiContent = defaultAIContent();
        aiContent.setPrompt("What do you think?");
        const aiModel = TileModel.create({ content: aiContent });

        await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

        const [request] = mockGetAiContent.mock.calls[0];
        expect(request.dynamicContentPrompt).not.toContain(unitContextHeading);
        expect(request.dynamicContentPrompt).toContain("The student's answer.");
      });
    });

    // A read-only rendering (e.g. a teacher's 4-up view of another student's document) hides the
    // Update button entirely, so mounting is the only thing that could otherwise trigger a request.
    it("in a read-only rendering of a populated document, never calls getAiContent, on mount", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(
        <ReadOnlyContext.Provider value={true}>
          <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
        </ReadOnlyContext.Provider>
      ));

      expect(mockGetAiContent).not.toHaveBeenCalled();
      expect(aiContent.text).toBe(authoredText);
    });

    it("in a read-only rendering of a populated document, a programmatic refresh still makes no " +
       "request", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const authoredText = aiContent.text;
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(
        <ReadOnlyContext.Provider value={true}>
          <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
        </ReadOnlyContext.Provider>
      ));

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockGetAiContent).not.toHaveBeenCalled();
      expect(aiContent.text).toBe(authoredText);
    });

    // previousText here is the model's non-empty authored default, so this distinguishes
    // "restored" from "left blank" — the next test covers a real prior response.
    // The student did not ask for the mount-time refresh, so a transient failure there must not
    // replace a good prior answer with an error -- which is document content, saved, synced and
    // visible to the teacher.
    it("on a populated document, when the automatic mount refresh rejects: the previous text is " +
       "restored, Loading is gone, and nothing escapes as an unhandled rejection", async () => {
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

    // refreshCount stays positive after an Update, so classifying on "> 0" would make a later
    // automatic request — here a remount of the same model, as happens when a document view is
    // closed and reopened — look student-requested, and let its failure overwrite a good saved
    // answer with an error nobody asked for.
    it("after a successful Update, a failure on a remount of the same model still restores",
       async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { unmount } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

      editDocument();
      // A real Update that succeeds, leaving refreshCount positive.
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "a good answer" } });
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("a good answer");

      unmount();

      editDocument();
      const callsBefore = mockGetAiContent.mock.calls.length;
      mockGetAiContent.mockRejectedValueOnce(new Error("network error"));
      await act(async () => render(
        <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
      ));

      // Without this the test could pass by the remount never making a request at all.
      expect(mockGetAiContent.mock.calls.length).toBe(callsBefore + 1);
      expect(aiContent.text).toBe("a good answer");
    });

    // The student clicked Update, so restoring the old text would look exactly like a refresh
    // that did nothing. This is the case the durable message exists for.
    it("on a populated document, when a student-requested refresh rejects: the failure message " +
       "is shown and the last analysis is left in place", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      mockGetAiContent.mockRejectedValueOnce(new Error("network error"));
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(queryByText(AI_TILE_REQUEST_FAILED_MESSAGE)).toBeInTheDocument();
      // A failed request must not cost the student the analysis they already had.
      expect(aiContent.text).toBe("Mocked customized content");
    });

    // The tile can be deleted while a request is in flight. Pins that the catch block's isAlive
    // guard keeps the original error from being hidden by a write to the now-destroyed node, and
    // from escaping as an unhandled rejection.
    it("on a populated document, when the tile is deleted before getAiContent rejects, the " +
       "original error is still logged and nothing escapes as an unhandled rejection", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      let rejectRequest: (error: Error) => void = () => {};
      mockGetAiContent.mockImplementationOnce(
        () => new Promise((_resolve, reject) => { rejectRequest = reject; })
      );
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
      process.on("unhandledRejection", onUnhandledRejection);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      // Jest doesn't run src/initialize-app.tsx, so liveliness checking is MST's default, "warn",
      // which only logs use of a destroyed node; this test needs it to throw.
      const previousLivelinessChecking = getLivelinessChecking();
      setLivelinessChecking("error");

      try {
        const { unmount } = await act(async () => render(
          <AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />
        ));

        // Simulates the tile itself being deleted while the request is in flight: the component
        // unmounts (as it would when its tile is removed from the document), and the underlying
        // model is destroyed. Unmounting first avoids the observer re-rendering against a model
        // that's already been torn down, which would fail for an unrelated reason.
        unmount();
        unprotect(aiModel);
        destroy(aiModel);
        const networkError = new Error("network error");
        await act(async () => {
          rejectRequest(networkError);
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to query AI", networkError);
        expect(unhandledRejections).toEqual([]);
      } finally {
        setLivelinessChecking(previousLivelinessChecking);
        process.removeListener("unhandledRejection", onUnhandledRejection);
        consoleErrorSpy.mockRestore();
      }
    });

    // console.error reaches nobody, since Rollbar captures uncaught errors and not caught ones, so
    // the log event is the only record a tile failure leaves.
    it("on a populated document, logs a failed request, and logs nothing for a superseded one",
       async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));

      (Logger.log as jest.Mock).mockClear();
      (logTileChangeEvent as jest.Mock).mockClear();
      editDocument();
      mockGetAiContent.mockRejectedValueOnce(new Error("network error"));
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      const failures = (Logger.log as jest.Mock).mock.calls.filter(
        ([event]) => event === LogEventName.AI_TILE_REQUEST_FAILED);
      expect(failures).toHaveLength(1);
      expect(failures[0][1]).toMatchObject({ tileId: aiModel.id, userRequested: true });
      // The refresh click is a real tile change and belongs on that helper; the failure is not,
      // and must stay off it -- that helper is what cascades into QUESTION_ANSWERS_CHANGE,
      // carrying the question prompt and sibling answers, for a tile inside a Question tile.
      expect((logTileChangeEvent as jest.Mock).mock.calls.map(([, params]) => params.operation))
        .toEqual(["requestRefresh"]);

      // A superseded run is not a failure: its rejection must log nothing.
      let rejectOlderRun: (error: Error) => void;
      const promiseOlder = new Promise((_resolve, reject) => { rejectOlderRun = reject; });
      mockGetAiContent.mockImplementationOnce(() => promiseOlder);
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "newer response" } });
      await act(async () => { aiContent.requestRefresh(); await Promise.resolve(); });
      await act(async () => { aiContent.requestRefresh(); await Promise.resolve(); await Promise.resolve(); });

      (Logger.log as jest.Mock).mockClear();
      await act(async () => {
        rejectOlderRun!(new Error("stale network error"));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect((Logger.log as jest.Mock).mock.calls.filter(
        ([event]) => event === LogEventName.AI_TILE_REQUEST_FAILED)).toHaveLength(0);
    });

    // getAiContent resolves (not rejects) on a server-side failure, a distinct path from the
    // rejection tests above.
    it("on a populated document, when a later refresh's response carries a server-side error: " +
       "the failure message is shown, and the error is logged", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      // First render succeeds and leaves a real AI response in place.
      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "", error: "Backend exploded" } });
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(queryByText(AI_TILE_REQUEST_FAILED_MESSAGE)).toBeInTheDocument();
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

      editDocument();
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

      editDocument();
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

    it("a request started while classHash was present is restored, with loading cleared, as " +
       "soon as classHash clears — its late response is then discarded", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      let resolvePending: (value: { data: { text: string } }) => void;
      const pendingPromise = new Promise<{ data: { text: string } }>(resolve => { resolvePending = resolve; });
      mockGetAiContent.mockImplementationOnce(() => pendingPromise);

      // Start a request while classHash is present.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });
      expect(queryByText("Loading...")).toBeInTheDocument();

      // classHash clears; the refresh makes no request of its own, but must clear loading, since
      // nothing else is left running to do it -- the in-flight run's own finally is now a no-op.
      mockUserContext = mockUserContextWithoutClassHash;
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Mocked customized content");
      expect(queryByText("Loading...")).not.toBeInTheDocument();

      // The original request's late response must not undo that restoration.
      await act(async () => {
        resolvePending!({ data: { text: "Late response" } });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Mocked customized content");
    });

    it("a later invalidation with no successor request does not roll back a response a " +
       "still-current request already applied", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      // A refresh succeeds with a new response while classHash is still present.
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "Newer response" } });
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Newer response");

      // classHash then clears; nothing is left to invalidate, so this must not restore the
      // pre-refresh text.
      mockUserContext = mockUserContextWithoutClassHash;
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });

      expect(aiContent.text).toBe("Newer response");
    });

    // The analysis is the student's to read while they work, so a refresh must not clear it to
    // make room for the next one. This is what makes the loading state additive rather than a
    // replacement, and it is why nothing restores a saved copy any more: nothing blanks it.
    it("leaves the previous analysis on screen while a refresh is in flight", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      const { queryByText } = await act(async () =>
        render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />)
      );
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      mockGetAiContent.mockImplementationOnce(() => new Promise(() => { /* never settles */ }));

      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });

      expect(queryByText("Loading...")).toBeInTheDocument();
      expect(aiContent.text).toBe("Mocked customized content");
      expect(queryByText("Mocked customized content")).toBeInTheDocument();
    });

    it("a refresh started while an earlier one is still in flight ends with its own response, " +
       "and the analysis is never blank in between", async () => {
      mockStores.documents.getDocument.mockReturnValue(documentWith(populatedDocContent()));
      const aiContent = defaultAIContent();
      aiContent.setPrompt("What do you think?");
      const aiModel = TileModel.create({ content: aiContent });

      await act(async () => render(<AIComponent {...defaultProps} model={aiModel} documentId="test-doc-1" />));
      expect(aiContent.text).toBe("Mocked customized content");

      editDocument();
      mockGetAiContent.mockImplementationOnce(() => new Promise(() => { /* A never settles */ }));
      mockGetAiContent.mockResolvedValueOnce({ data: { text: "B's response" } });

      // A starts.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("Mocked customized content");

      // B starts before A settles, and succeeds with its own response.
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("B's response");

      // classHash clearing afterward has nothing to undo.
      mockUserContext = mockUserContextWithoutClassHash;
      await act(async () => {
        aiContent.requestRefresh();
        await Promise.resolve();
      });
      expect(aiContent.text).toBe("B's response");
    });
  });

});
