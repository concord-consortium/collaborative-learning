import { IUnsettledEvidence } from "../../lib/db-types";
import { buildExactSave, buildIntermediateSave, getDocumentTools } from "./content-save-envelope";
import { DocumentContentSnapshotType } from "./document-content";

const evidence: IUnsettledEvidence = {
  openEntries: [],
  runningFlows: [{ action: "/content/tileMap/t1/content/run" }],
  uncommittedEntryIds: ["e2"],
  unsettledSince: 1234
};

describe("getDocumentTools", () => {
  it("lists each tile type once", () => {
    const snapshot = {
      tileMap: {
        t1: { id: "t1", content: { type: "Text" } },
        t2: { id: "t2", content: { type: "Table" } },
        t3: { id: "t3", content: { type: "Text" } }
      }
    } as unknown as DocumentContentSnapshotType;
    expect(getDocumentTools(snapshot)).toEqual(["Text", "Table"]);
  });

  it("adds Sparrow once for arrow annotations", () => {
    const snapshot = {
      tileMap: { t1: { id: "t1", content: { type: "Text" } } },
      annotations: {
        a1: { id: "a1", type: "arrowAnnotation" },
        a2: { id: "a2", type: "arrowAnnotation" },
        a3: { id: "a3", type: "otherAnnotation" }
      }
    } as unknown as DocumentContentSnapshotType;
    expect(getDocumentTools(snapshot)).toEqual(["Text", "Sparrow"]);
  });

  it("returns an empty list for an empty document", () => {
    expect(getDocumentTools({} as DocumentContentSnapshotType)).toEqual([]);
  });
});

describe("buildExactSave", () => {
  it("returns the exact save fields and clears the intermediate ones", () => {
    expect(buildExactSave({
      content: "{}", changeCount: 3, entry: { id: "e5", index: 5 }, exactSince: "e0"
    })).toEqual({
      content: "{}",
      changeCount: 3,
      lastHistoryEntryId: "e5",
      lastHistoryEntryIndex: 5,
      settled: true,
      exactSince: "e0",
      unsettled: null
    });
  });
});

describe("buildIntermediateSave", () => {
  it("returns the intermediate save fields and clears the exact ones", () => {
    expect(buildIntermediateSave({
      content: "{}", changeCount: 4, entry: { id: "e1", index: 1 }, evidence
    })).toEqual({
      content: "{}",
      changeCount: 4,
      lastHistoryEntryId: "e1",
      lastHistoryEntryIndex: 1,
      settled: null,
      exactSince: null,
      unsettled: evidence
    });
  });

  it("omits the index when the entry has none", () => {
    const values = buildIntermediateSave({ content: "{}", changeCount: 4, entry: { id: "e1" }, evidence });
    expect(values).toEqual({
      content: "{}", changeCount: 4, lastHistoryEntryId: "e1", settled: null, exactSince: null, unsettled: evidence
    });
    expect("lastHistoryEntryIndex" in values).toBe(false);
  });

  it("omits the id fields when given no entry", () => {
    const values = buildIntermediateSave({ content: "{}", changeCount: 4, evidence });
    expect(values).toEqual({ content: "{}", changeCount: 4, settled: null, exactSince: null, unsettled: evidence });
    expect("lastHistoryEntryId" in values).toBe(false);
    expect("lastHistoryEntryIndex" in values).toBe(false);
  });
});
