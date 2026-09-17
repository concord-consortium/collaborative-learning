import { act, configure, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "mobx-react";
import { DocumentComponent } from "./document";
import { createDocumentModel, DocumentModelType, SaveState } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { ProblemWorkspace, WorkspaceModel } from "../../models/stores/workspace";
import { specStores } from "../../models/stores/spec-stores";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { createSingleTileContent } from "../../utilities/test-utils";
import { kAnalyzerUserParams } from "../../../shared/shared";
import { IDEAS_EMPTY_MESSAGE, IDEAS_REQUEST_FAILED_MESSAGE } from "../../models/document/ai-evaluation-messages";
import { kIdeasRequestDeadlineMs } from "../../models/document/document-comments-manager";
import { logDocumentEvent } from "../../models/document/log-document-event";
import { LogEventName } from "../../lib/logger-types";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

configure({ testIdAttribute: "data-test" });

// Keep the render tree small and focused on the titlebar / Ideas button.
jest.mock("./document-annotation-toolbar", () => ({
  DocumentAnnotationToolbar: () => null
}));
jest.mock("./document-file-menu", () => ({
  DocumentFileMenu: () => null
}));
jest.mock("./mywork-document-or-browser", () => ({
  MyWorkDocumentOrBrowser: () => null
}));

jest.mock("../../models/document/log-document-event", () => ({
  logDocumentEvent: jest.fn(),
  logDocumentViewEvent: jest.fn()
}));

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderDocument(document: DocumentModelType, stores: ReturnType<typeof specStores>) {
  const workspace = WorkspaceModel.create({ type: ProblemWorkspace, mode: "1-up" });
  const ref = React.createRef<DocumentComponent>();
  render(
    <Provider stores={stores}>
      <DocumentComponent ref={ref} stores={stores} document={document} workspace={workspace} side="primary" />
    </Provider>
  );
  return ref;
}

function makeStores(aiEvaluation?: "categorize-design" | "custom") {
  // Forced on so the button renders regardless of aiEvaluation — that scenario is about what
  // the click handler does, not whether the button itself shows.
  const appConfig = specAppConfig({ config: { aiEvaluation, showIdeasButton: true } });
  const stores = specStores({ appConfig });
  jest.spyOn(stores.db.firebase, "setLastEditedNow").mockResolvedValue(undefined as any);
  jest.spyOn(stores.db.firebase, "getLastEditedTimestamp").mockResolvedValue(1000 as any);
  jest.spyOn(stores.db.firebase, "getEvaluationStatusPath").mockReturnValue("status/path");
  jest.spyOn(stores.db.firebase, "ref").mockReturnValue({ on: jest.fn(), off: jest.fn() } as any);
  return stores;
}

function emptyDocument() {
  return createDocumentModel({
    type: ProblemDocument, uid: "u1", key: "doc1", createdAt: 1, content: {}
  });
}

function populatedDocument() {
  return createDocumentModel({
    type: ProblemDocument, uid: "u1", key: "doc1", createdAt: 1,
    content: createSingleTileContent({ type: "Text", format: "markdown", text: "hello" })
  });
}

function clickIdeas() {
  fireEvent.click(screen.getByTestId("ideas-button"));
}

describe("Ideas button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Guards against a failed assertion in the deadline test below leaving fake timers on for
    // later tests.
    jest.useRealTimers();
  });

  it("on an empty document: no evaluation write, no log, nudge shown, gate not raised", async () => {
    const stores = makeStores("categorize-design");
    const document = emptyDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();

    expect(stores.persistentUI.showChatPanel).toBe(true);
    expect(stores.db.firebase.setLastEditedNow).not.toHaveBeenCalled();
    expect(logDocumentEvent).not.toHaveBeenCalled();
    expect(document.commentsManager?.latestIdeasRequestId).toBeNull();
    expect(document.commentsManager?.statusMessage).toMatchObject({ message: IDEAS_EMPTY_MESSAGE });
    expect(document.commentsManager?.canRequestIdeas).toBe(true);
    // The gate is not raised by an empty click, so the button stays enabled while the nudge shows.
    expect(screen.getByTestId("ideas-button")).not.toBeDisabled();
  });

  it("on an empty document, a second click re-shows the nudge and still makes no request", async () => {
    const stores = makeStores("categorize-design");
    const document = emptyDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();
    document.commentsManager?.clearStatusMessage();
    clickIdeas();
    await flushMicrotasks();

    expect(document.commentsManager?.statusMessage).toMatchObject({ message: IDEAS_EMPTY_MESSAGE });
    expect(stores.db.firebase.setLastEditedNow).not.toHaveBeenCalled();
    expect(logDocumentEvent).not.toHaveBeenCalled();
  });

  it("on a populated document: setLastEditedNow and the log both fire, a requestId is recorded " +
     "before the save wait resolves, and an entry is queued with that id", async () => {
    const stores = makeStores("categorize-design");
    const document = populatedDocument();
    document.setSaveState(SaveState.Saving);
    renderDocument(document, stores);

    clickIdeas();
    // No await has run yet, so this confirms the id was recorded before any async gap.
    expect(document.commentsManager?.latestIdeasRequestId).toEqual(expect.any(String));
    const requestId = document.commentsManager?.latestIdeasRequestId;

    // waitForSaveSettled is still waiting on Saving -> Saved.
    document.setSaveState(SaveState.Saved);
    await flushMicrotasks();

    expect(stores.db.firebase.setLastEditedNow)
      .toHaveBeenCalledWith(stores.user, document.key, document.uid, undefined, requestId);
    expect(logDocumentEvent).toHaveBeenCalledWith(LogEventName.REQUEST_IDEA, { document });
    expect(document.commentsManager?.pendingComments).toHaveLength(1);
    expect(document.commentsManager?.pendingComments[0]).toMatchObject({ requestId, postingType: "remote" });
    expect(stores.db.firebase.getEvaluationStatusPath)
      .toHaveBeenCalledWith(stores.user, document.key, document.uid, requestId);
    expect(stores.db.firebase.ref).toHaveBeenCalledWith("status/path");
  });

  it("a status already present at the path when the listener attaches (a previous request's) " +
     "does not resolve or nudge anything", async () => {
    const stores = makeStores("categorize-design");
    // Firebase delivers the current value synchronously as soon as a "value" listener attaches.
    // Simulate that here with a status left over from an earlier, unrelated request.
    const staleStatus = { outcome: "skipped-empty", requestId: "stale-request-id", docUpdated: 1, completedAt: 1 };
    (stores.db.firebase.ref as jest.Mock).mockReturnValue({
      on: jest.fn((eventType: string, callback: (snapshot: any) => void) => callback({ val: () => staleStatus })),
      off: jest.fn()
    });
    const document = populatedDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();

    // The stale status's requestId doesn't match this click's, so it neither resolves the new
    // entry nor shows the nudge, regardless of whether it "arrives" before or after queueing.
    expect(document.commentsManager?.pendingComments).toHaveLength(1);
    expect(document.commentsManager?.statusMessage).toBeNull();
  });

  it("on a populated document, the queued entry still resolves on an arriving comment, and the " +
     "status listener is detached", async () => {
    const stores = makeStores("categorize-design");
    const document = populatedDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();
    expect(document.commentsManager?.pendingComments).toHaveLength(1);
    // `ref()` is mocked to always return the same object, so this is the listener the handler
    // attached; `.off` should not have been called on it while the entry is still pending.
    const statusRef = stores.db.firebase.ref("status/path");
    expect(statusRef.off).not.toHaveBeenCalled();

    act(() => {
      document.commentsManager?.setComments([{
        id: "ai-1",
        uid: kAnalyzerUserParams.id,
        name: "Ada Insight",
        content: "hi",
        createdAt: new Date(Date.now() + 60_000),
        network: "test"
      }]);
    });

    expect(statusRef.off).toHaveBeenCalled();

    expect(document.commentsManager?.pendingComments).toHaveLength(0);
  });

  it("on a populated document in a unit with aiEvaluation unset: fires as today, queues and " +
     "subscribes to nothing, and an exemplar comment posts immediately", async () => {
    const stores = makeStores(undefined);
    const document = populatedDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();

    expect(stores.db.firebase.setLastEditedNow)
      .toHaveBeenCalledWith(stores.user, document.key, document.uid, undefined, undefined);
    expect(logDocumentEvent).toHaveBeenCalledWith(LogEventName.REQUEST_IDEA, { document });
    expect(document.commentsManager?.pendingComments).toHaveLength(0);
    expect(stores.db.firebase.ref).not.toHaveBeenCalled();

    const postFunction = jest.fn().mockResolvedValue({ id: "ex1" });
    act(() => {
      document.commentsManager?.queueComment({
        comment: { content: "See if this gives you ideas", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "doc1" },
        source: "exemplar",
        postFunction
      });
    });
    await flushMicrotasks();

    expect(postFunction).toHaveBeenCalled();

    // The gate was only up for the duration of the handler; a click after it returns works again.
    expect(document.commentsManager?.canRequestIdeas).toBe(true);
  });

  it("two synchronous clicks on a populated document produce exactly one evaluation, one queued " +
     "entry, and one log", async () => {
    const stores = makeStores("categorize-design");
    const document = populatedDocument();
    renderDocument(document, stores);

    clickIdeas();
    clickIdeas();
    await flushMicrotasks();

    expect(stores.db.firebase.setLastEditedNow).toHaveBeenCalledTimes(1);
    expect(logDocumentEvent).toHaveBeenCalledTimes(1);
    expect(document.commentsManager?.pendingComments).toHaveLength(1);
  });

  it("a click while an 'ai' remote entry is already pending does nothing", async () => {
    const stores = makeStores("categorize-design");
    const document = populatedDocument();
    renderDocument(document, stores);

    act(() => {
      document.commentsManager?.queueRemoteComment({
        triggeredAt: Date.now(), source: "ai", checkCompleted: () => false
      });
    });

    clickIdeas();
    await flushMicrotasks();

    expect(stores.db.firebase.setLastEditedNow).not.toHaveBeenCalled();
    expect(logDocumentEvent).not.toHaveBeenCalled();
  });

  it("a click while only the nudge is showing re-shows the nudge and makes no request", async () => {
    const stores = makeStores("categorize-design");
    const document = emptyDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();
    expect(document.commentsManager?.statusMessage).not.toBeNull();

    clickIdeas();
    await flushMicrotasks();

    expect(document.commentsManager?.statusMessage).toMatchObject({ message: IDEAS_EMPTY_MESSAGE });
    expect(stores.db.firebase.setLastEditedNow).not.toHaveBeenCalled();
  });

  it("releases the gate and shows a failure message, with no unhandled rejection, when " +
     "setLastEditedNow rejects", async () => {
    const stores = makeStores("categorize-design");
    (stores.db.firebase.setLastEditedNow as jest.Mock).mockRejectedValue(new Error("network error"));
    const document = populatedDocument();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    renderDocument(document, stores);

    // A plain DOM click discards the handler's returned promise — if it still rejected, this
    // would be an unhandled rejection. It no longer does: the failure is caught internally.
    clickIdeas();
    await flushMicrotasks();

    expect(document.commentsManager?.canRequestIdeas).toBe(true);
    expect(document.commentsManager?.statusMessage).toMatchObject({ message: IDEAS_REQUEST_FAILED_MESSAGE });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Ideas request failed:", expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it("releases the gate and shows a failure message if the request exceeds its deadline, and " +
     "does not queue a pending entry once the stalled call eventually resolves", async () => {
    jest.useFakeTimers();
    const stores = makeStores("categorize-design");
    let resolveSetLastEditedNow: () => void = () => undefined;
    (stores.db.firebase.setLastEditedNow as jest.Mock).mockReturnValue(
      new Promise<void>(resolve => { resolveSetLastEditedNow = resolve; })
    );
    const document = populatedDocument();
    renderDocument(document, stores);

    clickIdeas();
    await flushMicrotasks();
    expect(document.commentsManager?.canRequestIdeas).toBe(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(kIdeasRequestDeadlineMs);
    });

    expect(document.commentsManager?.canRequestIdeas).toBe(true);
    expect(document.commentsManager?.statusMessage).toMatchObject({ message: IDEAS_REQUEST_FAILED_MESSAGE });

    // The abandoned call finally resolves after the client already gave up on it.
    await act(async () => {
      resolveSetLastEditedNow();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.commentsManager?.pendingComments).toHaveLength(0);

    jest.useRealTimers();
  });

  it("disables the button while canRequestIdeas is false, and re-enables it once it is true", async () => {
    const stores = makeStores("categorize-design");
    const document = populatedDocument();
    renderDocument(document, stores);

    expect(screen.getByTestId("ideas-button")).not.toBeDisabled();

    act(() => {
      document.commentsManager?.queueRemoteComment({
        triggeredAt: Date.now(), source: "ai", requestId: "req-x", checkCompleted: () => false
      });
    });
    expect(screen.getByTestId("ideas-button")).toBeDisabled();

    act(() => {
      document.commentsManager?.applyEvaluationStatus({
        outcome: "failed", requestId: "req-x", docUpdated: 1, completedAt: 1
      });
    });
    expect(screen.getByTestId("ideas-button")).not.toBeDisabled();
  });
});
