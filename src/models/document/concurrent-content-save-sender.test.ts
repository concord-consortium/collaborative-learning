import { FAKE_HISTORY_ENTRY_ID } from "../history/tree-manager";
import { LogEventName } from "../../lib/logger-types";
import { hashString } from "../../utilities/js-utils";
import { kConcurrentSaveJitterMs } from "./concurrent-content-save-sender";
import { kMinimumSaveGapMs } from "./content-save-sender";
import { flush, setup, textOf, trackSenders, twoStepGate } from "./content-save-sender-test-utils";
import { getContentSaveSender } from "./get-content-save-sender";
import { kIntermediateSaveIntervalMs } from "./individual-content-save-sender";
import { SaveState } from "./document";

describe("ConcurrentContentSaveSender", () => {
  const track = trackSenders();

  describe("saving", () => {
    it("logs once when the session stops being exact, even for a later sender", () => {
      const logEvent = jest.fn();
      const { rtdbEnvelopeRef, document, sender, treeManager } = track(setup({ logEvent }, true));
      treeManager.exactness.markNotExact("unrecorded-change");
      treeManager.exactness.markNotExact("timed-out-entry");
      expect(logEvent.mock.calls).toEqual([
        [LogEventName.CONTENT_SAVE_CONCURRENT_STOPPED, { reason: "unrecorded-change" }]
      ]);

      sender.dispose();
      track({
        sender: getContentSaveSender(document, { rtdbEnvelopeRef, updateTools: () => Promise.resolve(), logEvent })
      });
      expect(logEvent).toHaveBeenCalledTimes(1);
    });

    it("saves the current state, stamped with the remote head, when an idle member settles", async () => {
      const { applyRemote, rtdbEnvelopeRef, document, onContentSaved } = track(setup({}, true));
      await applyRemote("r9", "remote");
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      const { values } = rtdbEnvelopeRef.writes[0];
      expect(values).toMatchObject({
        lastHistoryEntryId: "r9",
        exactThrough: { id: "r9", index: 1, contentHash: hashString(values.content), since: "e0" },
        notExact: null
      });
      expect(textOf(values)).toBe("remote");

      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenCalledWith(document, "r9");
      // nothing newer to save
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("doesn't save while the queue has entries, an upload or apply runs, or an entry is open", async () => {
      const { commits, rtdbEnvelopeRef, edit, openEntry, tile, treeManager } = track(setup({}, true));
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
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();

      // The snapshot of a isn't usable, so the settled state is saved once a commits.
      commits.commit(a);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: { index: 2 } });
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
      rtdbEnvelopeRef.writes[0].resolve();
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
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);

      // The flow's own snapshot is saved once it commits, and nothing once the session isn't exact.
      commits.commit(...commits.uncommitted);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      treeManager.exactness.markNotExact("unrecorded-change");
      commits.advanceRemoteHead("r9");
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("treats an envelope whose exactThrough names another id as behind", async () => {
      const { commits, rtdbEnvelopeRef } = track(setup({}, true));
      // A client that doesn't know exactThrough stamped its own id over a save at index 9.
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "other", exactThrough: { id: "r9", index: 9 } });
      await flush();
      commits.setRemoteHead("r4", 4);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("skips a save when the envelope is already at or past its index", async () => {
      const { commits, rtdbEnvelopeRef } = track(setup({}, true));
      // An envelope without exactThrough counts as behind.
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "old", exactThrough: null });
      await flush();
      commits.setRemoteHead("r4", 4);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();

      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r9", exactThrough: { id: "r9", index: 9 } });
      await flush();
      commits.setRemoteHead("r9", 9);
      await flush();
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r12", exactThrough: { id: "r12", index: 12 } });
      await flush();
      commits.setRemoteHead("r10", 10);
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("re-checks the envelope after the jitter and skips if another member saved meanwhile", async () => {
      const { commits, rtdbEnvelopeRef } = track(setup({ random: () => 0.5 }, true));
      commits.setRemoteHead("r8", 8);
      await flush();
      jest.advanceTimersByTime(kConcurrentSaveJitterMs / 2 - 1);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values.lastHistoryEntryId).toBe("r8");
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      commits.setRemoteHead("r9", 9);
      await flush();
      jest.advanceTimersByTime(50);
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r9", exactThrough: { id: "r9", index: 9 } });
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("keeps a waiting save's jitter when a newer commit replaces it", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup({ random: () => 1 }, true));
      for (let i = 1; i <= 4; i++) {
        commits.commit(await edit(`tick-${i}`));
        await flush();
        jest.advanceTimersByTime(kConcurrentSaveJitterMs / 4);
      }
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("tick-4");
    });

    it("doesn't replace a commit's save with a settled save at the same index", async () => {
      // The commit's save waits half the jitter. A settled save queued in its place would wait it all.
      const random = jest.fn().mockReturnValueOnce(0.5).mockReturnValue(1);
      const { commits, rtdbEnvelopeRef, edit } = track(setup({ random }, true));
      const a = await edit("alpha");
      commits.commit(a);
      await flush();
      jest.advanceTimersByTime(kConcurrentSaveJitterMs / 2);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: { index: 1 } });
    });

    it("stamps a snapshot save with the committed entry and stale-checks it too", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup({ random: () => 0.5 }, true));
      const a = await edit("alpha");
      commits.commit(a);
      jest.advanceTimersByTime(kConcurrentSaveJitterMs / 2 - 1);
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(rtdbEnvelopeRef.writes[0].values).toMatchObject({
        lastHistoryEntryId: a, exactThrough: { index: 1, since: "e0" }
      });
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("alpha");
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();
      jest.advanceTimersByTime(kMinimumSaveGapMs);

      const b = await edit("bravo");
      commits.commit(b);
      jest.advanceTimersByTime(50);
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: b, exactThrough: { id: b, index: 2 } });
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });

    it("never saves a snapshot voided by a remote entry, and resumes after the next commit", async () => {
      const { applyRemote, commits, rtdbEnvelopeRef, edit } = track(setup({}, true));
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) {
        ids.push(await edit(`tick-${i}`));
      }
      commits.commit(ids[0]);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      expect(textOf(rtdbEnvelopeRef.writes[0].values)).toBe("tick-1");
      rtdbEnvelopeRef.writes[0].resolve();
      await flush();

      await applyRemote("r", "remote");
      const e6 = await edit("tick-6");
      commits.commit(...ids.slice(1));
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);

      commits.commit(e6);
      jest.advanceTimersByTime(kMinimumSaveGapMs);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values).toMatchObject({
        lastHistoryEntryId: e6, exactThrough: { id: e6, index: 7 }
      });
      expect(textOf(rtdbEnvelopeRef.writes[1].values)).toBe("tick-6");
      rtdbEnvelopeRef.writes[1].resolve();
      await flush();
      jest.advanceTimersByTime(10000);
      await flush();
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
    });

    it("shows Saved and reports the id when another member's save covers this client's change", async () => {
      const { commits, rtdbEnvelopeRef, document, edit, onContentSaved } =
        track(setup({ random: () => 0.5 }, true));
      const a = await edit("alpha");
      commits.commit(a);
      expect(document.saveState).toBe(SaveState.Saving);
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r3", exactThrough: { id: "r3", index: 3 } });
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
      expect(onContentSaved).toHaveBeenCalledWith(document, "r3");
      jest.advanceTimersByTime(kConcurrentSaveJitterMs);
      await flush();
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();

      // A newer change keeps it Saving, while the committed change is still reported.
      const b = await edit("bravo");
      commits.commit(b);
      await edit("charlie");
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r6", exactThrough: { id: "r6", index: 6 } });
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);
      expect(onContentSaved.mock.calls).toEqual([[document, "r3"], [document, "r6"]]);
    });

    it("shows Saved once the envelope reaches the head after a rollback undid this client's change",
        async () => {
      const { commits, rtdbEnvelopeRef, document, edit, sender } = track(setup({ random: () => 0.5 }, true));
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
      jest.advanceTimersByTime(kConcurrentSaveJitterMs / 4);
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: "r1", exactThrough: { id: "r1", index: 1 } });
      await flush();
      jest.advanceTimersByTime(kConcurrentSaveJitterMs);
      await flush();
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
      expect(document.saveState).toBe(SaveState.Saved);
      expect((sender as unknown as { keptSnapshots: Map<string, unknown> }).keptSnapshots.size).toBe(0);
    });

    it("ignores the envelope of its own write while that write is in flight", async () => {
      const { commits, rtdbEnvelopeRef, document, edit } = track(setup({}, true));
      const a = await edit("alpha");
      commits.commit(a);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
      // The RTDB raises local events for a write before the server accepts it.
      rtdbEnvelopeRef.fireEnvelope({ lastHistoryEntryId: a, exactThrough: { id: a, index: 1 } });
      await flush();
      expect(document.saveState).toBe(SaveState.Saving);

      await jestSpyConsole("warn", async () => {
        rtdbEnvelopeRef.writes[0].reject(new Error("denied"));
        await flush();
      });
      jest.advanceTimersByTime(1000);
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(2);
      expect(rtdbEnvelopeRef.writes[1].values.lastHistoryEntryId).toBe(a);
    });
  });

  describe("intermediate saves", () => {
    it("never makes an intermediate save on a concurrent document", async () => {
      const { rtdbEnvelopeRef, edit, openEntry, treeManager } = track(setup({}, true));
      openEntry("open");
      treeManager.exactness.markNotExact("unrecorded-change");
      await edit("alpha");
      jest.advanceTimersByTime(5 * kIntermediateSaveIntervalMs);
      await flush();
      expect(rtdbEnvelopeRef.update).not.toHaveBeenCalled();
    });
  });

  describe("page hide", () => {
    it("doesn't listen for the window's page hide on a concurrent document", () => {
      const addListener = jest.spyOn(window, "addEventListener");
      try {
        track(setup({}, true));
        expect(addListener.mock.calls.some(([type]) => (type as string) === "pagehide")).toBe(false);
      } finally {
        addListener.mockRestore();
      }
    });

    it("does nothing on page hide for a concurrent document", async () => {
      const { commits, rtdbEnvelopeRef, edit } = track(setup({}, true));
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      window.dispatchEvent(new Event("pagehide"));
      expect(rtdbEnvelopeRef.update).toHaveBeenCalledTimes(1);
    });
  });
});
