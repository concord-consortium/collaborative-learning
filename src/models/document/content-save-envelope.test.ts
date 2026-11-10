import { INotExactEvidence } from "../../lib/db-types";
import { hashString } from "../../utilities/js-utils";
import { buildExactSave, buildIntermediateSave, getDocumentTools, readSavedEnvelope } from "./content-save-envelope";
import { DocumentContentSnapshotType } from "./document-content";

const evidence: INotExactEvidence = {
  openEntries: [],
  runningFlows: [{ action: "/content/tileMap/t1/content/run" }],
  uncommittedEntryIds: ["e2"],
  since: 1234
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
      exactThrough: { id: "e5", index: 5, contentHash: hashString("{}"), since: "e0" },
      notExact: null
    });
  });
});

describe("buildIntermediateSave", () => {
  it("returns the intermediate save fields and clears exactThrough", () => {
    expect(buildIntermediateSave({
      content: "{}", changeCount: 4, entry: { id: "e1" }, evidence
    })).toEqual({
      content: "{}",
      changeCount: 4,
      lastHistoryEntryId: "e1",
      exactThrough: null,
      notExact: evidence
    });
  });

  it("omits the id when given no entry", () => {
    const values = buildIntermediateSave({ content: "{}", changeCount: 4, evidence });
    expect(values).toEqual({ content: "{}", changeCount: 4, exactThrough: null, notExact: evidence });
    expect("lastHistoryEntryId" in values).toBe(false);
  });
});

describe("readSavedEnvelope", () => {
  const content = JSON.stringify({ tileMap: {} });
  const exactThrough = { id: "e5", index: 5, contentHash: hashString(content), since: "e2" };

  it("keeps exactThrough when it was written with the envelope's id and content", () => {
    expect(readSavedEnvelope({ content, lastHistoryEntryId: "e5", exactThrough }))
      .toEqual({ lastHistoryEntryId: "e5", exactThrough: { index: 5, since: "e2" } });
  });

  it("drops exactThrough after a save that stamped another id over it", () => {
    expect(readSavedEnvelope({ content, lastHistoryEntryId: "e6", exactThrough }))
      .toEqual({ lastHistoryEntryId: "e6" });
  });

  it("drops exactThrough after a save that wrote other content with the same id", () => {
    const later = JSON.stringify({ tileMap: { t1: {} } });
    expect(readSavedEnvelope({ content: later, lastHistoryEntryId: "e5", exactThrough }))
      .toEqual({ lastHistoryEntryId: "e5" });
  });

  it("returns nothing for an envelope without an id", () => {
    expect(readSavedEnvelope({ content })).toBeUndefined();
  });
});
