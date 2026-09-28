import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {updateClassDataDocs, updateSingleClassDataDoc} from "../../shared/update-class-data-docs";
import {kClassHash, kOtherUserId, setupClassTeachers, setupTestDocuments} from "./test-utils";
import {getFirestore} from "firebase-admin/firestore";
import {getUnitSummary, IUnitSummaryFetchResult} from "../../shared/get-unit-summary";
import {ILiveProblem} from "../../shared/unit-summary-slice";

jest.mock("firebase-functions/logger");
jest.mock("../../shared/get-unit-summary");

const {cleanup} = initialize();

const mockGetUnitSummary = getUnitSummary as jest.MockedFunction<typeof getUnitSummary>;

function liveProblems(ordinals: string[]): ILiveProblem[] {
  return ordinals.map((ordinal) => ({ordinal, title: `Problem ${ordinal}`}));
}

function unitSummaryResult(ordinals: string[]): IUnitSummaryFetchResult {
  return {summary: undefined, liveProblems: liveProblems(ordinals)};
}

const kTextTile = (text: string) => ({type: "Text", text});
// Table counts unconditionally in documentHasStudentWork (no per-instance check), which is
// exactly why an untouched Table is the sharpest fixture for documentHasStudentEdits: without the
// edit check, a document holding only this tile would already read as "has student work" the
// instant it is auto-created from a unit's authored template.
const kEmptyTableTile = {type: "Table"};

afterAll(async () => {
  await cleanup();
});

describe("updateClassDataDocs", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
    mockGetUnitSummary.mockReset();
  });

  test("runs without error on empty database", async () => {
    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("creates and updates class data doc", async () => {
    const dataDocPath = `demo/AITEST/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const dataDoc = await getFirestore().doc(dataDocPath).get();
    expect(dataDoc.exists).toBe(false);

    const lastEditedAt = new Date().getDate();
    await setupTestDocuments({
      documentId: "testdoc1",
      lastEditedAt,
    });
    await setupTestDocuments({
      documentId: "testdoc2",
      uid: kOtherUserId,
      lastEditedAt: lastEditedAt - 2000,
    });

    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Updating class data doc for qa-config-subtabs class-hash");

    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toEqual({
      lastEditedAt: lastEditedAt,
      userCount: 2,
      documentCount: 2,
      teacherContent: expect.any(String),
      studentContent: expect.any(String),
      summary: null,
    });
    expect(classDataDoc.data()?.studentContent).toContain("CLUE Document Summary");

    // Running it again without changes should not update the class data doc
    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith("Class data doc for qa-config-subtabs class-hash already up to date");

    const classDataDoc2 = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc2.exists).toBe(true);
    expect(classDataDoc2.data()).toEqual(classDataDoc.data());

    // Add a new document
    await setupTestDocuments({
      documentId: "testdoc3",
      lastEditedAt: lastEditedAt + 2000,
    });

    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith("Updating class data doc for qa-config-subtabs class-hash");

    const classDataDoc3 = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc3.exists).toBe(true);
    expect(classDataDoc3.data()).toEqual({
      lastEditedAt: lastEditedAt + 2000,
      userCount: 2,
      documentCount: 3,
      teacherContent: expect.any(String),
      studentContent: expect.any(String),
      summary: null,
    });
  });
});

describe("currentProblemOrdinal", () => {
  const dataDocPath = `demo/AITEST/aicontent/qa-config-subtabs/classes/${kClassHash}`;

  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
    mockGetUnitSummary.mockReset();
  });

  async function currentProblemOrdinal() {
    await updateSingleClassDataDoc(undefined, "AITEST", "qa-config-subtabs", kClassHash, logger);
    const doc = await getFirestore().doc(dataDocPath).get();
    return doc.data()?.currentProblemOrdinal;
  }

  test("a teacher's document ahead of the class is ignored", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2", "2.1"]));
    await setupClassTeachers({teacherUids: [kOtherUserId]});
    await setupTestDocuments({
      documentId: "student-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });
    await setupTestDocuments({
      documentId: "teacher-doc", uid: kOtherUserId, investigation: "2", problem: "1",
      tiles: [kTextTile("teacher preview")],
    });

    expect(await currentProblemOrdinal()).toBe("1.1");
  });

  test("a personal document (no investigation/problem) is ignored", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "personal-doc", uid: kOtherUserId, tiles: [kTextTile("personal work")],
    });
    await setupTestDocuments({
      documentId: "curriculum-doc", investigation: "1", problem: "2", tiles: [kTextTile("student work")],
    });

    expect(await currentProblemOrdinal()).toBe("1.2");
  });

  test("an auto-created document with no student work is ignored", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "empty-doc", uid: kOtherUserId, investigation: "1", problem: "1", tiles: [],
    });
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "2", tiles: [kTextTile("student work")],
    });

    expect(await currentProblemOrdinal()).toBe("1.2");
  });

  test("a document with work, no lastEditedAt, but a changeCount still counts " +
      "(still connected, not yet disconnected)", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1"]));
    await setupTestDocuments({
      documentId: "connected-doc", investigation: "1", problem: "1", lastEditedAt: null, changeCount: 1,
      tiles: [kTextTile("still connected, not yet disconnected")],
    });

    expect(await currentProblemOrdinal()).toBe("1.1");
  });

  test("an older record (lastEditedAt set, no changeCount field) still counts", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1"]));
    await setupTestDocuments({
      // lastEditedAt defaults to a real timestamp; changeCount is deliberately left unset,
      // matching a document saved before that field existed.
      documentId: "legacy-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });

    expect(await currentProblemOrdinal()).toBe("1.1");
  });

  test("a changeCount of 0 is authoritative even with a non-null lastEditedAt (an Ideas click, " +
      "no actual edit)", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });
    // lastEditedAt (its default here is a real timestamp) is also written on an Ideas click,
    // regardless of whether the student edited anything, so a changeCount of 0 must win.
    await setupTestDocuments({
      documentId: "ideas-clicked-doc", uid: kOtherUserId, investigation: "1", problem: "2",
      changeCount: 0, tiles: [kEmptyTableTile],
    });

    expect(await currentProblemOrdinal()).toBe("1.1");
  });

  test("an untouched document (an empty Table tile, no changeCount, no lastEditedAt) " +
      "does not advance the class", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });
    // Table counts unconditionally in documentHasStudentWork alone -- if documentHasStudentEdits
    // were not also required, this document's later ordinal (1.2) would incorrectly win.
    await setupTestDocuments({
      documentId: "untouched-doc", uid: kOtherUserId, investigation: "1", problem: "2", lastEditedAt: null,
      tiles: [kEmptyTableTile],
    });

    expect(await currentProblemOrdinal()).toBe("1.1");
  });

  test("the same untouched-looking document, once it has a changeCount, does advance the class", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });
    await setupTestDocuments({
      documentId: "edited-doc", uid: kOtherUserId, investigation: "1", problem: "2", lastEditedAt: null,
      changeCount: 1, tiles: [kEmptyTableTile],
    });

    expect(await currentProblemOrdinal()).toBe("1.2");
  });

  test("work in 2.1 and 1.3 resolves to 2.1", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2", "1.3", "2.1"]));
    await setupTestDocuments({
      documentId: "doc-1-3", investigation: "1", problem: "3", tiles: [kTextTile("work in 1.3")],
    });
    await setupTestDocuments({
      documentId: "doc-2-1", uid: kOtherUserId, investigation: "2", problem: "1",
      tiles: [kTextTile("work in 2.1")],
    });

    expect(await currentProblemOrdinal()).toBe("2.1");
  });

  test("\"1.10\" vs \"1.9\" is resolved by authored order, not string order", async () => {
    // Authored (numeric) order has 1.9 before 1.10; a lexicographic string sort would put "1.10"
    // before "1.9" instead and pick the wrong one as "furthest along".
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.8", "1.9", "1.10"]));
    await setupTestDocuments({
      documentId: "doc-1-10", investigation: "1", problem: "10", tiles: [kTextTile("work in 1.10")],
    });
    await setupTestDocuments({
      documentId: "doc-1-9", uid: kOtherUserId, investigation: "1", problem: "9",
      tiles: [kTextTile("work in 1.9")],
    });

    expect(await currentProblemOrdinal()).toBe("1.10");
  });

  test("no qualifying work leaves the field absent", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult(["1.1", "1.2"]));
    await setupTestDocuments({
      documentId: "empty-doc", investigation: "1", problem: "1", tiles: [],
    });

    expect(await currentProblemOrdinal()).toBeUndefined();
  });

  test("getUnitSummary returning undefined leaves the field absent but still writes the rest", async () => {
    mockGetUnitSummary.mockResolvedValue(undefined);
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });

    await updateSingleClassDataDoc(undefined, "AITEST", "qa-config-subtabs", kClassHash, logger);
    const doc = await getFirestore().doc(dataDocPath).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.currentProblemOrdinal).toBeUndefined();
    expect(doc.data()?.studentContent).toContain("CLUE Document Summary");
  });

  test("getUnitSummary rejecting leaves the field absent but still writes the rest", async () => {
    mockGetUnitSummary.mockRejectedValue(new Error("unexpected failure"));
    await setupTestDocuments({
      documentId: "worked-doc", investigation: "1", problem: "1", tiles: [kTextTile("student work")],
    });

    await updateSingleClassDataDoc(undefined, "AITEST", "qa-config-subtabs", kClassHash, logger);
    const doc = await getFirestore().doc(dataDocPath).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.currentProblemOrdinal).toBeUndefined();
    expect(doc.data()?.studentContent).toContain("CLUE Document Summary");
  });
});
