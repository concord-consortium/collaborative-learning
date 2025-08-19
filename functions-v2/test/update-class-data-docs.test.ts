import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {updateClassDataDocs} from "../../shared/update-class-data-docs";
import {setupTestDocuments} from "./test-utils";
import {getFirestore} from "firebase-admin/firestore";

jest.mock("firebase-functions/logger");

const {cleanup} = initialize();

describe("updateClassDataDocs", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
  });

  afterAll(async () => {
    await cleanup();
  });

  test("runs without error on empty database", async () => {
    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("creates a class data doc for new class", async () => {
    await setupTestDocuments({
      demo: "AITEST",
      unit: "qa-config-subtabs",
      documentId: "testdoc1",
      classId: "test-class",
      uid: "1",
    });
    await setupTestDocuments({
      demo: "AITEST",
      unit: "qa-config-subtabs",
      documentId: "testdoc2",
      classId: "test-class",
      uid: "2",
      lastEditedAt: new Date(Date.now() - 1000), // 1 second ago
    });

    await updateClassDataDocs({logger});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Updating class data doc for qa-config-subtabs test-class");

    const classDataDoc = await getFirestore().doc(
      "demo/AITEST/aicontent/qa-config-subtabs/classes/test-class"
    ).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toEqual({
      lastEditedAt: expect.any(Number),
      userCount: 2,
      documentCount: 2,
      teacherContent: expect.any(String),
      studentContent: expect.any(String),
      summary: null,
    });
    expect(classDataDoc.data()?.studentContent).toContain("CLUE Document Summary");
  });
});
