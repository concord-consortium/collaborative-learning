import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {makeChange} from "firebase-functions-test/lib/v1";
import {makeDataSnapshot} from "firebase-functions-test/lib/providers/database";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";

import {initialize, projectConfig} from "./initialize";
import {onAnalyzableProdDocWritten, onAnalyzableTestDocWritten} from "../src/on-analyzable-doc-written";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await admin.firestore().collection("analysis").doc("queue").create({});
    await getDatabase().ref("demo").set(null);
  });

  describe("on-analyzable-doc-written with timestamp", () => {
    test("triggers on demo document evaluation field creation", async () => {
      const wrapped = fft.wrap(onAnalyzableTestDocWritten);

      const before = makeDataSnapshot(null,
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const after = makeDataSnapshot("1001",
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const delta = makeChange(before, after);

      await wrapped({
        data: delta,
        params: {
          realm: "demo",
          realmId: "AI",
          portalId: "demo",
          classId: "democlass1",
          userId: "1",
          docId: "testdoc1",
          evaluator: "categorize-design",
        }});

      expect(logger.info)
        // eslint-disable-next-line max-len
        .toHaveBeenCalledWith("Added document demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1 to queue for categorize-design");

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          docUpdated: "1001",
          evaluator: "categorize-design",
        });
      });
    });

    test("triggers on authed document evaluation field creation", async () => {
      const wrapped = fft.wrap(onAnalyzableProdDocWritten);

      const before = makeDataSnapshot(null,
        "authed/portals/learn/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const after = makeDataSnapshot("1001",
        "authed/portals/learn/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const delta = makeChange(before, after);

      await wrapped({
        data: delta,
        params: {
          realm: "authed",
          portalId: "learn",
          classId: "democlass1",
          userId: "1",
          docId: "testdoc1",
          evaluator: "categorize-design",
        }});

      expect(logger.info)
        // eslint-disable-next-line max-len
        .toHaveBeenCalledWith("Added document authed/portals/learn/classes/democlass1/users/1/documents/testdoc1 to queue for categorize-design");

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "authed/portals/learn/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "authed/portals/learn/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "authed/learn/documents/testdoc1/comments",
          docUpdated: "1001",
          evaluator: "categorize-design",
        });
      });
    });
  });

  describe("on-analyzable-doc-written with object value", () => {
    test("triggers on evaluation field creation with object value", async () => {
      const wrapped = fft.wrap(onAnalyzableTestDocWritten);

      const objectValue = {
        timestamp: 1001,
        aiPrompt: {
          mainPrompt: "here's a prompt",
          categorizationDescription: "categorize these",
          categories: ["a", "b"],
          keyIndicatorsPrompt: "KI prompt",
          discussionPrompt: "discusss.",
        },
      };

      const before = makeDataSnapshot(null,
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/custom");
      const after = makeDataSnapshot(objectValue,
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/custom");
      const delta = makeChange(before, after);

      await wrapped({
        data: delta,
        params: {
          realm: "demo",
          realmId: "AI",
          portalId: "demo",
          classId: "democlass1",
          userId: "1",
          docId: "testdoc1",
          evaluator: "custom",
        }});

      expect(logger.info)
        .toHaveBeenCalledWith(
          "Added document demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1 to queue for custom"
        );

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          docUpdated: 1001,
          evaluator: "custom",
          aiPrompt: {
            mainPrompt: "here's a prompt",
            categorizationDescription: "categorize these",
            categories: ["a", "b"],
            keyIndicatorsPrompt: "KI prompt",
            discussionPrompt: "discusss.",
          },
        });
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
