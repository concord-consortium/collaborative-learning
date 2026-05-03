import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {initialize, projectConfig} from "./initialize";
import {generateClassData} from "../src/generate-class-data";
import {
  authWithNoClaims,
  authWithTeacherClaims,
  kCanonicalPortal,
  kClassHash,
  kDemoName,
  kPortal,
  setupTestDocuments,
  specUserContext,
} from "./test-utils";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("generateClassData", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  test("warm-up returns version", async () => {
    const wrapped = fft.wrap(generateClassData);
    const result = await wrapped({data: {warmUp: true}} as any);
    expect(result).toEqual({version: "1.0.1"});
  });

  test("writes aicontent into authed realm when context has a stray demoName", async () => {
    // Set up documents in the authed realm only. No data in demo/<demoName>/...
    await setupTestDocuments({portal: kPortal, documentId: "auth-doc-1"});
    await setupTestDocuments({portal: kPortal, documentId: "auth-doc-2", uid: "other-user"});

    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        // authed mode + stray demoName simulates a client that visited a demo
        // URL (which sets clue-demo-name in localStorage) and then logged in
        // through the portal.
        context: specUserContext({
          appMode: "authed",
          portal: kPortal,
          demoName: "ScottGroupDocTests",
        }),
        unit: "qa-config-subtabs",
      },
      auth: authWithTeacherClaims,
    } as any);

    // Aicontent landed in the authed realm — the fix under test.
    const authedDataDocPath =
      `authed/${kCanonicalPortal}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const authedDoc = await getFirestore().doc(authedDataDocPath).get();
    expect(authedDoc.exists).toBe(true);
    expect(authedDoc.data()).toMatchObject({
      userCount: 2,
      documentCount: 2,
    });

    // And nothing leaked into the stray demo realm.
    const demoDataDocPath =
      "demo/ScottGroupDocTests/aicontent/qa-config-subtabs/classes/" + kClassHash;
    const demoDoc = await getFirestore().doc(demoDataDocPath).get();
    expect(demoDoc.exists).toBe(false);
  });

  test("writes placeholder class data doc when authed class has zero documents", async () => {
    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        context: specUserContext({appMode: "authed", portal: kPortal}),
        unit: "qa-config-subtabs",
      },
      auth: authWithTeacherClaims,
    } as any);

    const dataDocPath =
      `authed/${kCanonicalPortal}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toEqual({
      userCount: 0,
      documentCount: 0,
      teacherContent: "",
      studentContent: "",
      summary: null,
      summaryCreatedAt: expect.anything(),
    });
  });

  test("writes aicontent into demo realm for demo-mode callers", async () => {
    await setupTestDocuments({demo: kDemoName, documentId: "demo-doc-1"});
    await setupTestDocuments({demo: kDemoName, documentId: "demo-doc-2", uid: "other-user"});

    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        context: specUserContext({appMode: "demo", demoName: kDemoName}),
        unit: "qa-config-subtabs",
      },
      auth: authWithNoClaims,
    } as any);

    const dataDocPath =
      `demo/${kDemoName}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toMatchObject({
      userCount: 2,
      documentCount: 2,
    });
  });
});
