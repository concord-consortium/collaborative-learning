import { nanoid } from "nanoid";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { HistoryEntry } from "../history/history";
import { TreeManagerType } from "../history/tree-manager";
import { UserModel } from "./user";
import {
  ActivityRecorder, IActivityRecorderStores, kActivityMaxRetryDelayMs, kActivitySaveTimeoutMs, kActivityWriteFloorMs
} from "./activity-recorder";

jest.mock("firebase/app", () => ({
  firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIME", increment: (n: number) => ({ increment: n }) } }
}));

const mockSet = jest.fn();
const mockDocumentRef = jest.fn((_path: string) => ({ set: mockSet }));

const makeStores = (overrides: Partial<IActivityRecorderStores> = {}, user = {}): IActivityRecorderStores => ({
  appMode: "authed",
  user: UserModel.create({
    id: "7", type: "student", classHash: "cls", offeringId: "2000", portal: "learn.concord.org",
    currentGroupId: "3", ...user
  }),
  db: { firestore: { documentRef: mockDocumentRef } as any },
  ...overrides
});

const makeDocument = (type = "problem", uid = "7") =>
  createDocumentModel({ type: type as any, key: nanoid(), uid, content: {} });

const addEntry = (document: DocumentModelType, model = "TextContent",
                  action = "/content/tileMap/t/content/setText") => {
  const entry = HistoryEntry.create({ id: nanoid(), tree: document.key, model, action, state: "complete" });
  (document.treeManagerAPI as TreeManagerType).addHistoryEntryAfterApplying(entry);
  return entry;
};

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("ActivityRecorder", () => {
  let recorder: ActivityRecorder;

  const addSavedEntry = (document: DocumentModelType) => {
    const entry = addEntry(document);
    recorder.onContentSaved(document, entry.id);
    return entry;
  };
  const advance = async (ms: number) => {
    jest.advanceTimersByTime(ms);
    await flush();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockSet.mockReset();
    mockSet.mockResolvedValue(undefined);
    mockDocumentRef.mockClear();
  });
  afterEach(() => {
    recorder?.dispose();
    setVisibility("visible");
    jest.useRealTimers();
  });

  it("writes nothing for a Simulator or DataFlow tick", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const tick = addEntry(doc, "SimulatorTool", "/content/tileMap/s/content/step");
    const df = addEntry(doc, "DataflowProgram", "/content/tileMap/d/content/program/tickAndProcess");
    recorder.onLocalEntryUploaded(doc, tick);
    recorder.onLocalEntryUploaded(doc, df);
    recorder.onContentSaved(doc, df.id);
    jest.advanceTimersByTime(kActivitySaveTimeoutMs * 2);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("waits for a content save covering the entry, and an earlier entry's save does not release it", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const first = addEntry(doc);
    const second = addEntry(doc);
    recorder.onContentSaved(doc, first.id);
    recorder.onLocalEntryUploaded(doc, second);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
    recorder.onContentSaved(doc, second.id);
    await flush();
    expect(mockDocumentRef).toHaveBeenCalledWith("researcher_dashboard/learn_concord_org/activity/cls/users/7");
    expect(mockSet.mock.calls).toEqual([[
      { lastActivityAt: "SERVER_TIME", writeCount: { increment: 1 }, changed: { "2000": "SERVER_TIME" } },
      { merge: true }
    ]]);
  });

  it("writes an unsaved change once the save timeout passes", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    jest.advanceTimersByTime(kActivitySaveTimeoutMs - 1);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("gives one leading and one trailing write inside the floor, the trailing covering a change made in flight",
  async () => {
    let resolveSet: () => void = () => undefined;
    mockSet.mockImplementationOnce(() => new Promise<void>(r => { resolveSet = r; }));
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    resolveSet();
    await flush();
    jest.advanceTimersByTime(kActivityWriteFloorMs - 1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("keeps writing every floor interval under a steady stream of changes", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    for (let second = 0; second < 16; second++) {
      recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
      jest.advanceTimersByTime(1000);
      await flush();
    }
    expect(mockSet).toHaveBeenCalledTimes(4);
  });

  it("when hidden writes nothing for a change whose save is not confirmed", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    setVisibility("hidden");
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("on pagehide writes a change whose save is not confirmed", () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("on pagehide writes inside the floor of the previous write", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("retries a failed write after a wait that doubles with each failure, and a success resets it", async () => {
    mockSet.mockRejectedValue(new Error("unavailable"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
    const waits = [2, 4, 8].map(n => n * kActivityWriteFloorMs).concat(kActivityMaxRetryDelayMs);
    for (const [i, wait] of waits.entries()) {
      if (i === waits.length - 1) mockSet.mockResolvedValue(undefined);
      await advance(wait - 1);
      expect(mockSet).toHaveBeenCalledTimes(i + 1);
      await advance(1);
      expect(mockSet).toHaveBeenCalledTimes(i + 2);
    }
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    await advance(kActivityWriteFloorMs - 1);
    expect(mockSet).toHaveBeenCalledTimes(5);
    await advance(1);
    expect(mockSet).toHaveBeenCalledTimes(6);
  });

  it("keeps a save reported before the entry's upload lands", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const entry = addSavedEntry(doc);
    recorder.onLocalEntryUploaded(doc, entry);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("ignores the saved id loaded with the document and another document's save", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const other = makeDocument();
    const entry = addEntry(doc);
    doc.setSavedLastHistoryEntryId(entry.id);
    recorder.onContentSaved(other, entry.id);
    recorder.onLocalEntryUploaded(doc, entry);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("listens for pagehide only once it records a change", () => {
    const addListener = jest.spyOn(window, "addEventListener");
    const pagehideListeners = () => addListener.mock.calls.filter(([type]) => String(type) === "pagehide").length;
    recorder = new ActivityRecorder(makeStores());
    expect(pagehideListeners()).toBe(0);
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    expect(pagehideListeners()).toBe(1);
    addListener.mockRestore();
  });

  it.each([
    ["problem", "7", true], ["planning", "7", true], ["axes", "group_2000_3", true],
    ["axes", "group_1999_3", false], ["personal", "7", false], ["learningLog", "7", false],
    ["axes", "class_cls", false]
  ])("a %s document owned by %s sets the offering key: %s", (type, uid, expected) => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument(type, uid);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect("changed" in mockSet.mock.calls[0][0]).toBe(expected);
  });

  it.each([
    ["demo", "student"], ["qa", "student"], ["dev", "student"], ["test", "student"],
    ["authed", "teacher"], ["authed", "researcher"]
  ])("writes nothing in %s mode for a %s", (appMode, type) => {
    recorder = new ActivityRecorder(makeStores({ appMode: appMode as any }, { type }));
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).not.toHaveBeenCalled();
  });

  it.each(["classHash", "offeringId"])("writes nothing for a student whose launch has no %s", field => {
    recorder = new ActivityRecorder(makeStores({}, { [field]: "" }));
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).not.toHaveBeenCalled();
  });
});
