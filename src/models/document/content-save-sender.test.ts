import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { destroy, flow, Instance, types } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { ICommitListener, ICommitSource, ICommittedEntry } from "../history/history-commits";
import { buildLoadEntry } from "../history/schema-conversion";
import { FAKE_HISTORY_ENTRY_ID, IHistoryManager, TreeManagerType } from "../history/tree-manager";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { LogEventName } from "../../lib/logger-types";
import {
  collectUnsettledEvidence, ContentSaveSender, getContentSaveSender, IContentRef, IContentSaveSenderOptions,
  kGroupSaveJitterMs, kIntermediateSaveIntervalMs, kMaxEvidenceEntryIds, kMaxUsableSnapshots, kMinimumSaveGapMs,
  kSenderUnmountLimitMs
} from "./content-save-sender";
import { createDocumentModel, DocumentModelType, SaveState } from "./document";
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
    })
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

// Reports commits only when a test says so. Like a group document's history manager, it is settled
// while no completed local entry waits to commit, no upload runs and no remote entries are applied.
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

class FakeContentRef implements IContentRef {
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
async function flush() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

const textOf = (values: Record<string, any>) => JSON.parse(values.content).tileMap.t1.content.text;

function setup(overrides?: Partial<IContentSaveSenderOptions>, concurrent = false) {
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

  const contentRef = new FakeContentRef();
  const updateTools = jest.fn((tools: string[]) => Promise.resolve());
  const onContentSaved = jest.fn();
  const beforeWrite = jest.fn();
  // A group save waits no jitter unless a test sets random.
  const sender = getContentSaveSender(document,
    { contentRef, updateTools, onContentSaved, beforeWrite, random: () => 0, ...overrides });

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

  return { document, treeManager, commits, tile, contentRef, updateTools, onContentSaved, beforeWrite,
    sender, edit, openEntry, applyRemote };
}

// A gate a flow waits on twice: the first wait ends at `first`, the second at `second`.
function twoStepGate() {
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

describe("ContentSaveSender", () => {
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

  function track<T extends { sender: ContentSaveSender }>(context: T) {
    senders.push(context.sender);
    return context;
  }

  describe("snapshot saving", () => {
    it("saves the snapshot taken when an entry completed, once that entry commits", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      await edit("bravo");

      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      const { values } = contentRef.writes[0];
      expect(textOf(values)).toBe("alpha");
      expect(values.content).not.toContain("bravo");
      expect(values).toMatchObject({
        lastHistoryEntryId: a,
        lastHistoryEntryIndex: 1,
        settled: true,
        exactSince: "e0",
        unsettled: null
      });
    });

    it("sends nothing before the entry commits", async () => {
      const { contentRef, edit } = track(setup());
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs - 1);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving exactly while entries complete faster than they commit", async () => {
      const { commits, contentRef, edit } = track(setup());
      const ids: string[] = [];
      for (let i = 0; i < kMaxUsableSnapshots; i++) {
        ids.push(await edit(`text-${i}`));
        jest.setSystemTime(Date.now() + kMinimumSaveGapMs);
      }
      for (let i = 0; i < kMaxUsableSnapshots; i++) {
        commits.commit(ids[i]);
        jest.advanceTimersByTime(kMinimumSaveGapMs);
        expect(contentRef.update).toHaveBeenCalledTimes(i + 1);
        const write = contentRef.lastWrite;
        expect(textOf(write.values)).toBe(`text-${i}`);
        expect(write.values.lastHistoryEntryId).toBe(ids[i]);
        expect(write.values.settled).toBe(true);
        write.resolve();
        await flush();
      }
    });

    it("keeps one snapshot per minimum save gap while entries wait to commit, and the newest", async () => {
      const { commits, contentRef, edit } = track(setup());
      const start = Date.now();
      const editAt = async (offset: number, text: string) => {
        jest.setSystemTime(start + offset);
        return edit(text);
      };
      const a = await editAt(0, "alpha");
      const b = await editAt(300, "bravo");
      const c = await editAt(600, "charlie");
      const d = await editAt(kMinimumSaveGapMs + 100, "delta");
      const e = await editAt(kMinimumSaveGapMs + 200, "echo");

      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      // b and c were taken less than the gap after a, so their snapshots were dropped
      commits.commit(b);
      commits.commit(c);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      // a commit saves the newest snapshot kept among its entries
      commits.commit(d, e);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: e, settled: true });
      expect(textOf(contentRef.writes[1].values)).toBe("echo");
    });

    it("saves the nearest older kept snapshot when a commit's own snapshot was dropped", async () => {
      const { commits, contentRef, edit } = track(setup());
      const start = Date.now();
      const a = await edit("alpha");
      jest.setSystemTime(start + 300);
      const b = await edit("bravo");
      jest.setSystemTime(start + 600);
      await edit("charlie");

      commits.commit(a, b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, settled: true });
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
    });

    it("keeps only the newest usable snapshots while entries wait to commit", async () => {
      const { commits, contentRef, edit } = track(setup());
      const ids: string[] = [];
      for (let i = 0; i <= kMaxUsableSnapshots; i++) {
        ids.push(await edit(`text-${i}`));
        jest.setSystemTime(Date.now() + kMinimumSaveGapMs);
      }
      commits.commit(ids[0]);
      expect(contentRef.update).not.toHaveBeenCalled();
      commits.commit(ids[1]);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: ids[1], settled: true });
      expect(textOf(contentRef.writes[0].values)).toBe("text-1");
    });

    it("skips a snapshot taken while another entry was open, and uses the next usable one", async () => {
      const { commits, contentRef, edit, openEntry } = track(setup());
      const closeEntry = openEntry("open");
      const a = await edit("alpha");
      closeEntry();
      const b = await edit("bravo");

      commits.commit(a);
      expect(contentRef.update).not.toHaveBeenCalled();
      commits.commit(b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("bravo");
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(b);
    });

    it("skips a snapshot taken while the load entry is pending, and uses the next usable one", async () => {
      const { commits, contentRef, document, edit, treeManager } = track(setup());
      const loadEntry = buildLoadEntry(document.key, [{
        path: "/content/tileMap/t1/content", before: { type: "TestTile", text: "stored" }, after: { type: "TestTile" }
      }]);
      treeManager.setPendingLoadEntry(loadEntry);
      const ids: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
      // A title change isn't a content change, so the load entry stays pending.
      document.setTitle("renamed");
      await flush();
      remove();
      expect(ids).toHaveLength(1);
      expect(treeManager.pendingLoadEntry).toBe(loadEntry);

      commits.commit(ids[0]);
      expect(contentRef.update).not.toHaveBeenCalled();
      const a = await edit("alpha");
      expect(treeManager.pendingLoadEntry).toBeUndefined();
      commits.commit(loadEntry.id!, a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(a);
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
    });

    it("skips a snapshot taken while a flow that had changed state was running", async () => {
      const { commits, contentRef, edit, tile, treeManager } = track(setup());
      const { gate, first, second } = twoStepGate();
      const promise = tile.setTextLater("flow", gate);
      first.resolve();
      await flush();
      const a = await edit("alpha");

      const flowIds: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => { flowIds.push(entry.id); });
      second.resolve();
      await promise;
      await flush();
      remove();
      expect(flowIds).toHaveLength(1);

      commits.commit(a);
      expect(contentRef.update).not.toHaveBeenCalled();
      commits.commit(flowIds[0]);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(flowIds[0]);
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
    });

    it("doesn't count a running flow that hasn't changed state", async () => {
      const { commits, contentRef, edit, tile } = track(setup());
      const gate = deferred<void>();
      const promise = tile.waitWithoutChanging(gate.promise);
      const a = await edit("alpha");

      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(a);
      gate.resolve();
      await promise;
    });

    it("saves nothing exact once the session is not exact", async () => {
      const { commits, contentRef, edit, treeManager } = track(setup());
      const a = await edit("alpha");
      treeManager.exactness.markNotExact("unrecorded-change");
      const b = await edit("bravo");

      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(a);
      contentRef.writes[0].resolve();
      await flush();

      commits.commit(b);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.writes.map(write => write.values.settled)).toEqual([true, null]);
    });

    it("drops uncommitted snapshots when they are voided", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      commits.voidUncommitted();
      commits.commit(a);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.writes.map(write => write.values.settled)).toEqual([null]);
    });

    it("saves the newest usable snapshot among entries committed together", async () => {
      const { commits, contentRef, edit, openEntry } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      const closeEntry = openEntry("open");
      const c = await edit("charlie");
      closeEntry();

      commits.commit(a, b, c);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("bravo");
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: b, lastHistoryEntryIndex: 2 });
    });

    it("doesn't count the entries of its own document actions as open entries", async () => {
      const { commits, contentRef, tile, treeManager, edit } = track(setup());
      const a = await edit("alpha");
      const ids: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
      // The write for a starts while the entry for this edit is being recorded.
      tile.setText("bravo");
      commits.commit(a);
      await flush();
      remove();
      expect(ids).toHaveLength(1);

      contentRef.writes[0].resolve();
      await flush();
      commits.commit(ids[0]);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values.lastHistoryEntryId).toBe(ids[0]);
    });

    it("skips a snapshot taken while a group document applied remote entries", async () => {
      const { commits, contentRef, edit } = track(setup({}, true));
      commits.setApplying(true);
      const a = await edit("alpha");
      commits.setApplying(false);
      const b = await edit("bravo");

      commits.commit(a);
      expect(contentRef.update).not.toHaveBeenCalled();
      commits.commit(b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(b);
    });
  });

  describe("writes", () => {
    it("has one write in flight and sends the newest pending save when it finishes", async () => {
      const { commits, contentRef, edit } = track(setup());
      const [a, b, c, d] = [await edit("alpha"), await edit("bravo"), await edit("charlie"), await edit("delta")];

      commits.commit(a);
      commits.commit(b);
      commits.commit(c);
      commits.commit(d);
      jest.advanceTimersByTime(5000);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values.lastHistoryEntryId).toBe(d);
      expect(textOf(contentRef.writes[1].values)).toBe("delta");

      contentRef.writes[1].resolve();
      await flush();
      jest.advanceTimersByTime(5000);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("waits the minimum gap after the previous write started", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      jest.advanceTimersByTime(300);
      contentRef.writes[0].resolve();
      await flush();
      commits.commit(b);
      jest.advanceTimersByTime(699);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("uses the minimum gap the caller sets for each save", async () => {
      const getMinimumGapMs = jest.fn(() => 3000);
      const { commits, contentRef, edit } = track(setup({ getMinimumGapMs }));
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      commits.commit(b);
      expect(getMinimumGapMs).toHaveBeenCalledWith(expect.objectContaining({ kind: "exact", changeSeq: 2 }));
      jest.advanceTimersByTime(2999);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("retries a failed write with the newest save, never an older one", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        contentRef.writes[0].reject(new Error("offline"));
        await flush();
        jest.advanceTimersByTime(1000);
        // nothing newer, so the retry sends the same save
        expect(contentRef.update).toHaveBeenCalledTimes(2);
        expect(contentRef.writes[1].values.lastHistoryEntryId).toBe(a);

        commits.commit(b);
        contentRef.writes[1].reject(new Error("offline"));
        await flush();
        jest.advanceTimersByTime(2000);
        expect(contentRef.update).toHaveBeenCalledTimes(3);
        expect(contentRef.writes[2].values.lastHistoryEntryId).toBe(b);
        expect(textOf(contentRef.writes[2].values)).toBe("bravo");
        contentRef.writes[2].resolve();
        await flush();
        jest.advanceTimersByTime(10000);
        expect(contentRef.update).toHaveBeenCalledTimes(3);
      });
    });

    it("keeps the newest saved change when two writes finish out of order", async () => {
      const onDrained = jest.fn();
      const { commits, contentRef, document, edit, onContentSaved, sender } = track(setup({ onDrained }));
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);

      contentRef.writes[1].resolve();
      await flush();
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledTimes(1);
      expect(onContentSaved).toHaveBeenLastCalledWith(document, b);
      jest.advanceTimersByTime(2 * kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      sender.detach();
      expect(onDrained).toHaveBeenCalledTimes(1);
      expect(document.savedEnvelope).toEqual(
        { lastHistoryEntryId: b, lastHistoryEntryIndex: 2, settled: true, exactSince: "e0" });
    });

    it("records the envelope each newest write leaves in the RTDB", async () => {
      const { commits, contentRef, document, edit } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: false });
      const a = await edit("alpha");
      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual(
        { lastHistoryEntryId: a, lastHistoryEntryIndex: 1, settled: true, exactSince: "e0" });

      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      contentRef.writes[1].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({ lastHistoryEntryId: a, lastHistoryEntryIndex: 1, settled: false });
    });

    it("records an intermediate save's envelope without an index, or without an entry, as it leaves them",
        async () => {
      const { contentRef, document, edit } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", settled: true, exactSince: "e0" });
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: null });
      contentRef.writes[0].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({ lastHistoryEntryId: "loaded", settled: false });

      document.setSavedEnvelope(undefined);
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      contentRef.writes[1].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({ settled: false });
    });

    it("does nothing when a write lands after the document is destroyed", async () => {
      const { commits, contentRef, document, edit, onContentSaved, sender, updateTools } = track(setup());
      const a = await edit("alpha");
      commits.commit(a);
      sender.dispose();
      destroy(document);
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        contentRef.writes[0].resolve();
        await flush();
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(onContentSaved).not.toHaveBeenCalled();
        expect(updateTools).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        error.mockRestore();
      }
    });

    it("sends no exact save older than the newest intermediate content when intermediate writes finish out of order",
        async () => {
      const { commits, contentRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);

      contentRef.writes[1].resolve();
      await flush();
      contentRef.writes[0].resolve();
      await flush();
      // the exact save of the first entry holds only "alpha", which would undo "bravo"
      commits.commit(a);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("backs off and shows Retrying from the third consecutive failure", async () => {
      const { commits, contentRef, document, edit } = track(setup());
      const a = await edit("alpha");

      await jestSpyConsole("warn", async spy => {
        commits.commit(a);
        contentRef.writes[0].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Saving);
        jest.advanceTimersByTime(999);
        expect(contentRef.update).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1);
        expect(contentRef.update).toHaveBeenCalledTimes(2);

        contentRef.writes[1].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Saving);
        jest.advanceTimersByTime(1999);
        expect(contentRef.update).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(1);
        expect(contentRef.update).toHaveBeenCalledTimes(3);

        contentRef.writes[2].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Retrying);
        jest.advanceTimersByTime(3999);
        expect(contentRef.update).toHaveBeenCalledTimes(3);
        jest.advanceTimersByTime(1);
        expect(contentRef.update).toHaveBeenCalledTimes(4);
        expect(spy).toHaveBeenCalledTimes(3);

        contentRef.writes[3].resolve();
        await flush();
        expect(document.saveState).toBe(SaveState.Saved);
      });
    });

    it("doesn't wait for, or fail on, the tools update", async () => {
      const updateTools = jest.fn(() => new Promise<void>(() => undefined));
      const { commits, contentRef, document, edit, onContentSaved } = track(setup({ updateTools }));
      const a = await edit("alpha");
      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(1);
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledWith(document, a);

      const failingTools = jest.fn(() => Promise.reject(new Error("no firestore")));
      const failing = track(setup({ updateTools: failingTools }));
      const b = await failing.edit("bravo");
      await jestSpyConsole("warn", async spy => {
        failing.commits.commit(b);
        failing.contentRef.writes[0].resolve();
        await flush();
        expect(failingTools).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(failing.document.saveState).toBe(SaveState.Saved);
    });

    it("sends tools only when the list of tile types changes", async () => {
      const { commits, contentRef, document, edit, treeManager, updateTools } = track(setup());
      const a = await edit("alpha");
      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(1);
      expect(updateTools).toHaveBeenLastCalledWith(["TestTile"]);

      const b = await edit("bravo");
      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      contentRef.writes[1].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(1);

      const ids: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
      document.content!.deleteTile("t1");
      await flush();
      remove();
      expect(ids).toHaveLength(1);
      commits.commit(ids[0]);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      contentRef.writes[2].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(2);
      expect(updateTools).toHaveBeenLastCalledWith([]);
    });

    it("sends a failed tools update again with the next save", async () => {
      const updateTools = jest.fn((tools: string[]) => Promise.resolve());
      updateTools.mockImplementationOnce(() => Promise.reject(new Error("no firestore")));
      const { commits, contentRef, edit } = track(setup({ updateTools }));
      const a = await edit("alpha");
      const b = await edit("bravo");
      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        contentRef.writes[0].resolve();
        await flush();
      });
      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      contentRef.writes[1].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(2);
      expect(updateTools).toHaveBeenLastCalledWith(["TestTile"]);
    });

    it("shows Saving on a change and Saved once a save covers the latest change", async () => {
      const { commits, contentRef, document, edit } = track(setup());
      expect(document.saveState).toBe(SaveState.Idle);
      const a = await edit("alpha");
      expect(document.saveState).toBe(SaveState.Saving);
      const b = await edit("bravo");

      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);

      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      contentRef.writes[1].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("doesn't show Saving for the changes a group document's apply makes", async () => {
      const { commits, document } = track(setup({}, true));
      commits.setApplying(true);
      document.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "remote" }
      ]);
      await flush();
      commits.setApplying(false);
      expect(document.content!.tileMap.get("t1")!.content).toMatchObject({ text: "remote" });
      expect(document.saveState).toBe(SaveState.Idle);
    });

    it("shows Saving for a local edit made while a group document applies remote entries", async () => {
      const { commits, contentRef, document, edit } = track(setup({}, true));
      commits.setApplying(true);
      document.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "remote" }
      ]);
      const a = await edit("local");
      expect(document.saveState).toBe(SaveState.Saving);
      commits.setApplying(false);

      // The snapshot taken during the apply isn't saved, so the edit stays unsaved.
      commits.commit(a);
      expect(contentRef.update).not.toHaveBeenCalled();
      const b = await edit("later");
      commits.commit(b);
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("reports each saved id to onContentSaved, and calls beforeWrite before each write", async () => {
      const { beforeWrite, commits, contentRef, document, edit, onContentSaved } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      expect(beforeWrite).toHaveBeenCalledTimes(1);
      expect(beforeWrite.mock.invocationCallOrder[0])
        .toBeLessThan(contentRef.update.mock.invocationCallOrder[0]);
      await jestSpyConsole("warn", async () => {
        contentRef.writes[0].reject(new Error("offline"));
        await flush();
      });
      expect(onContentSaved).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(beforeWrite).toHaveBeenCalledTimes(2);
      contentRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, a);

      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      contentRef.writes[2].resolve();
      await flush();
      expect(onContentSaved.mock.calls).toEqual([[document, a], [document, b]]);
    });
  });

  describe("intermediate saves", () => {
    it("makes an intermediate save after 5 seconds without an exact save", async () => {
      const { contentRef, edit, openEntry } = track(setup());
      const openedAt = Date.now();
      openEntry("open");
      await edit("alpha");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs - 1);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      const { values } = contentRef.writes[0];
      expect(textOf(values)).toBe("alpha");
      expect(values).toMatchObject({ settled: null, exactSince: null });
      expect(values).not.toHaveProperty("lastHistoryEntryId");
      expect(values.unsettled.openEntries).toEqual([{
        id: "open", model: "TestTile", action: "/stuck",
        exchanges: ["TreeManager.createHistoryEntry /stuck"], openedAt
      }]);
    });

    it("stamps an intermediate save with the last committed entry, or the loaded id before any commit",
        async () => {
      const { commits, contentRef, document, edit, onContentSaved, treeManager } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: true });
      treeManager.exactness.markNotExact("unrecorded-change");
      const a = await edit("alpha");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7 });
      contentRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, "loaded");

      commits.commit(a);
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({
        lastHistoryEntryId: a, lastHistoryEntryIndex: 1, settled: null
      });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
      contentRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, a);
    });

    it("stamps an intermediate save with the entry the load caught up to before any commit", async () => {
      const { commits, contentRef, document, edit, treeManager } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: true });
      commits.caughtUpTo = { id: "caught-up", index: 9 };
      treeManager.exactness.markNotExact("catch-up-hole");
      await edit("alpha");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({
        lastHistoryEntryId: "caught-up", lastHistoryEntryIndex: 9, settled: null
      });
    });

    it("repeats intermediate saves at most every 5 seconds", async () => {
      const { contentRef, document, edit, openEntry } = track(setup());
      openEntry("open");
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);

      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs - 1);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
      contentRef.writes[1].resolve();
      await flush();

      // nothing is left unsaved
      jest.advanceTimersByTime(3 * kIntermediateSaveIntervalMs);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("records running flows, uncommitted entries and the not-exact reason as evidence", async () => {
      const { contentRef, edit, tile, treeManager } = track(setup());
      const unsettledSince = Date.now();
      const { gate, first, second } = twoStepGate();
      const promise = tile.setTextLater("flow", gate);
      first.resolve();
      await flush();
      const a = await edit("alpha");
      treeManager.exactness.markNotExact("timed-out-entry");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.unsettled).toEqual({
        openEntries: [],
        runningFlows: [{ action: "/content/tileMap/t1/content/setTextLater" }],
        uncommittedEntryIds: [a],
        notExactReason: "timed-out-entry",
        unsettledSince
      });

      second.resolve();
      await promise;
    });

    it("logs an episode once at its start and once when an exact save ends it", async () => {
      const logEvent = jest.fn();
      const { commits, contentRef, edit, openEntry } = track(setup({ logEvent }));
      const unsettledSince = Date.now();
      const closeEntry = openEntry("open");
      const a = await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[0].resolve();
      await flush();
      const b = await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[1].resolve();
      await flush();
      expect(logEvent).toHaveBeenCalledTimes(1);

      closeEntry();
      const c = await edit("charlie");
      commits.commit(a, b, c);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.writes[2].values).toMatchObject({ lastHistoryEntryId: c, settled: true });
      contentRef.writes[2].resolve();
      await flush();

      expect(logEvent.mock.calls).toEqual([
        [LogEventName.CONTENT_SAVE_FALLBACK_START, expect.objectContaining({
          openEntries: [expect.objectContaining({ id: "open" })],
          uncommittedEntryIds: [a],
          unsettledSince
        })],
        [LogEventName.CONTENT_SAVE_FALLBACK_END, {
          durationMs: kIntermediateSaveIntervalMs + kMinimumSaveGapMs,
          intermediateSaves: 2,
          endedBy: "exact-save"
        }]
      ]);

      // a new episode starts only with the next intermediate save
      jest.advanceTimersByTime(4 * kIntermediateSaveIntervalMs);
      expect(logEvent).toHaveBeenCalledTimes(2);
    });

    it("ends an episode when the session ends", async () => {
      const logEvent = jest.fn();
      const { contentRef, edit, sender, treeManager } = track(setup({ logEvent }));
      treeManager.exactness.markNotExact("unrecorded-change");
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[0].resolve();
      await flush();

      jest.advanceTimersByTime(2000);
      sender.dispose();
      expect(logEvent).toHaveBeenLastCalledWith(LogEventName.CONTENT_SAVE_FALLBACK_END, {
        durationMs: 2000, intermediateSaves: 1, endedBy: "session-end"
      });
      expect(logEvent).toHaveBeenCalledTimes(2);
    });

    it("sends a pending exact save instead of a waiting intermediate one", async () => {
      const { commits, contentRef, edit, openEntry } = track(setup());
      const closeEntry = openEntry("open");
      await edit("alpha");
      await jestSpyConsole("warn", async () => {
        jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
        contentRef.writes[0].reject(new Error("offline"));
        await flush();
      });

      closeEntry();
      const b = await edit("bravo");
      commits.commit(b);
      jest.advanceTimersByTime(1000);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });
    });

    it("never replaces a pending exact save with an intermediate one", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        for (let i = 0; i < 3; i++) {
          contentRef.lastWrite.reject(new Error("offline"));
          await flush();
          jest.advanceTimersByTime(4000);
        }
      });
      expect(contentRef.writes.map(write => write.values.settled)).toEqual([true, true, true, true]);
    });

    it("never overwrites an intermediate save's content with an older exact save", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      const c = await edit("charlie");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("charlie");
      contentRef.writes[0].resolve();
      await flush();

      jest.advanceTimersByTime(1000);
      commits.commit(a);
      jest.advanceTimersByTime(3 * kIntermediateSaveIntervalMs);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      commits.commit(b, c);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: c, settled: true });
      expect(textOf(contentRef.writes[1].values)).toBe("charlie");
    });

    it("builds an intermediate save again when building it fails", async () => {
      const { contentRef, document, edit, openEntry } = track(setup());
      openEntry("open");
      await edit("alpha");
      // The evidence is collected as the save is built.
      jest.spyOn(document.treeMonitor!, "getRunningCallsWithChanges")
        .mockImplementationOnce(() => { throw new Error("broken"); });
      await jestSpyConsole("warn", async spy => {
        jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
        await flush();
        expect(contentRef.update).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledTimes(1);
      });
      jest.advanceTimersByTime(1000);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
    });

    it("keeps only the newest uncommitted entry ids in the evidence", () => {
      const { document } = track(setup());
      const ids = Array.from({ length: kMaxEvidenceEntryIds + 5 }, (_, i) => `e${i}`);
      expect(collectUnsettledEvidence(document, ids, 0).uncommittedEntryIds).toEqual(ids.slice(5));
    });

    it("never makes an intermediate save on a group document", async () => {
      const { contentRef, edit, openEntry, treeManager } = track(setup({}, true));
      openEntry("open");
      treeManager.exactness.markNotExact("unrecorded-change");
      await edit("alpha");
      jest.advanceTimersByTime(5 * kIntermediateSaveIntervalMs);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving through intermediate saves when nothing ever commits", async () => {
      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
      process.on("unhandledRejection", onUnhandledRejection);
      try {
        // Firestore is unavailable: no entry commits and the tools update fails.
        const updateTools = jest.fn(() => Promise.reject(new Error("no firestore")));
        const { contentRef, document, edit } = track(setup({ updateTools }));
        const start = Date.now();
        const savedAt: number[] = [];
        const edits = new Map([[0, "alpha"], [7000, "bravo"], [12000, "charlie"], [17000, "delta"]]);
        await jestSpyConsole("warn", async () => {
          for (let time = 0; time <= 20000; time += 500) {
            jest.advanceTimersByTime(start + time - Date.now());
            const text = edits.get(time);
            if (text) {
              await edit(text);
            }
            while (contentRef.writes.length > savedAt.length) {
              savedAt.push(Date.now() - start);
              contentRef.lastWrite.resolve();
              await flush();
            }
          }
        });
        expect(savedAt).toEqual([5000, 10000, 15000, 20000]);
        expect(contentRef.writes.map(write => textOf(write.values)))
          .toEqual(["alpha", "bravo", "charlie", "delta"]);
        contentRef.writes.forEach(write => expect(write.values.settled).toBeNull());
        expect(document.saveState).toBe(SaveState.Saved);
        await new Promise(resolve => jest.requireActual<typeof import("timers")>("timers").setImmediate(resolve));
        expect(unhandledRejections).toEqual([]);
      } finally {
        process.removeListener("unhandledRejection", onUnhandledRejection);
      }
    });
  });

  describe("group documents", () => {
    it("saves the current state, stamped with the remote head, when an idle member settles", async () => {
      const { applyRemote, contentRef, document, onContentSaved } = track(setup({}, true));
      await applyRemote("r9", "remote");
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      const { values } = contentRef.writes[0];
      expect(values).toMatchObject({
        lastHistoryEntryId: "r9",
        lastHistoryEntryIndex: 1,
        settled: true,
        exactSince: "e0",
        unsettled: null
      });
      expect(textOf(values)).toBe("remote");

      contentRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenCalledWith(document, "r9");
      // nothing newer to save
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("doesn't save while the queue has entries, an upload or apply runs, or an entry is open", async () => {
      const { commits, contentRef, edit, openEntry, tile, treeManager } = track(setup({}, true));
      commits.setUploading(true);
      commits.setRemoteHead("r1", 1);
      await flush();
      commits.setUploading(false);
      commits.setApplying(true);
      await flush();
      const closeEntry = openEntry("open");
      commits.setApplying(false);
      await flush();
      const a = await edit("alpha");
      closeEntry();
      await flush();
      expect(commits.uncommitted).toEqual([a]);
      expect(contentRef.update).not.toHaveBeenCalled();

      // The snapshot of a isn't usable, so the settled state is saved once a commits.
      commits.commit(a);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, lastHistoryEntryIndex: 2 });
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      // A running flow that has changed state, and then its call, which stops being tracked
      // just before its entry opens.
      const { gate, first, second } = twoStepGate();
      const promise = tile.setTextLater("flow", gate);
      first.resolve();
      await flush();
      commits.setRemoteHead("r3", 3);
      await flush();
      second.resolve();
      await promise;
      await flush();
      expect(commits.uncommitted).toHaveLength(1);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      // The flow's own snapshot is saved once it commits, and nothing once the session isn't exact.
      commits.commit(...commits.uncommitted);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      contentRef.writes[1].resolve();
      await flush();
      treeManager.exactness.markNotExact("unrecorded-change");
      commits.advanceRemoteHead("r9");
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("skips a save when the envelope is already at or past its index", async () => {
      const { commits, contentRef } = track(setup({}, true));
      // An envelope without an index counts as behind.
      contentRef.fireEnvelope({ lastHistoryEntryId: "old", lastHistoryEntryIndex: null, settled: null });
      await flush();
      commits.setRemoteHead("r4", 4);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      contentRef.writes[0].resolve();
      await flush();

      contentRef.fireEnvelope({ lastHistoryEntryId: "r9", lastHistoryEntryIndex: 9, settled: true });
      await flush();
      commits.setRemoteHead("r9", 9);
      await flush();
      contentRef.fireEnvelope({ lastHistoryEntryId: "r12", lastHistoryEntryIndex: 12, settled: true });
      await flush();
      commits.setRemoteHead("r10", 10);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("re-checks the envelope after the jitter and skips if another member saved meanwhile", async () => {
      const { commits, contentRef } = track(setup({ random: () => 0.5 }, true));
      commits.setRemoteHead("r8", 8);
      await flush();
      jest.advanceTimersByTime(kGroupSaveJitterMs / 2 - 1);
      expect(contentRef.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe("r8");
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      commits.setRemoteHead("r9", 9);
      await flush();
      jest.advanceTimersByTime(50);
      contentRef.fireEnvelope({ lastHistoryEntryId: "r9", lastHistoryEntryIndex: 9, settled: true });
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("stamps a snapshot save with the committed entry and stale-checks it too", async () => {
      const { commits, contentRef, edit } = track(setup({ random: () => 0.5 }, true));
      const a = await edit("alpha");
      commits.commit(a);
      jest.advanceTimersByTime(kGroupSaveJitterMs / 2 - 1);
      expect(contentRef.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({
        lastHistoryEntryId: a, lastHistoryEntryIndex: 1, settled: true, exactSince: "e0"
      });
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      const b = await edit("bravo");
      commits.commit(b);
      jest.advanceTimersByTime(50);
      contentRef.fireEnvelope({ lastHistoryEntryId: b, lastHistoryEntryIndex: 2, settled: true });
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("never saves a snapshot voided by a remote entry, and resumes after the next commit", async () => {
      const { applyRemote, commits, contentRef, edit } = track(setup({}, true));
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) {
        ids.push(await edit(`tick-${i}`));
      }
      commits.commit(ids[0]);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("tick-1");
      contentRef.writes[0].resolve();
      await flush();

      await applyRemote("r", "remote");
      const e6 = await edit("tick-6");
      commits.commit(...ids.slice(1));
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      commits.commit(e6);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({
        lastHistoryEntryId: e6, lastHistoryEntryIndex: 7, settled: true
      });
      expect(textOf(contentRef.writes[1].values)).toBe("tick-6");
      contentRef.writes[1].resolve();
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("shows Saved and reports the id when another member's save covers this client's change", async () => {
      const { commits, contentRef, document, edit, onContentSaved } =
        track(setup({ random: () => 0.5 }, true));
      const a = await edit("alpha");
      commits.commit(a);
      expect(document.saveState).toBe(SaveState.Saving);
      contentRef.fireEnvelope({ lastHistoryEntryId: "r3", lastHistoryEntryIndex: 3, settled: true });
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledWith(document, "r3");
      jest.advanceTimersByTime(kGroupSaveJitterMs);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();

      // A newer change keeps it Saving, while the committed change is still reported.
      const b = await edit("bravo");
      commits.commit(b);
      await edit("charlie");
      contentRef.fireEnvelope({ lastHistoryEntryId: "r6", lastHistoryEntryIndex: 6, settled: true });
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);
      expect(onContentSaved.mock.calls).toEqual([[document, "r3"], [document, "r6"]]);
    });

    it("shows Saved once the envelope reaches the head after a rollback undid this client's change",
        async () => {
      const { commits, contentRef, document, edit, sender } = track(setup({ random: () => 0.5 }, true));
      const a = await edit("alpha");
      expect(document.saveState).toBe(SaveState.Saving);

      // Another writer's conflicting entry wins, so a is undone and never commits.
      commits.setApplying(true);
      commits.voidUncommitted();
      document.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "remote" }
      ]);
      await flush();
      commits.rollBack(a);
      commits.advanceRemoteHead("r1");
      commits.setApplying(false);
      await flush();

      // The winner saves the head before this client's settled save is sent.
      jest.advanceTimersByTime(kGroupSaveJitterMs / 4);
      contentRef.fireEnvelope({ lastHistoryEntryId: "r1", lastHistoryEntryIndex: 1, settled: true });
      await flush();
      jest.advanceTimersByTime(kGroupSaveJitterMs);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
      expect(document.saveState).toBe(SaveState.Saved);
      expect((sender as unknown as { keptSnapshots: Map<string, unknown> }).keptSnapshots.size).toBe(0);
    });

    it("ignores the envelope of its own write while that write is in flight", async () => {
      const { commits, contentRef, document, edit } = track(setup({}, true));
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      // The RTDB raises local events for a write before the server accepts it.
      contentRef.fireEnvelope({ lastHistoryEntryId: a, lastHistoryEntryIndex: 1, settled: true });
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);

      await jestSpyConsole("warn", async () => {
        contentRef.writes[0].reject(new Error("denied"));
        await flush();
      });
      jest.advanceTimersByTime(1000);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values.lastHistoryEntryId).toBe(a);
    });
  });

  describe("page hide", () => {
    const settledEnvelope = { lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: true };
    const unmarkedEnvelope = { lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: false };

    it("sends the newest committed snapshot at once on page hide", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(settledEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      jest.advanceTimersByTime(200);
      const b = await edit("bravo");
      commits.commit(b);
      await edit("charlie");
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");

      // the earlier write finishing doesn't send the same save again
      contentRef.writes[0].resolve();
      await flush();
      contentRef.writes[1].resolve();
      await flush();
      sender.handlePageHide();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("sends nothing older than an intermediate save's content on page hide", async () => {
      const { commits, contentRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      commits.commit(a);

      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("does nothing on page hide for a group document", async () => {
      const { commits, contentRef, edit, sender } = track(setup({}, true));
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("makes no intermediate save on page hide before the document relies on them", async () => {
      const { contentRef, document, edit, openEntry, sender } = track(setup());
      document.setSavedEnvelope(settledEnvelope);
      openEntry("open");
      await edit("alpha");
      sender.handlePageHide();
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("sends an intermediate save at once on page hide when the loaded envelope wasn't settled", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(unmarkedEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      // while the exact save of the committed entry is still in flight
      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: a, settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("makes no intermediate save on page hide when the loaded envelope was settled", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(settledEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("makes no intermediate save on page hide once an exact save has landed", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(unmarkedEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();

      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("keeps the fallback episode open when an older exact save finishes after a newer intermediate one",
        async () => {
      const logEvent = jest.fn();
      const { commits, contentRef, document, edit, sender } = track(setup({ logEvent }));
      document.setSavedEnvelope(unmarkedEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });

      contentRef.writes[1].resolve();
      await flush();
      contentRef.writes[0].resolve();
      await flush();
      expect(logEvent.mock.calls.map(([event]) => event)).toEqual([LogEventName.CONTENT_SAVE_FALLBACK_START]);
    });

    it("sends an intermediate save at once on page hide after a drain ended on an intermediate save",
        async () => {
      const { contentRef, document, edit, sender, updateTools } = track(setup());
      document.setSavedEnvelope(settledEnvelope);
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ settled: null });
      contentRef.writes[0].resolve();
      await flush();

      const { sender: remounted } = track({ sender: getContentSaveSender(document, { contentRef, updateTools }) });
      expect(remounted).not.toBe(sender);
      await edit("bravo");
      remounted.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("sends a pending exact save that covers the latest change on page hide, without an intermediate one",
        async () => {
      const { commits, contentRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("sends an intermediate save at once on page hide when the session isn't exact", async () => {
      const { contentRef, edit, sender, treeManager } = track(setup());
      treeManager.exactness.markNotExact("unrecorded-change");
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      // while the earlier intermediate save is still in flight
      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("sends an intermediate save at once on page hide while entries aren't committing", async () => {
      const { contentRef, edit, sender } = track(setup());
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[0].resolve();
      await flush();

      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("sends an exact save that covers the latest change on page hide while entries were stalled",
        async () => {
      const { commits, contentRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[0].resolve();
      await flush();

      const b = await edit("bravo");
      commits.commit(a, b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });
    });
  });

  describe("lifetime", () => {
    it("stops listening when disposed", async () => {
      const { commits, contentRef, document, edit, sender: disposed } = track(setup());
      const a = await edit("alpha");
      disposed.dispose();
      commits.commit(a);
      expect(contentRef.update).not.toHaveBeenCalled();
      expect(document.saveState).toBe(SaveState.Saving);
      await edit("bravo");
      jest.advanceTimersByTime(10000);
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("restarts when attached after it was disposed", async () => {
      const { commits, contentRef, document, edit, sender: restarted } = track(setup());
      restarted.dispose();
      restarted.attach({ contentRef, updateTools: () => Promise.resolve() });
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.lastHistoryEntryId).toBe(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("listens to the envelope of the content ref it was last attached to", async () => {
      const { commits, contentRef, sender: attached } = track(setup({}, true));
      const newRef = new FakeContentRef();
      attached.attach({ contentRef: newRef, updateTools: () => Promise.resolve(), random: () => 0 });
      contentRef.fireEnvelope({ lastHistoryEntryId: "r9", lastHistoryEntryIndex: 9, settled: true });
      newRef.fireEnvelope({ lastHistoryEntryId: "r5", lastHistoryEntryIndex: 5, settled: true });
      await flush();
      commits.setRemoteHead("r5", 5);
      await flush();
      expect(newRef.update).not.toHaveBeenCalled();
      commits.setRemoteHead("r6", 6);
      await flush();
      expect(newRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving after detach until a save covers the latest change, then disposes", async () => {
      const { commits, contentRef, document, edit, onContentSaved, sender } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      commits.commit(a);
      sender.detach();

      commits.commit(b);
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });

      contentRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, b);
      expect(document.saveState).toBe(SaveState.Saved);

      // disposed: it stops listening and a new attach gets a new sender
      const c = await edit("charlie");
      commits.commit(c);
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      const next = track({ sender: getContentSaveSender(document,
        { contentRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(next).not.toBe(sender);
    });

    it("keeps saving after detach until an exact save covers an intermediate save's content", async () => {
      const { commits, contentRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      contentRef.writes[0].resolve();
      await flush();

      commits.commit(a);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: a, settled: true });
    });

    it("makes one intermediate save and stops 30 seconds after detach on an individual document", async () => {
      const logEvent = jest.fn();
      const { commits, contentRef, edit, sender } = track(setup({ logEvent }));
      const a = await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(contentRef.writes[0].values)).toBe("alpha");

      // the intermediate save is still in flight when a newer change is made
      await edit("bravo");
      jest.advanceTimersByTime(kSenderUnmountLimitMs - kIntermediateSaveIntervalMs - 1);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
      expect(contentRef.writes[1].values.unsettled.uncommittedEntryIds).toContain(a);
      expect(logEvent.mock.calls.map(([event, params]) => [event, params.endedBy])).toEqual([
        [LogEventName.CONTENT_SAVE_FALLBACK_START, undefined],
        [LogEventName.CONTENT_SAVE_FALLBACK_END, "session-end"]
      ]);

      contentRef.writes.forEach(write => write.resolve());
      await flush();
      commits.commit(a);
      await edit("charlie");
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("reports the writes sent before the drain timeout once they finish", async () => {
      const { contentRef, document, edit, onContentSaved, sender, updateTools } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: true });
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      await edit("bravo");
      jest.advanceTimersByTime(kSenderUnmountLimitMs - kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);

      contentRef.writes.forEach(write => write.resolve());
      await flush();
      expect(onContentSaved).toHaveBeenCalledTimes(2);
      expect(onContentSaved).toHaveBeenLastCalledWith(document, "loaded");
      expect(updateTools).toHaveBeenCalledWith(["TestTile"]);

      // nothing else starts again
      await edit("charlie");
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
    });

    it("records the envelope as unsettled when it stops with an intermediate save in flight", async () => {
      const { contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(
        { lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: true, exactSince: "e0" });
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(document.savedEnvelope)
        .toEqual({ lastHistoryEntryId: "loaded", lastHistoryEntryIndex: 7, settled: false });

      // a sender attached before the write lands sends an intermediate save on page hide
      const next = track({ sender: getContentSaveSender(document,
        { contentRef, updateTools: () => Promise.resolve(), random: () => 0 }) });
      expect(next.sender).not.toBe(sender);
      await edit("bravo");
      next.sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ settled: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("stops 30 seconds after detach on a group document without an intermediate save", async () => {
      const { commits, contentRef, edit, sender } = track(setup({}, true));
      const a = await edit("alpha");
      const b = await edit("bravo");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs / 2);
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      contentRef.writes[0].resolve();
      await flush();

      jest.advanceTimersByTime(kSenderUnmountLimitMs / 2);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      commits.commit(b);
      await flush();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("reuses the draining sender when the document is attached again", async () => {
      const { commits, contentRef, document, edit, onContentSaved, sender } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      commits.commit(a);
      sender.detach();

      const newOnContentSaved = jest.fn();
      const attached = getContentSaveSender(document,
        { contentRef, updateTools: () => Promise.resolve(), onContentSaved: newOnContentSaved });
      expect(attached).toBe(sender);
      commits.commit(b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      contentRef.writes[0].resolve();
      await flush();
      expect(newOnContentSaved).toHaveBeenCalledWith(document, a);
      expect(onContentSaved).not.toHaveBeenCalled();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      contentRef.writes[1].resolve();
      await flush();

      // the drain was canceled, so it keeps saving
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      const c = await edit("charlie");
      commits.commit(c);
      expect(contentRef.update).toHaveBeenCalledTimes(3);
      expect(contentRef.writes[2].values).toMatchObject({ lastHistoryEntryId: c });
    });

    it("disposes a group document's drain once its latest change is saved", async () => {
      // by its own save
      const own = track(setup({}, true));
      const a = await own.edit("alpha");
      own.commits.commit(a);
      own.sender.detach();
      own.contentRef.writes[0].resolve();
      await flush();
      const next = track({ sender: getContentSaveSender(own.document,
        { contentRef: own.contentRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(next).not.toBe(own.sender);

      // by another member's save that reaches this client's newest committed entry
      const other = track(setup({ random: () => 0.5 }, true));
      const b = await other.edit("bravo");
      other.commits.commit(b);
      other.sender.detach();
      other.contentRef.fireEnvelope({ lastHistoryEntryId: b, lastHistoryEntryIndex: 1, settled: true });
      await flush();
      jest.advanceTimersByTime(kGroupSaveJitterMs);
      expect(other.contentRef.update).not.toHaveBeenCalled();
      const replaced = track({ sender: getContentSaveSender(other.document,
        { contentRef: other.contentRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(replaced).not.toBe(other.sender);
    });

    it("calls onDrained when a drain ends, but not when it is canceled or the sender is disposed", async () => {
      const onDrained = jest.fn();
      const { commits, contentRef, document, edit, sender } = track(setup({ onDrained }));
      const a = await edit("alpha");
      commits.commit(a);
      sender.detach();
      getContentSaveSender(document, { contentRef, updateTools: () => Promise.resolve(), onDrained });
      contentRef.writes[0].resolve();
      await flush();
      expect(onDrained).not.toHaveBeenCalled();

      // the timeout calls it once the last intermediate save is sent
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      await edit("charlie");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs - 1);
      expect(onDrained).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(contentRef.update).toHaveBeenCalledTimes(3);
      expect(onDrained).toHaveBeenCalledTimes(1);

      // nothing left to save at detach calls it at once
      const idle = jest.fn();
      const nothingToSave = track(setup({ onDrained: idle }));
      nothingToSave.sender.detach();
      expect(idle).toHaveBeenCalledTimes(1);

      const disposedDirectly = jest.fn();
      track(setup({ onDrained: disposedDirectly })).sender.dispose();
      expect(disposedDirectly).not.toHaveBeenCalled();
    });

    it("keeps a fallback episode open across a detach and attach", async () => {
      const logEvent = jest.fn();
      const { contentRef, document, edit, sender } = track(setup({ logEvent }));
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(logEvent).toHaveBeenCalledWith(LogEventName.CONTENT_SAVE_FALLBACK_START, expect.anything());
      sender.detach();
      getContentSaveSender(document, { contentRef, updateTools: () => Promise.resolve(), logEvent });
      contentRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(logEvent).toHaveBeenCalledTimes(1);
    });

    it("keeps running while another attachment remains", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      // lets the entry the setup opened complete
      await flush();
      getContentSaveSender(document, { contentRef, updateTools: () => Promise.resolve() });
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, settled: true });
    });

    it("uses the newest options after attach", async () => {
      const { commits, contentRef, edit, sender: attached } = track(setup());
      const onContentSaved = jest.fn();
      const a = await edit("alpha");
      attached.attach({ contentRef, updateTools: () => Promise.resolve(), onContentSaved });
      commits.commit(a);
      contentRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenCalledTimes(1);
    });
  });
});
