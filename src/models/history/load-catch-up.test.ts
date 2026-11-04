import { IFirestoreHistoryEntryDoc } from "./history-firestore";
import { kCatchUpMaxEntries, planCatchUp, takeContiguousEntries } from "./load-catch-up";

describe("planCatchUp", () => {
  it("needs nothing when the saved id is the last entry", () =>
    expect(planCatchUp({ id: "e9", index: 9 }, { id: "e9", index: 9 })).toEqual({ kind: "none" }));
  it("needs nothing when the save has no entry id", () =>
    expect(planCatchUp({}, { id: "e9", index: 9 })).toEqual({ kind: "none" }));
  it("needs nothing when Firestore has no history", () =>
    expect(planCatchUp({ id: "e5", index: 5 }, { id: null, index: -1 })).toEqual({ kind: "none" }));
  it("asks for the index when the envelope has none", () =>
    expect(planCatchUp({ id: "e5" }, { id: "e9", index: 9 })).toEqual({ kind: "need-index" }));
  it("needs nothing when the saved entry is not before the last entry", () =>
    expect(planCatchUp({ id: "e5", index: 9 }, { id: "e9", index: 9 })).toEqual({ kind: "none" }));
  it("fetches a gap of up to 200 entries", () => {
    expect(kCatchUpMaxEntries).toBe(200);
    expect(planCatchUp({ id: "e5", index: 5 }, { id: "e205", index: 205 }))
      .toEqual({ kind: "fetch", afterIndex: 5 });
  });
  it("refuses a gap over 200 entries", () =>
    expect(planCatchUp({ id: "e5", index: 5 }, { id: "e206", index: 206 }))
      .toEqual({ kind: "too-large", gap: 201 }));
});

describe("takeContiguousEntries", () => {
  const doc = (index: number, previousEntryId?: string): IFirestoreHistoryEntryDoc => ({
    id: `e${index}`, index, previousEntryId, entry: { id: `e${index}` } as any
  });

  it("keeps every entry when indexes and previousEntryId chain from the saved entry", () => {
    const docs = [doc(6, "e5"), doc(7, "e6"), doc(8, "e7")];
    expect(takeContiguousEntries(docs, "e5", 5)).toEqual({ entries: docs, complete: true });
  });
  it("stops at a missing index and reports incomplete", () => {
    const docs = [doc(6, "e5"), doc(7, "e6"), doc(9, "e8")];
    expect(takeContiguousEntries(docs, "e5", 5)).toEqual({ entries: docs.slice(0, 2), complete: false });
  });
  it("stops at an entry doc without an entry", () => {
    const docs = [doc(6, "e5"), { ...doc(7, "e6"), entry: undefined as any }, doc(8, "e7")];
    expect(takeContiguousEntries(docs, "e5", 5)).toEqual({ entries: docs.slice(0, 1), complete: false });
  });
  it("stops where previousEntryId breaks the chain", () => {
    const docs = [doc(6, "e5"), doc(7, "other"), doc(8, "e7")];
    expect(takeContiguousEntries(docs, "e5", 5)).toEqual({ entries: docs.slice(0, 1), complete: false });
  });
});
