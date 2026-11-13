import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { flow, Instance, types } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { ICommitListener, ICommitSource, ICommittedEntry } from "../history/history-commits";
import { FAKE_HISTORY_ENTRY_ID, IHistoryManager, TreeManagerType } from "../history/tree-manager";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { ConcurrentContentSaveSender } from "./concurrent-content-save-sender";
import { ContentSaveSender, IRtdbEnvelopeRef, IContentSaveSenderOptions } from "./content-save-sender";
import { getContentSaveSender } from "./get-content-save-sender";
import { IndividualContentSaveSender } from "./individual-content-save-sender";
import { createDocumentModel, DocumentModelType } from "./document";
import { DocumentContentModel } from "./document-content";
import { ProblemDocument } from "./document-types";

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
  })
  .actions(self => ({
    setText(value: string) {
      self.text = value;
    },
    setTextLater: flow(function* (value: string, gate: Promise<void>) {
      yield gate;
      self.text = value;
      yield gate;
    }),
    waitWithoutChanging: flow(function* (gate: Promise<void>) {
      yield gate;
    }),
    changeNothing() {
      // Like a tile's setup calls, which run as actions but change nothing
    }
  }));
interface TestTileType extends Instance<typeof TestTile> {}

registerTileContentInfo({
  type: "TestTile",
  modelClass: TestTile,
  defaultContent() {
    return TestTile.create();
  }
});
registerTileComponentInfo({
  type: "TestTile",
  Component: () => { throw new Error("Component not implemented."); },
  tileEltClass: "test-tile"
});

// Reports commits only when a test says so. Like a concurrent document's history manager, it is
// settled while no completed local entry waits to commit, no upload runs and no remote entries are
// applied.
class StubCommitSource implements IHistoryManager, ICommitSource {
  lastCommitted: ICommittedEntry | undefined = undefined;
  caughtUpTo: ICommittedEntry | undefined = undefined;
  applying = false;
  uploading = false;
  uncommitted: string[] = [];
  expectedRemoteHead: string | null = null;
  expectedRemoteHeadIndex: number | undefined = undefined;
  private listeners = new Set<ICommitListener>();
  private nextIndex = 1;

  constructor() {
    makeObservable(this, {
      applying: observable, uploading: observable, uncommitted: observable.ref,
      expectedRemoteHead: observable, expectedRemoteHeadIndex: observable, isHistorySettled: computed,
      setApplying: action, setUploading: action, setRemoteHead: action, onHistoryEntryCompleted: action
    });
  }

  get isHistorySettled() {
    return this.uncommitted.length === 0 && !this.uploading && !this.applying;
  }

  onHistoryEntryCompleted(_document: unknown, entry: { id: string }) {
    this.uncommitted = [...this.uncommitted, entry.id];
  }

  addCommitListener(listener: ICommitListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  commit(...ids: string[]) {
    const entries = ids.map(id => ({ id, index: this.nextIndex++ }));
    const last = entries[entries.length - 1];
    this.lastCommitted = last;
    runInAction(() => {
      this.uncommitted = this.uncommitted.filter(id => !ids.includes(id));
      this.setRemoteHead(last.id, last.index);
    });
    this.listeners.forEach(listener => listener.onCommitted(entries));
  }

  voidUncommitted() {
    this.listeners.forEach(listener => listener.onUncommittedVoided("remote-entry"));
  }

  setApplying(applying: boolean) {
    this.applying = applying;
  }

  // A fork rollback removes local entries that will never commit.
  rollBack(...ids: string[]) {
    runInAction(() => { this.uncommitted = this.uncommitted.filter(id => !ids.includes(id)); });
  }

  setUploading(uploading: boolean) {
    this.uploading = uploading;
  }

  setRemoteHead(id: string, index: number) {
    this.expectedRemoteHead = id;
    this.expectedRemoteHeadIndex = index;
    this.nextIndex = Math.max(this.nextIndex, index + 1);
  }

  // The head moves to another writer's entry, which takes the next index.
  advanceRemoteHead(id: string) {
    this.setRemoteHead(id, this.nextIndex);
  }
}

type ValueCallback = (snapshot: { val(): unknown }) => void;

interface IFakeWrite {
  values: Record<string, any>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class FakeRtdbEnvelopeRef implements IRtdbEnvelopeRef {
  writes: IFakeWrite[] = [];
  update = jest.fn((values: Record<string, any>) => {
    const { promise, resolve, reject } = deferred<void>();
    this.writes.push({ values, resolve: () => resolve(), reject });
    return promise;
  });
  private listeners = new Map<string, Set<ValueCallback>>();
  child(path: string) {
    return {
      on: (_event: "value", cb: ValueCallback) => {
        if (!this.listeners.has(path)) this.listeners.set(path, new Set());
        this.listeners.get(path)!.add(cb);
      },
      off: (_event: "value", cb: ValueCallback) => { this.listeners.get(path)?.delete(cb); }
    };
  }
  // Fires the value listeners of the envelope children given, as the RTDB does for one update.
  fireEnvelope(values: Record<string, unknown>) {
    Object.entries(values).forEach(([path, value]) =>
      this.listeners.get(path)?.forEach(cb => cb({ val: () => value })));
  }
  get lastWrite() {
    return this.writes[this.writes.length - 1];
  }
}

// Lets the promise chains of the tree monitor and the write loop run.
export async function flush() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

export const textOf = (values: Record<string, any>) => JSON.parse(values.content).tileMap.t1.content.text;

export function setup<Concurrent extends boolean = false>(overrides?: Partial<IContentSaveSenderOptions>,
    concurrent?: Concurrent) {
  const docContent = DocumentContentModel.create({
    tileMap: {
      t1: { id: "t1", content: { type: "TestTile" } }
    }
  });
  const document: DocumentModelType = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    concurrent: concurrent || undefined,
    content: docContent as any
  });
  document.treeMonitor!.enableMonitoring();
  const treeManager = document.treeManagerAPI as TreeManagerType;
  const commits = new StubCommitSource();
  treeManager.setHistoryManager(commits);
  treeManager.exactness.startAt("e0");
  const tile = document.content!.tileMap.get("t1")!.content as TestTileType;

  const rtdbEnvelopeRef = new FakeRtdbEnvelopeRef();
  const updateTools = jest.fn((tools: string[]) => Promise.resolve());
  const onContentSaved = jest.fn();
  const beforeWrite = jest.fn();
  // A concurrent document's save waits no jitter unless a test sets random.
  const sender = getContentSaveSender(document,
    { rtdbEnvelopeRef, updateTools, onContentSaved, beforeWrite, random: () => 0, ...overrides }
  ) as Concurrent extends true ? ConcurrentContentSaveSender : IndividualContentSaveSender;

  // Makes an edit and returns the id of the entry that recorded it.
  async function edit(text: string) {
    const ids: string[] = [];
    const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
    tile.setText(text);
    await flush();
    remove();
    expect(ids).toHaveLength(1);
    return ids[0];
  }

  // Opens an entry that stays open until the returned function is called.
  function openEntry(id: string) {
    treeManager.createHistoryEntry({
      id, exchangeId: `${id}-x`, tree: document.key, model: "TestTile", action: "/stuck", undoable: true
    });
    return () => treeManager.addTreePatchRecord(id, `${id}-x`,
      { tree: document.key, action: "/stuck", patches: [], inversePatches: [] });
  }

  // Another writer's entry is applied: the uncommitted local entries are voided, the content
  // changes, and the head moves to the new entry.
  async function applyRemote(id: string, text: string) {
    commits.setApplying(true);
    commits.voidUncommitted();
    document.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
      { op: "replace", path: "/content/tileMap/t1/content/text", value: text }
    ]);
    await flush();
    commits.advanceRemoteHead(id);
    commits.setApplying(false);
    await flush();
  }

  return { document, treeManager, commits, tile, rtdbEnvelopeRef, updateTools, onContentSaved, beforeWrite,
    sender, edit, openEntry, applyRemote };
}

// A gate a flow waits on twice: the first wait ends at `first`, the second at `second`.
export function twoStepGate() {
  const first = deferred<void>();
  const second = deferred<void>();
  let step = 0;
  const gate = {
    then: (resolve: () => void) => {
      (step++ === 0 ? first : second).promise.then(resolve);
    }
  } as unknown as Promise<void>;
  return { gate, first, second };
}

/**
 * Runs each test on fake timers, and disposes the senders passed to the returned function once the
 * test ends. Call it in a describe block.
 */
export function trackSenders() {
  let senders: ContentSaveSender[] = [];

  beforeEach(() => {
    // MST flows resume through queueMicrotask.
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
  });
  afterEach(() => {
    senders.forEach(sender => sender.dispose());
    senders = [];
    jest.useRealTimers();
  });

  return function track<T extends { sender: ContentSaveSender }>(context: T) {
    senders.push(context.sender);
    return context;
  };
}
