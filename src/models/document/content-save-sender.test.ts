import { action, makeObservable, observable } from "mobx";
import { flow, Instance, types } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { ICommitListener, ICommitSource, ICommittedEntry } from "../history/history-commits";
import { IHistoryManager, TreeManagerType } from "../history/tree-manager";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { ContentSaveSender, IContentRef, IContentSaveSenderOptions, kMinimumSaveGapMs } from "./content-save-sender";
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

// Reports commits only when a test says so.
class StubCommitSource implements IHistoryManager, ICommitSource {
  lastCommitted: ICommittedEntry | undefined = undefined;
  applying = false;
  private listeners = new Set<ICommitListener>();
  private nextIndex = 1;

  constructor() {
    makeObservable(this, { applying: observable, setApplying: action });
  }

  onHistoryEntryCompleted() {
    // commits are reported by commit()
  }

  addCommitListener(listener: ICommitListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  commit(...ids: string[]) {
    const entries = ids.map(id => ({ id, index: this.nextIndex++ }));
    this.lastCommitted = entries[entries.length - 1];
    this.listeners.forEach(listener => listener.onCommitted(entries));
  }

  voidUncommitted() {
    this.listeners.forEach(listener => listener.onUncommittedVoided("remote-entry"));
  }

  setApplying(applying: boolean) {
    this.applying = applying;
  }
}

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
  child() {
    return { on: jest.fn(), off: jest.fn() };
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
  const sender = new ContentSaveSender(document,
    { contentRef, updateTools, onContentSaved, beforeWrite, ...overrides });

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

  return { document, treeManager, commits, tile, contentRef, updateTools, onContentSaved, beforeWrite,
    sender, edit, openEntry };
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
  let sender: ContentSaveSender | undefined;

  beforeEach(() => {
    // MST flows resume through queueMicrotask.
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
  });
  afterEach(() => {
    sender?.dispose();
    sender = undefined;
    jest.useRealTimers();
  });

  function track<T extends { sender: ContentSaveSender }>(context: T) {
    sender = context.sender;
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
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving exactly while entries complete faster than they commit", async () => {
      const { commits, contentRef, edit } = track(setup());
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(await edit(`text-${i}`));
      }
      for (let i = 0; i < 10; i++) {
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
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("drops uncommitted snapshots when they are voided", async () => {
      const { commits, contentRef, edit } = track(setup());
      const a = await edit("alpha");
      commits.voidUncommitted();
      commits.commit(a);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(contentRef.update).not.toHaveBeenCalled();
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

    it("doesn't show Saving for remote entries a group document applies", async () => {
      const { commits, document, tile } = track(setup({}, true));
      commits.setApplying(true);
      tile.setText("remote");
      await flush();
      expect(document.saveState).toBe(SaveState.Idle);
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
