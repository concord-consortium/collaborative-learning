import { applySnapshot } from "mobx-state-tree";
import { Firestore } from "../../lib/firestore";
import { createDocumentModel, ISavedEnvelope } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { UserContextProvider } from "../stores/user-context-provider";
import { getContentHistoryEntryId } from "./content-history-entry";
import { FirestoreHistoryManager } from "./firestore-history-manager";
import { TreeManagerType } from "./tree-manager";

const exact: ISavedEnvelope = { lastHistoryEntryId: "e1", exactThrough: { index: 1, since: "e0" } };

// An envelope of null leaves the document without one.
interface ISetupOptions { concurrent?: boolean; envelope?: ISavedEnvelope | null }
function setup({ concurrent = false, envelope = exact }: ISetupOptions = {}) {
  const document = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "doc-1", concurrent: concurrent || undefined,
    content: DocumentContentModel.create({}) as any
  });
  document.setSavedEnvelope(envelope ?? undefined);
  const treeManager = document.treeManagerAPI as TreeManagerType;
  return { document, treeManager };
}

function attachManager(treeManager: TreeManagerType) {
  const firestore = {
    doc: () => ({ onSnapshot: () => () => undefined }),
    getFullPath: (path: string) => path
  } as unknown as Firestore;
  const manager = new FirestoreHistoryManager({
    firestore, treeManager, uploadLocalHistory: true, syncRemoteHistory: false,
    userContextProvider: { userContext: { uid: "1" } } as unknown as UserContextProvider
  });
  treeManager.setHistoryManager(manager);
  return manager;
}

describe("getContentHistoryEntryId", () => {
  it("is the envelope's entry when the envelope is exact", () => {
    expect(getContentHistoryEntryId(setup().document)).toBe("e1");
  });

  it("isn't known for an unmarked envelope, a concurrent document, or a document with entries from this session",
      () => {
    expect(getContentHistoryEntryId(setup({ envelope: { lastHistoryEntryId: "e1" } }).document)).toBeUndefined();
    expect(getContentHistoryEntryId(setup({ envelope: null }).document)).toBeUndefined();
    expect(getContentHistoryEntryId(setup({ concurrent: true }).document)).toBeUndefined();
    const { document, treeManager } = setup();
    applySnapshot(treeManager.document, { history: [{ id: "local" }] });
    expect(getContentHistoryEntryId(document)).toBeUndefined();
  });

  it("is the last entry the catch-up applied, until the content is replaced along with its envelope", () => {
    const { document, treeManager } = setup();
    const manager = attachManager(treeManager);
    manager.caughtUpTo = { id: "e3", index: 3 };
    manager.caughtUpFrom = exact;
    expect(getContentHistoryEntryId(document)).toBe("e3");
    document.setSavedEnvelope({ lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e0" } });
    expect(getContentHistoryEntryId(document)).toBe("e5");
  });
});
