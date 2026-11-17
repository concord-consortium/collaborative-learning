import { observable, runInAction } from "mobx";
import { deferred } from "promise-assist";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { PersonalDocument } from "../../models/document/document-types";
import { FakeRtdbEnvelopeRef, flush } from "../../models/document/content-save-sender-test-utils";
import { getContentSaveSender } from "../../models/document/get-content-save-sender";
import { getHistoryEntriesAfter, getLastHistoryEntry } from "../../models/history/history-firestore";
import { TreeManagerType } from "../../models/history/tree-manager";
import { DocumentsModel } from "../../models/stores/documents";
import { UserContextProvider } from "../../models/stores/user-context-provider";
import { Firestore } from "../firestore";
import { hashString } from "../../utilities/js-utils";
import { DBDocumentsContentListener } from "./db-docs-content-listener";

jest.mock("../../models/history/history-firestore", () => ({
  getLastHistoryEntry: jest.fn(),
  getHistoryEntriesAfter: jest.fn(),
  loadHistory: jest.fn(() => jest.fn())
}));

const mockGetLastHistoryEntry = getLastHistoryEntry as jest.Mock;
const mockGetHistoryEntriesAfter = getHistoryEntriesAfter as jest.Mock;

// The content listener, the content save sender and the catch-up together, for an individual
// document that closes while its last edit is still being saved.
describe("closing an individual document while its content is saved", () => {
  const contentPath = "users/1/documents/personal";
  const loadedEnvelope = { lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } };

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    mockGetLastHistoryEntry.mockResolvedValue({ id: "e5", index: 5 });
    mockGetHistoryEntriesAfter.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup() {
    const uploads: Array<{ id: string, data: any, done: ReturnType<typeof deferred<void>> }> = [];
    const firestore = {
      doc: jest.fn(() => ({
        get: jest.fn(async () => ({ exists: true })),
        onSnapshot: jest.fn((callback: (doc: { exists: boolean }) => void) => {
          callback({ exists: true });
          return jest.fn();
        })
      })),
      getFullPath: jest.fn((path: string) => path),
      documentRef: jest.fn((_path: string, id: string) => ({
        set: jest.fn((data: any) => {
          const done = deferred<void>();
          uploads.push({ id, data, done });
          return done.promise;
        })
      })),
      timestamp: jest.fn(() => new Date())
    } as unknown as Firestore;
    const docs = DocumentsModel.create({});
    docs.setFirestore(firestore);
    docs.setUserContextProvider({ userContext: { uid: "1" } } as unknown as UserContextProvider);

    const document: DocumentModelType = createDocumentModel({
      type: PersonalDocument, uid: "1", key: "personal", createdAt: 1,
      content: DocumentContentModel.create({ tileMap: { t1: { id: "t1", content: { type: "TestTile" } } } }) as any
    });
    document.setLoadedEnvelope(loadedEnvelope);
    document.setSavedEnvelope(loadedEnvelope);
    docs.add(document);
    const treeManager = document.treeManagerAPI as TreeManagerType;
    // The content listener replaces the tile along with the content.
    const text = () => (document.content!.tileMap.get("t1")!.content as any).text;
    const setText = (value: string) => (document.content!.tileMap.get("t1")!.content as any).setText(value);

    const problemWorkspace = observable({ primaryDocumentKey: "personal" as string | undefined,
      comparisonDocumentKey: undefined as string | undefined });
    const handlers: Record<string, (snapshot: { val: () => any }) => void> = {};
    const db: any = {
      stores: {
        documents: docs,
        groups: { groupIdForUser: () => undefined },
        persistentUI: { problemWorkspace },
        user: { id: "1", isTeacher: false }
      },
      firebase: {
        ref: (path: string) => ({
          on: (_event: string, cb: (snapshot: { val: () => any }) => void) => { handlers[path] = cb; },
          off: () => { delete handlers[path]; }
        }),
        getUserDocumentPath: (_user: any, key: string, uid: string) => `users/${uid}/documents/${key}`
      },
      parseDocumentContent: (dbDoc: any) => JSON.parse(dbDoc.content)
    };
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    // Opens the document for editing, as the document's sync hook does once it has caught up.
    async function open() {
      runInAction(() => { problemWorkspace.primaryDocumentKey = "personal"; });
      await docs.historyCatchUp(document);
      document.treeMonitor!.enableMonitoring();
      const rtdbEnvelopeRef = new FakeRtdbEnvelopeRef();
      const sender = getContentSaveSender(document, { rtdbEnvelopeRef, updateTools: () => Promise.resolve() });
      return { rtdbEnvelopeRef, sender };
    }

    function close(sender: { detach(): void }) {
      document.treeMonitor!.disableMonitoring();
      sender.detach();
      runInAction(() => { problemWorkspace.primaryDocumentKey = undefined; });
    }

    return { docs, document, treeManager, text, setText, uploads, handlers, listener, open, close };
  }

  it("doesn't replace the content until the last save settles, then keeps the session exact", async () => {
    const { document, treeManager, text, setText, uploads, handlers, listener, open, close } = setup();
    const { rtdbEnvelopeRef, sender } = await open();
    expect(treeManager.exactness.exactSince).toBe("e2");

    setText("alpha");
    await flush();
    expect(uploads).toHaveLength(1);
    uploads[0].done.resolve();
    await flush();
    jest.advanceTimersByTime(1000);
    expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);

    // The document closes with its last save in flight, so the RTDB content is still the loaded one.
    close(sender);
    expect(document.contentSaveActive).toBe(true);
    expect(handlers[contentPath]).toBeUndefined();

    rtdbEnvelopeRef.writes[0].resolve();
    await flush();
    expect(document.contentSaveActive).toBe(false);
    handlers[contentPath]({ val: () => rtdbEnvelopeRef.writes[0].values });
    expect(text()).toBe("alpha");
    expect(document.historyCatchUpPending).toBe(false);
    expect(treeManager.exactness.isExact).toBe(true);

    listener.stop();
  });

  it("catches content older than this session's commits up through them when it is opened again",
      async () => {
    const { docs, document, treeManager, text, setText, uploads, handlers, listener, open, close } = setup();
    const { rtdbEnvelopeRef, sender } = await open();
    setText("alpha");
    await flush();
    uploads[0].done.resolve();
    await flush();
    jest.advanceTimersByTime(1000);
    rtdbEnvelopeRef.writes[0].resolve();
    await flush();
    close(sender);

    // The loaded content comes back, as when the caught-up content wasn't saved.
    const content = JSON.stringify({ tileMap: { t1: { id: "t1", content: { type: "TestTile" } } } });
    handlers[contentPath]({ val: () => ({ content, lastHistoryEntryId: "e5",
      exactThrough: { id: "e5", index: 5, contentHash: hashString(content), since: "e2" } }) });
    expect(text()).toBeUndefined();
    expect(document.historyCatchUpPending).toBe(true);

    // The catch-up runs again against this session's newest commit, not the entry read at load.
    expect(document.savedEnvelope).toEqual(loadedEnvelope);
    const upload = uploads[0];
    mockGetHistoryEntriesAfter.mockResolvedValue([{ id: upload.id, index: upload.data.index,
      previousEntryId: upload.data.previousEntryId, entry: JSON.parse(upload.data.entry) }]);
    await docs.historyCatchUp(document);
    expect(mockGetHistoryEntriesAfter).toHaveBeenCalledWith(expect.anything(), expect.anything(), 5, 6);
    expect(text()).toBe("alpha");
    expect(treeManager.exactness.exactSince).toBe("e2");
    expect(treeManager.exactness.isExact).toBe(true);

    listener.stop();
  });
});
