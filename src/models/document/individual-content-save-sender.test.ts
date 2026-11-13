import { LogEventName } from "../../lib/logger-types";
import { collectNotExactEvidence, kMaxEvidenceEntryIds } from "./content-save-checks";
import { kMinimumSaveGapMs, kSenderUnmountLimitMs } from "./content-save-sender";
import { flush, setup, textOf, trackSenders, twoStepGate } from "./content-save-sender-test-utils";
import { getContentSaveSender } from "./get-content-save-sender";
import { IndividualContentSaveSender, kIntermediateSaveIntervalMs } from "./individual-content-save-sender";
import { SaveState } from "./document";

describe("IndividualContentSaveSender", () => {
  const track = trackSenders();

  describe("saving caught-up content", () => {
    // A sender made for the document after the load caught it up.
    function setupCaughtUp(prepare: (context: ReturnType<typeof setup>) => void) {
      const context = setup();
      context.sender.dispose();
      context.commits.caughtUpTo = { id: "caught-up", index: 9 };
      context.document.setSavedEnvelope({ lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "e0" } });
      prepare(context);
      const { document, contentRef } = context;
      return track({ ...context,
        sender: getContentSaveSender(document, { contentRef, updateTools: () => Promise.resolve() }) });
    }

    it("saves the content the load caught up, stamped with the last entry it applied", async () => {
      const { contentRef, document } = setupCaughtUp(() => undefined);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({
        lastHistoryEntryId: "caught-up", exactThrough: { id: "caught-up", index: 9, since: "e0" }
      });
      contentRef.writes[0].resolve();
      await flush();
      expect(document.saveState).toBe(SaveState.Saved);
      expect(document.savedEnvelope).toEqual(
        { lastHistoryEntryId: "caught-up", exactThrough: { index: 9, since: "e0" } });
    });

    it("doesn't save caught-up content the envelope already holds, or once an entry has committed", () => {
      const saved = setupCaughtUp(({ document }) =>
        document.setSavedEnvelope({ lastHistoryEntryId: "caught-up", exactThrough: { index: 9, since: "e0" } }));
      expect(saved.contentRef.update).not.toHaveBeenCalled();
      const committed = setupCaughtUp(({ commits }) => { commits.lastCommitted = { id: "later", index: 10 }; });
      expect(committed.contentRef.update).not.toHaveBeenCalled();
    });

    it("doesn't save caught-up content once the session isn't exact", () => {
      const { contentRef } = setupCaughtUp(({ treeManager }) =>
        treeManager.exactness.markNotExact("catch-up-apply-failed"));
      expect(contentRef.update).not.toHaveBeenCalled();
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
      expect(values).toMatchObject({ exactThrough: null });
      expect(values).not.toHaveProperty("lastHistoryEntryId");
      expect(values.notExact.openEntries).toEqual([{
        id: "open", model: "TestTile", action: "/stuck",
        exchanges: ["TreeManager.createHistoryEntry /stuck"], openedAt
      }]);
    });

    it("stamps an intermediate save with the last committed entry, or the loaded id before any commit",
        async () => {
      const { commits, contentRef, document, edit, onContentSaved, treeManager } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "loaded" } });
      treeManager.exactness.markNotExact("unrecorded-change");
      const a = await edit("alpha");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ lastHistoryEntryId: "loaded", exactThrough: null });
      contentRef.writes[0].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, "loaded");

      commits.commit(a);
      await edit("bravo");
      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({
        lastHistoryEntryId: a, exactThrough: null
      });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
      contentRef.writes[1].resolve();
      await flush();
      expect(onContentSaved).toHaveBeenLastCalledWith(document, a);
    });

    it("stamps an intermediate save with the entry the load caught up to before any commit", async () => {
      const { commits, contentRef, document, edit, treeManager } = track(setup());
      document.setSavedEnvelope({ lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "loaded" } });
      commits.caughtUpTo = { id: "caught-up", index: 9 };
      treeManager.exactness.markNotExact("catch-up-hole");
      await edit("alpha");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({
        lastHistoryEntryId: "caught-up", exactThrough: null
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
      const since = Date.now();
      const { gate, first, second } = twoStepGate();
      const promise = tile.setTextLater("flow", gate);
      first.resolve();
      await flush();
      const a = await edit("alpha");
      treeManager.exactness.markNotExact("timed-out-entry");

      jest.advanceTimersByTime(kIntermediateSaveIntervalMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values.notExact).toEqual({
        openEntries: [],
        runningFlows: [{ action: "/content/tileMap/t1/content/setTextLater" }],
        uncommittedEntryIds: [a],
        notExactReason: "timed-out-entry",
        since
      });

      second.resolve();
      await promise;
    });

    it("logs an episode once at its start and once when an exact save ends it", async () => {
      const logEvent = jest.fn();
      const { commits, contentRef, edit, openEntry } = track(setup({ logEvent }));
      const since = Date.now();
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
      expect(contentRef.writes[2].values).toMatchObject({ lastHistoryEntryId: c, exactThrough: { id: c } });
      contentRef.writes[2].resolve();
      await flush();

      expect(logEvent.mock.calls).toEqual([
        [LogEventName.CONTENT_SAVE_FALLBACK_START, expect.objectContaining({
          openEntries: [expect.objectContaining({ id: "open" })],
          uncommittedEntryIds: [a],
          since
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
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { id: b } });
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
      expect(contentRef.writes.map(write => write.values.exactThrough !== null)).toEqual([true, true, true, true]);
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
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: c, exactThrough: { id: c } });
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
      expect(collectNotExactEvidence(document, ids, 0).uncommittedEntryIds).toEqual(ids.slice(5));
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
        contentRef.writes.forEach(write => expect(write.values.exactThrough).toBeNull());
        expect(document.saveState).toBe(SaveState.Saved);
        await new Promise(resolve => jest.requireActual<typeof import("timers")>("timers").setImmediate(resolve));
        expect(unhandledRejections).toEqual([]);
      } finally {
        process.removeListener("unhandledRejection", onUnhandledRejection);
      }
    });
  });

  describe("page hide", () => {
    const exactEnvelope = { lastHistoryEntryId: "loaded", exactThrough: { index: 7, since: "loaded" } };
    const unmarkedEnvelope = { lastHistoryEntryId: "loaded" };

    it("sends the newest committed snapshot at once on page hide", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      jest.advanceTimersByTime(200);
      const b = await edit("bravo");
      commits.commit(b);
      await edit("charlie");
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { id: b } });
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

    it("saves on the window's page hide while it drains after the last detach", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      sender.detach();
      window.dispatchEvent(new Event("pagehide"));
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b });
    });

    it("stops listening for the window's page hide once disposed", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      const b = await edit("bravo");
      commits.commit(b);
      const handlePageHide = jest.spyOn(sender, "handlePageHide");
      sender.dispose();
      window.dispatchEvent(new Event("pagehide"));
      expect(handlePageHide).not.toHaveBeenCalled();
      expect(contentRef.update).toHaveBeenCalledTimes(1);
    });

    it("makes no intermediate save on page hide before the document relies on them", async () => {
      const { contentRef, document, edit, openEntry, sender } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
      openEntry("open");
      await edit("alpha");
      sender.handlePageHide();
      expect(contentRef.update).not.toHaveBeenCalled();
    });

    it("sends an intermediate save at once on page hide when the loaded envelope has no exactThrough", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(unmarkedEnvelope);
      const a = await edit("alpha");
      commits.commit(a);
      expect(contentRef.update).toHaveBeenCalledTimes(1);

      // while the exact save of the committed entry is still in flight
      await edit("bravo");
      sender.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: a, exactThrough: null });
      expect(textOf(contentRef.writes[1].values)).toBe("bravo");
    });

    it("makes no intermediate save on page hide when the loaded envelope was settled", async () => {
      const { commits, contentRef, document, edit, sender } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
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
      expect(contentRef.writes[1].values).toMatchObject({ exactThrough: null });

      contentRef.writes[1].resolve();
      await flush();
      contentRef.writes[0].resolve();
      await flush();
      expect(logEvent.mock.calls.map(([event]) => event)).toEqual([LogEventName.CONTENT_SAVE_FALLBACK_START]);
    });

    it("sends an intermediate save at once on page hide after a drain ended on an intermediate save",
        async () => {
      const { contentRef, document, edit, sender, updateTools } = track(setup());
      document.setSavedEnvelope(exactEnvelope);
      await edit("alpha");
      sender.detach();
      jest.advanceTimersByTime(kSenderUnmountLimitMs);
      expect(contentRef.update).toHaveBeenCalledTimes(1);
      expect(contentRef.writes[0].values).toMatchObject({ exactThrough: null });
      contentRef.writes[0].resolve();
      await flush();

      const { sender: remounted } = track({
        sender: getContentSaveSender(document, { contentRef, updateTools }) as IndividualContentSaveSender
      });
      expect(remounted).not.toBe(sender);
      await edit("bravo");
      remounted.handlePageHide();
      expect(contentRef.update).toHaveBeenCalledTimes(2);
      expect(contentRef.writes[1].values).toMatchObject({ exactThrough: null });
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
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { id: b } });
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
      expect(contentRef.writes[1].values).toMatchObject({ exactThrough: null });
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
      expect(contentRef.writes[1].values).toMatchObject({ exactThrough: null });
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
      expect(contentRef.writes[1].values).toMatchObject({ lastHistoryEntryId: b, exactThrough: { id: b } });
    });
  });
});
