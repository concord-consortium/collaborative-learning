import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {updateClassDataDocs} from "../../shared/update-class-data-docs";
import {kClassHash, kOtherUserId, setupTestDocuments} from "./test-utils";
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
