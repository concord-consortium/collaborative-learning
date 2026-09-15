import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {makeChange} from "firebase-functions-test/lib/v1";
import {makeDataSnapshot} from "firebase-functions-test/lib/providers/database";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";

import {initialize, projectConfig} from "./initialize";
import {
  normalizeRequestContext, onAnalyzableProdDocWritten, onAnalyzableTestDocWritten,
} from "../src/on-analyzable-doc-written";

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
        .toHaveBeenCalledWith("Added document demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1 to queue for categorize-design with aiPrompt null");

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          firestoreDocumentPath: "demo/AI/documents/testdoc1",
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
        .toHaveBeenCalledWith("Added document authed/portals/learn/classes/democlass1/users/1/documents/testdoc1 to queue for categorize-design with aiPrompt null");

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "authed/portals/learn/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "authed/portals/learn/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "authed/learn/documents/testdoc1/comments",
          firestoreDocumentPath: "authed/learn/documents/testdoc1",
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
          // eslint-disable-next-line max-len
          "Added document demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1 to queue for custom with aiPrompt {\"mainPrompt\":\"here's a prompt\",\"categorizationDescription\":\"categorize these\",\"categories\":[\"a\",\"b\"],\"keyIndicatorsPrompt\":\"KI prompt\",\"discussionPrompt\":\"discusss.\"}"
        );

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          firestoreDocumentPath: "demo/AI/documents/testdoc1",
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

  describe("on-analyzable-doc-written with a request context", () => {
    const writeEvaluation = async (value: any) => {
      const path =
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design";
      const delta = makeChange(makeDataSnapshot(null, path), makeDataSnapshot(value, path));
      await fft.wrap(onAnalyzableTestDocWritten)({
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
      return admin.firestore().collection("analysis/queue/pending").doc("testdoc1").get()
        .then((result) => result.data());
    };

    test("stores the context alongside the timestamp", async () => {
      const queued = await writeEvaluation({
        timestamp: 1001,
        context: {unit: "vibe", investigation: "1", problem: "1", offeringId: "2001"},
      });

      expect(queued).toEqual({
        metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
        documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
        commentsPath: "demo/AI/documents/testdoc1/comments",
        firestoreDocumentPath: "demo/AI/documents/testdoc1",
        docUpdated: 1001,
        evaluator: "categorize-design",
        requestContext: {unit: "vibe", investigation: "1", problem: "1", offeringId: "2001"},
      });
    });

    test("stores no context when the request carries none", async () => {
      const queued = await writeEvaluation({timestamp: 1001});

      expect(queued).not.toHaveProperty("requestContext");
    });

    test("stores no context when the request carries a partial one", async () => {
      const queued = await writeEvaluation({timestamp: 1001, context: {unit: "vibe", investigation: "1"}});

      expect(queued).not.toHaveProperty("requestContext");
    });
  });

  describe("normalizeRequestContext", () => {
    const context = {unit: "vibe", investigation: "1", problem: "2", offeringId: "2001"};

    test("keeps the four fields", () => {
      expect(normalizeRequestContext(context)).toEqual(context);
    });

    test("drops anything else the caller wrote", () => {
      expect(normalizeRequestContext({...context, context_id: "someclass", nonsense: {a: 1}})).toEqual(context);
    });

    test("drops the whole context when a curriculum field is missing, empty, or not a string", () => {
      expect(normalizeRequestContext({...context, unit: undefined})).toBeUndefined();
      expect(normalizeRequestContext({...context, investigation: ""})).toBeUndefined();
      expect(normalizeRequestContext({...context, problem: 2})).toBeUndefined();
    });

    // Shaped like a unit code, but names no unit, so a document filed under it would sit in a
    // problem that does not exist.
    test("drops a context naming the placeholder unit", () => {
      expect(normalizeRequestContext({...context, unit: "NULL"})).toBeUndefined();
    });

    test("drops a unit that is not shaped like a unit code", () => {
      expect(normalizeRequestContext({...context, unit: "https://example.com/content.json"})).toBeUndefined();
      expect(normalizeRequestContext({...context, unit: "vibe/1/1"})).toBeUndefined();
      expect(normalizeRequestContext({...context, unit: "a".repeat(41)})).toBeUndefined();
    });

    test("drops ordinals that are not small whole numbers", () => {
      expect(normalizeRequestContext({...context, problem: "1.1"})).toBeUndefined();
      expect(normalizeRequestContext({...context, problem: "-1"})).toBeUndefined();
      expect(normalizeRequestContext({...context, investigation: "1e3"})).toBeUndefined();
      expect(normalizeRequestContext({...context, investigation: "1".repeat(4)})).toBeUndefined();
    });

    // Never matches a stored "1", so the document would sit in a pool of one.
    test("drops ordinals written with a leading zero", () => {
      expect(normalizeRequestContext({...context, problem: "01"})).toBeUndefined();
      expect(normalizeRequestContext({...context, investigation: "00"})).toBeUndefined();
    });

    // The accepted side of each limit: a rule tightened by one would fail here.
    test("keeps ordinals up to three digits", () => {
      expect(normalizeRequestContext({...context, investigation: "10", problem: "999"}))
        .toEqual({...context, investigation: "10", problem: "999"});
    });

    test("keeps a unit code and an offeringId at the length limit", () => {
      const unit = "u".repeat(40);
      const offeringId = "9".repeat(100);
      expect(normalizeRequestContext({...context, unit, offeringId})).toEqual({...context, unit, offeringId});
    });

    // Zero is a real investigation: vibe, mods and sas all have a 0.1.
    test("keeps an investigation ordinal of zero", () => {
      expect(normalizeRequestContext({...context, investigation: "0"}))
        .toEqual({...context, investigation: "0"});
    });

    // Problems are numbered from 1, so 0 is the app's unresolved placeholder. The client refuses
    // to send it; a hand-authored request is refused here.
    test("drops a problem ordinal of zero", () => {
      expect(normalizeRequestContext({...context, problem: "0"})).toBeUndefined();
    });

    // Long enough to push the queue record past what Firestore will store, failing the write.
    test("replaces an oversized offeringId with an empty string", () => {
      expect(normalizeRequestContext({...context, offeringId: "9".repeat(101)}))
        .toEqual({...context, offeringId: ""});
    });

    test("replaces an offeringId that is not a string with an empty string", () => {
      expect(normalizeRequestContext({...context, offeringId: 2001})).toEqual({...context, offeringId: ""});
      expect(normalizeRequestContext({...context, offeringId: undefined})).toEqual({...context, offeringId: ""});
    });

    test("returns nothing when there is no context object", () => {
      expect(normalizeRequestContext(undefined)).toBeUndefined();
      expect(normalizeRequestContext(null)).toBeUndefined();
      expect(normalizeRequestContext("vibe/1/2")).toBeUndefined();
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
