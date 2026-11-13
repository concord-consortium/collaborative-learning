import { destroy } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { buildLoadEntry } from "../history/schema-conversion";
import { FAKE_HISTORY_ENTRY_ID } from "../history/tree-manager";
import { LogEventName } from "../../lib/logger-types";
import { hashString } from "../../utilities/js-utils";
import { kConcurrentSaveJitterMs } from "./concurrent-content-save-sender";
import { kMaxRetryDelayMs, kMaxUsableSnapshots, kMinimumSaveGapMs, kSenderUnmountLimitMs } from "./content-save-sender";
import { FakeRtdbEnvelopeRef, flush, setup, textOf, trackSenders, twoStepGate } from "./content-save-sender-test-utils";
import { getContentSaveSender } from "./get-content-save-sender";
import { IndividualContentSaveSender, kIntermediateSaveIntervalMs } from "./individual-content-save-sender";
import { SaveState } from "./document";

describe("ContentSaveSender", () => {
  const track = trackSenders();

  describe("snapshot saving", () => {
    it("saves the snapshot taken when an entry completed, once that entry commits", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const a = await edit("alpha");
      await edit("bravo");

      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      const { values } = rtdbEnvelopeRef.writes[0];
      expect(textOf(values)).toBe("alpha");
      expect(values.content).not.toContain("bravo");
      expect(values).toMatchObject({
        lastHistoryEntryId: a,
        exactThrough: { id: a, index: 1, contentHash: hashString(values.content), since: "e0" },
        notExact: null
      });
    });

    it("sends nothing before the entry commits", async () => {
      const { rtdbEnvelopeRef, edit } = track(setup());
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs - 1);
      await flush();
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving exactly while entries complete faster than they commit", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const ids: string[] = [];
      for (let i = 0; i < kMaxUsableSnapshots; i++) {
        ids.push(await edit(`text-${i}`));
        jest.setSystemTime(Date.now() + kMinimumSaveGapMs);
      }
      for (let i = 0; i < kMaxUsableSnapshots; i++) {
        commits.commit(ids[i]);
        jest.advanceTimersByTime(kMinimumSaveGapMs);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(i + 1);
        const write = rtdbEnvelopeRef.lastWrite;
        expect(textOf(write.values)).toBe(`text-${i}`);
        expect(write.values.lastHistoryEntryId).toBe(ids[i]);
        expect(write.values.exactThrough).toMatchObject({ id: ids[i] });
        write.resolve();
        await flush();
      }
    });

    it("keeps one snapshot per minimum save gap while entries wait to commit, and the newest", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
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
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      // b and c were taken less than the gap after a, so their snapshots were dropped
      commits.commit(b);
      commits.commit(c);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);

      // a commit saves the newest snapshot kept among its entries
      commits.commit(d, e);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ lastHistoryEntryId: e, exactThrough: { id: e } });
      expect(textOf(rtdbEnvelopeRef.writes[1].values)).toBe("echo");
    });

    it("saves the nearest older kept snapshot when a commit's own snapshot was dropped", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const start = Date.now();
      const a = await edit("alpha");
      jest.setSystemTime(start + 300);
      const b = await edit("bravo");
      jest.setSystemTime(start + 600);
      await edit("charlie");

      commits.commit(a, b);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: { id: a } });
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
    });

    it("keeps only the newest usable snapshots while entries wait to commit", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const ids: string[] = [];
      for (let i = 0; i <= kMaxUsableSnapshots; i++) {
        ids.push(await edit(`text-${i}`));
        jest.setSystemTime(Date.now() + kMinimumSaveGapMs);
      }
      commits.commit(ids[0]);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      commits.commit(ids[1]);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values)
        .toMatchObject({ lastHistoryEntryId: ids[1], exactThrough: { id: ids[1] } });
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("text-1");
    });

    it("skips a snapshot taken while another entry was open, and uses the next usable one", async () => {
      const { commits, rtdbEnvelopeRef, edit, openEntry } = track(setup());
      const closeEntry = openEntry("open");
      const a = await edit("alpha");
      closeEntry();
      const b = await edit("bravo");

      commits.commit(a);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      commits.commit(b);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("bravo");
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(b);
    });

    it("skips a snapshot taken while the load entry is pending, and uses the next usable one", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, treeManager } = track(setup());
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
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      const a = await edit("alpha");
      expect(treeManager.pendingLoadEntry).toBeUndefined();
      commits.commit(loadEntry.id!, a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(a);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
    });

    it("skips a snapshot taken while a flow that had changed state was running", async () => {
      const { commits, rtdbEnvelopeRef, edit, tile, treeManager } = track(setup());
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
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      commits.commit(flowIds[0]);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(flowIds[0]);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
    });

    it("doesn't count a running flow that hasn't changed state", async () => {
      const { commits, rtdbEnvelopeRef, edit, tile } = track(setup());
      const gate = deferred<void>();
      const promise = tile.waitWithoutChanging(gate.promise);
      const a = await edit("alpha");

      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(a);
      gate.resolve();
      await promise;
    });

    it("saves nothing exact once the session is not exact", async () => {
      const { commits, rtdbEnvelopeRef, edit, treeManager } = track(setup());
      const a = await edit("alpha");
      treeManager.exactness.markNotExact("unrecorded-change");
      const b = await edit("bravo");

      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();

      commits.commit(b);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.writes.map(write => write.values.exactThrough !== null)).toEqual([true, false]);
    });

    it("drops uncommitted snapshots when they are voided", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const a = await edit("alpha");
      commits.voidUncommitted();
      commits.commit(a);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.writes.map(write => write.values.exactThrough !== null)).toEqual([false]);
    });

    it("saves the newest usable snapshot among entries committed together", async () => {
      const { commits, rtdbEnvelopeRef, edit, openEntry } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      const closeEntry = openEntry("open");
      const c = await edit("charlie");
      closeEntry();

      commits.commit(a, b, c);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("bravo");
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { index: 2 } });
    });

    it("doesn't count the entries of its own document actions as open entries", async () => {
      const { commits, rtdbEnvelopeRef, tile, treeManager, edit } = track(setup());
      const a = await edit("alpha");
      const ids: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
      // The write for a starts while the entry for this edit is being recorded.
      tile.setText("bravo");
      commits.commit(a);
      await flush();
      remove();
      expect(ids).toHaveLength(1);

      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      commits.commit(ids[0]);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values.lastHistoryEntryId).toBe(ids[0]);
    });

    it("doesn't count the open entry of a call that changed nothing", async () => {
      const { commits, rtdbEnvelopeRef, tile, treeManager } = track(setup());
      const openWhenCompleted: number[] = [];
      const ids: string[] = [];
      const remove = treeManager.addEntryCompletedListener(entry => {
        ids.push(entry.id);
        openWhenCompleted.push(treeManager.activeHistoryEntries.length);
      });
      // The second call's entry opens before the first call's entry completes, as when a tile that
      // was just added runs its setup calls.
      tile.setText("alpha");
      tile.changeNothing();
      await flush();
      remove();
      expect(ids).toHaveLength(1);
      expect(openWhenCompleted).toEqual([1]);

      commits.commit(ids[0]);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values)
        .toMatchObject({ lastHistoryEntryId: ids[0], exactThrough: { id: ids[0] } });
    });

    it("counts an open entry that has recorded changes, even when it waits only on a finished call", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, treeManager } = track(setup());
      treeManager.createHistoryEntry({
        id: "open", exchangeId: "open-x", tree: document.key, model: "TestTile", action: "/stuck", undoable: true
      });
      treeManager.startExchange("open", "open-y", "finished call");
      treeManager.addTreePatchRecord("open", "open-x", { tree: document.key, action: "/stuck",
        patches: [{ op: "replace", path: "/content/tileMap/t1/content/text", value: "stuck" }],
        inversePatches: [{ op: "replace", path: "/content/tileMap/t1/content/text", value: "" }] });
      jest.spyOn(document.treeMonitor!, "isFinishedCallExchange").mockImplementation(id => id === "open-y");

      const a = await edit("alpha");
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
    });

    it("skips a snapshot taken while a concurrent document applied remote entries", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup({}, true));
      commits.setApplying(true);
      const a = await edit("alpha");
      commits.setApplying(false);
      const b = await edit("bravo");

      commits.commit(a);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      commits.commit(b);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(b);
    });
  });

  describe("writes", () => {
    it("has one write in flight and sends the newest pending save when it finishes", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const [a, b, c, d] = [await edit("alpha"), await edit("bravo"), await edit("charlie"), await edit("delta")];

      commits.commit(a);
      commits.commit(b);
      commits.commit(c);
      commits.commit(d);
      jest.advanceTimersByTime(5000);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);

      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values.lastHistoryEntryId).toBe(d);
      expect(textOf(rtdbEnvelopeRef.writes[1].values)).toBe("delta");

      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      jest.advanceTimersByTime(5000);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("waits the minimum gap after the previous write started", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      jest.advanceTimersByTime(300);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      commits.commit(b);
      jest.advanceTimersByTime(699);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("uses the minimum gap the caller sets for each save", async () => {
      const getMinimumGapMs = jest.fn(() => 3000);
      const { commits, rtdbEnvelopeRef, edit } = track(setup({ getMinimumGapMs }));
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      commits.commit(b);
      expect(getMinimumGapMs).toHaveBeenCalledWith(expect.objectContaining({ kind: "snapshot", changeSeq: 2 }));
      jest.advanceTimersByTime(2999);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("retries a failed write with the newest save, never an older one", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        rtdbEnvelopeRef.writes[0].reject(new Error("offline"));
        await flush();
        jest.advanceTimersByTime(1000);
        // nothing newer, so the retry sends the same save
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
        expect(rtdbEnvelopeRef.writes[1].values.lastHistoryEntryId).toBe(a);

        commits.commit(b);
        rtdbEnvelopeRef.writes[1].reject(new Error("offline"));
        await flush();
        jest.advanceTimersByTime(2000);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);
        expect(rtdbEnvelopeRef.writes[2].values.lastHistoryEntryId).toBe(b);
        expect(textOf(rtdbEnvelopeRef.writes[2].values)).toBe("bravo");
        rtdbEnvelopeRef.writes[2].resolve();
        await flush();
        jest.advanceTimersByTime(10000);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);
      });
    });

    it("keeps the newest saved change when two writes finish out of order", async () => {
      const onDrained = jest.fn();
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved, sender } = track(setup({ onDrained }));
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      sender.handlePageHide();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);

      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledTimes(1);
      expect(onContentSaved).toHaveBeenLastCalledWith(document, b);
      jest.advanceTimersByTime(2 * kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      sender.detach();
      expect(onDrained).toHaveBeenCalledTimes(1);
      expect(document.savedEnvelope).toEqual(
        { lastHistoryEntryId: b, exactThrough: { index: 2, since: "e0" } });
    });

    it("records the envelope each newest write leaves in the RTDB, leaving the loaded envelope alone", async () => {
      const { commits, rtdbEnvelopeRef, document, edit } = track(setup());
      document.setLoadedEnvelope({ lastHistoryEntryId: "loaded" });
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded" });
      const a = await edit("alpha");
      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual(
        { lastHistoryEntryId: a, exactThrough: { index: 1, since: "e0" } });

      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ exactThrough: null });
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({ lastHistoryEntryId: a });
      expect(document.loadedEnvelope).toEqual({ lastHistoryEntryId: "loaded" });
    });

    it("records an intermediate save's envelope without exactThrough, or without an entry, as it leaves them",
        async () => {
      const { rtdbEnvelopeRef, document, edit } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "e0" } });
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: "loaded", exactThrough: null });
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({ lastHistoryEntryId: "loaded" });

      document.setSavedEnvelope(undefined);
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(document.savedEnvelope).toEqual({});
    });

    it("does nothing when a write lands after the document is destroyed", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved, sender, updateTools } = track(setup());
      const a = await edit("alpha");
      commits.commit(a);
      sender.dispose();
      destroy(document);
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        rtdbEnvelopeRef.writes[0].resolve();
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
      const { commits, rtdbEnvelopeRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      await edit("bravo");
      sender.handlePageHide();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);

      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      // the exact save of the first entry holds only "alpha", which would undo "bravo"
      commits.commit(a);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("backs off and shows Retrying from the third consecutive failure", async () => {
      const { commits, rtdbEnvelopeRef, document, edit } = track(setup());
      const a = await edit("alpha");

      await jestSpyConsole("warn", async spy => {
        commits.commit(a);
        rtdbEnvelopeRef.writes[0].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Saving);
        jest.advanceTimersByTime(999);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);

        rtdbEnvelopeRef.writes[1].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Saving);
        jest.advanceTimersByTime(1999);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(1);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);

        rtdbEnvelopeRef.writes[2].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Retrying);
        jest.advanceTimersByTime(3999);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);
        jest.advanceTimersByTime(1);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(4);
        expect(spy).toHaveBeenCalledTimes(3);

        rtdbEnvelopeRef.writes[3].resolve();
        await flush();
        expect(document.saveState).toBe(SaveState.Saved);

        // a success starts the count again
        const b = await edit("bravo");
        commits.commit(b);
        jest.advanceTimersByTime(kMinimumSaveGapMs);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(5);
        rtdbEnvelopeRef.writes[4].reject(new Error("offline"));
        await flush();
        expect(document.saveState).toBe(SaveState.Saving);
        jest.advanceTimersByTime(999);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(5);
        jest.advanceTimersByTime(1);
        expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(6);
      });
    });

    it("waits no more than 30 seconds between retries", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup());
      const a = await edit("alpha");

      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        for (let failures = 1; failures <= 8; failures++) {
          rtdbEnvelopeRef.lastWrite.reject(new Error("offline"));
          await flush();
          jest.advanceTimersByTime(kMaxRetryDelayMs);
          expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(failures + 1);
        }
      });
    });

    it("doesn't wait for, or fail on, the tools update", async () => {
      const updateTools = jest.fn(() => new Promise<void>(() => undefined));
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved } = track(setup({ updateTools }));
      const a = await edit("alpha");
      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(1);
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledWith(document, a);

      const failingTools = jest.fn(() => Promise.reject(new Error("no firestore")));
      const failing = track(setup({ updateTools: failingTools }));
      const b = await failing.edit("bravo");
      await jestSpyConsole("warn", async spy => {
        failing.commits.commit(b);
        failing.rtdbEnvelopeRef.writes[0].resolve();
        await flush();
        expect(failingTools).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(failing.document.saveState).toBe(SaveState.Saved);
    });

    it("sends tools only when the list of tile types changes", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, treeManager, updateTools } = track(setup());
      const a = await edit("alpha");
      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(1);
      expect(updateTools).toHaveBeenLastCalledWith(["TestTile"]);

      const b = await edit("bravo");
      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      rtdbEnvelopeRef.writes[1].resolve();
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
      rtdbEnvelopeRef.writes[2].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(2);
      expect(updateTools).toHaveBeenLastCalledWith([]);
    });

    it("sends a failed tools update again with the next save", async () => {
      const updateTools = jest.fn((tools: string[]) => Promise.resolve());
      updateTools.mockImplementationOnce(() => Promise.reject(new Error("no firestore")));
      const { commits, rtdbEnvelopeRef, edit } = track(setup({ updateTools }));
      const a = await edit("alpha");
      const b = await edit("bravo");
      await jestSpyConsole("warn", async () => {
        commits.commit(a);
        rtdbEnvelopeRef.writes[0].resolve();
        await flush();
      });
      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(updateTools).toHaveBeenCalledTimes(2);
      expect(updateTools).toHaveBeenLastCalledWith(["TestTile"]);
    });

    it("shows Saving on a change and Saved once a save covers the latest change", async () => {
      const { commits, rtdbEnvelopeRef, document, edit } = track(setup());
      expect(document.saveState).toBe(SaveState.Idle);
      const a = await edit("alpha");
      expect(document.saveState).toBe(SaveState.Saving);
      const b = await edit("bravo");

      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);

      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("doesn't show Saving for the changes a concurrent document's apply makes", async () => {
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

    it("shows Saving for a local edit made while a concurrent document applies remote entries", async () => {
      const { commits, rtdbEnvelopeRef, document, edit } = track(setup({}, true));
      commits.setApplying(true);
      document.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "remote" }
      ]);
      const a = await edit("local");
      expect(document.saveState).toBe(SaveState.Saving);
      commits.setApplying(false);

      // The snapshot taken during the apply isn't saved, so the edit stays unsaved.
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      const b = await edit("later");
      commits.commit(b);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("reports each saved id to onContentSaved, and calls beforeWrite before each write", async () => {
      const { beforeWrite, commits, rtdbEnvelopeRef, document, edit, onContentSaved } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");

      commits.commit(a);
      expect(beforeWrite).toHaveBeenCalledTimes(1);
      expect(beforeWrite.mock.invocationCallOrder[0])
        .toBeLessThan(rtdbEnvelopeRef.update.mock.invocationCallOrder[0]);
      await jestSpyConsole("warn", async () => {
        rtdbEnvelopeRef.writes[0].reject(new Error("offline"));
        await flush();
      });
      expect(onContentSaved).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(beforeWrite).toHaveBeenCalledTimes(2);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, a);

      commits.commit(b);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      rtdbEnvelopeRef.writes[2].resolve();
      await flush();
      expect(onContentSaved.mock.calls).toEqual([[document, a], [document, b]]);
    });
  });

  describe("lifetime", () => {
    it("stops listening when disposed", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, sender: disposed } = track(setup());
      const a = await edit("alpha");
      disposed.dispose();
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      expect(document.saveState).toBe(SaveState.Saving);
      await edit("bravo");
      jest.advanceTimersByTime(10000);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
    });

    it("restarts when attached after it was disposed", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, sender: restarted } = track(setup());
      restarted.dispose();
      restarted.attach({ rtdbEnvelopeRef, updateTools: () => Promise.resolve() });
      const a = await edit("alpha");
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
    });

    it("listens to the envelope reference it was last attached to", async () => {
      const { commits, rtdbEnvelopeRef, sender: attached } = track(setup({}, true));
      const newRef = new FakeRtdbEnvelopeRef();
      attached.attach({ rtdbEnvelopeRef: newRef, updateTools: () => Promise.resolve(), random: () => 0 });
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r9", exactThrough: { id: "r9", index: 9 } });
      newRef.fireEnvelope({ lastHistoryEntryId: "r5", exactThrough: { id: "r5", index: 5 } });
      await flush();
      commits.setRemoteHead("r5", 5);
      await flush();
      expect(newRef.update).not.toHaveBeenCalled();
      commits.setRemoteHead("r6", 6);
      await flush();
      expect(newRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
    });

    it("keeps saving after detach until a save covers the latest change, then disposes", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved, sender } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      commits.commit(a);
      sender.detach();

      commits.commit(b);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { id: b } });

      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, b);
      expect(document.saveState).toBe(SaveState.Saved);

      // disposed: it stops listening and a new attach gets a new sender
      const c = await edit("charlie");
      commits.commit(c);
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      const next = track({ sender: getContentSaveSender(document,
        { rtdbEnvelopeRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(next).not.toBe(sender);
    });

    it("keeps saving after detach until an exact save covers an intermediate save's content", async () => {
      const { commits, rtdbEnvelopeRef, edit, sender } = track(setup());
      const a = await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();

      commits.commit(a);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: { id: a } });
    });

    it("makes one intermediate save and stops 30 seconds after detach on an individual document", async () => {
      const logEvent = jest.fn();
      const { commits, rtdbEnvelopeRef, edit, sender } = track(setup({ logEvent }));
      const a = await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");

      // the intermediate save is still in flight when a newer change is made
      await edit("bravo");
      jest.advanceTimersByTime(kSenderUnmountLimitMs - kIntermediateSaveIntervalMs - 1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ exactThrough: null });
      expect(textOf(rtdbEnvelopeRef.writes[1].values)).toBe("bravo");
      expect(rtdbEnvelopeRef.writes[1].values.notExact.uncommittedEntryIds).toContain(a);
      expect(logEvent.mock.calls.map(([event, params]) => [event, params.endedBy])).toEqual([
        [LogEventName.CONTENT_SAVE_FALLBACK_START, undefined],
        [LogEventName.CONTENT_SAVE_FALLBACK_END, "session-end"]
      ]);

      rtdbEnvelopeRef.writes.forEach(write => write.resolve());
      await flush();
      commits.commit(a);
      await edit("charlie");
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("reports the writes sent before the drain timeout once they finish", async () => {
      const { rtdbEnvelopeRef, document, edit, onContentSaved, sender, updateTools } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "loaded" } });
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      await edit("bravo");
      jest.advanceTimersByTime(kSenderUnmountLimitMs - kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);

      rtdbEnvelopeRef.writes.forEach(write => write.resolve());
      await flush();
      expect(onContentSaved).toHaveBeenCalledTimes(2);
      expect(onContentSaved).toHaveBeenLastCalledWith(document, "loaded");
      expect(updateTools).toHaveBeenCalledWith(["TestTile"]);

      // nothing else starts again
      await edit("charlie");
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("records the envelope without exactThrough when it stops with an intermediate save in flight", async () => {
      const { rtdbEnvelopeRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(
        { lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "e0" } });
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(document.savedEnvelope)
        .toEqual({ lastHistoryEntryId: "loaded" });

      // a sender attached before the write lands sends an intermediate save on page hide
      const next = track({ sender: getContentSaveSender(document,
        { rtdbEnvelopeRef, updateTools: () => Promise.resolve(), random: () => 0 }) as IndividualContentSaveSender });
      expect(next.sender).not.toBe(sender);
      await edit("bravo");
      next.sender.handlePageHide();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({ exactThrough: null });
      expect(textOf(rtdbEnvelopeRef.writes[1].values)).toBe("bravo");
    });

    it("stops 30 seconds after detach on a concurrent document without an intermediate save", async () => {
      const { commits, rtdbEnvelopeRef, edit, sender } = track(setup({}, true));
      const a = await edit("alpha");
      const b = await edit("bravo");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs / 2);
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();

      jest.advanceTimersByTime(kSenderUnmountLimitMs / 2);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      commits.commit(b);
      await flush();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("reuses the draining sender when the document is attached again", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved, sender } = track(setup());
      const a = await edit("alpha");
      const b = await edit("bravo");
      commits.commit(a);
      sender.detach();

      const newOnContentSaved = jest.fn();
      const attached = getContentSaveSender(document,
        { rtdbEnvelopeRef, updateTools: () => Promise.resolve(), onContentSaved: newOnContentSaved });
      expect(attached).toBe(sender);
      commits.commit(b);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(newOnContentSaved).toHaveBeenCalledWith(document, a);
      expect(onContentSaved).not.toHaveBeenCalled();
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();

      // the drain was canceled, so it keeps saving
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      const c = await edit("charlie");
      commits.commit(c);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);
      expect(rtdbEnvelopeRef.writes[2].values).toMatchObject({ lastHistoryEntryId: c });
    });

    it("disposes a concurrent document's drain once its latest change is saved", async () => {
      // by its own save
      const own = track(setup({}, true));
      const a = await own.edit("alpha");
      own.commits.commit(a);
      own.sender.detach();
      own.rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      const next = track({ sender: getContentSaveSender(own.document,
        { rtdbEnvelopeRef: own.rtdbEnvelopeRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(next).not.toBe(own.sender);

      // by another member's save that reaches this client's newest committed entry
      const other = track(setup({ random: () => 0.5 }, true));
      const b = await other.edit("bravo");
      other.commits.commit(b);
      other.sender.detach();
      other.rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: b, exactThrough: { id: b, index: 1 } });
      await flush();
      jest.advanceTimersByTime(kConcurrentSaveJitterMs);
      expect(other.rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      const replaced = track({ sender: getContentSaveSender(other.document,
        { rtdbEnvelopeRef: other.rtdbEnvelopeRef, updateTools: () => Promise.resolve() }) }).sender;
      expect(replaced).not.toBe(other.sender);
    });

    it("calls onDrained when a drain ends, but not when it is canceled or the sender is disposed", async () => {
      const onDrained = jest.fn();
      const { commits, rtdbEnvelopeRef, document, edit, sender } = track(setup({ onDrained }));
      const a = await edit("alpha");
      commits.commit(a);
      sender.detach();
      getContentSaveSender(document, { rtdbEnvelopeRef, updateTools: () => Promise.resolve(), onDrained });
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(onDrained).not.toHaveBeenCalled();

      // the timeout calls it once the last intermediate save is sent
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      await edit("charlie");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs - 1);
      expect(onDrained).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(3);
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
      const { rtdbEnvelopeRef, document, edit, sender } = track(setup({ logEvent }));
      await edit("alpha");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(logEvent).toHaveBeenCalledWith(LogEventName.CONTENT_SAVE_FALLBACK_START, expect.anything());
      sender.detach();
      getContentSaveSender(document, { rtdbEnvelopeRef, updateTools: () => Promise.resolve(), logEvent });
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(logEvent).toHaveBeenCalledTimes(1);
    });

    it("keeps running while another attachment remains", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, sender } = track(setup());
      // lets the entry the setup opened complete
      await flush();
      getContentSaveSender(document, { rtdbEnvelopeRef, updateTools: () => Promise.resolve() });
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      const a = await edit("alpha");
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: { id: a } });
    });

    it("uses the newest options after attach", async () => {
      const { commits, rtdbEnvelopeRef, edit, sender: attached } = track(setup());
      const onContentSaved = jest.fn();
      const a = await edit("alpha");
      attached.attach({ rtdbEnvelopeRef, updateTools: () => Promise.resolve(), onContentSaved });
      commits.commit(a);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenCalledTimes(1);
    });
  });
});
