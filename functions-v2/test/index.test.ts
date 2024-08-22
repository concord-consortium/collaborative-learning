import initializeFFT from "firebase-functions-test";
import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// We cannot import the function here because we need to call
// initializeFFT first in order to set things up before the
// initializeApp is called in the function module.
// import {updateClassDocNetworksOnUserChange} from "../src";

jest.mock("firebase-functions/logger");

process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8088";
const projectConfig = {projectId: "demo-test"};
const fft = initializeFFT(projectConfig);

// We can't initialize the firebase admin here because that
// can only happen once and the function module needs to do it.
// admin.initializeApp(projectConfig);

type CollectionRef = admin.firestore.CollectionReference<
  admin.firestore.DocumentData, admin.firestore.DocumentData
>;

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
  });

  describe("updateClassDocNetworksOnUserChange", () => {
    let classesCollection: CollectionRef;
    let usersCollection: CollectionRef;

    function init() {
      classesCollection = admin.firestore().collection("demo/test/classes");
      usersCollection = admin.firestore().collection("demo/test/users");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function writeClassDocs(classDocs: any[]) {
      return Promise.all(classDocs.map((classDoc) => {
        return classesCollection
          .doc(classDoc.context_id)
          .set(classDoc);
      }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function writeUserDocs(userDocs: any[]) {
      return Promise.all(userDocs.map((userDoc) => {
        return usersCollection
          .doc(userDoc.uid)
          .set(userDoc);
      }));
    }


    test("add new network", async () => {
      // The function module has to be imported after initializeFFT is called.
      // The initializeFFT sets up environment vars so the
      // admin.initializeApp() in index.ts will have the same project
      // settings.
      const {updateClassDocNetworksOnUserChange} = await import("../src");

      // We can't use beforeEach because this needs to happen after the import.
      // And we can't put the import in beforeEach because it would be hard to
      // get the imported function typed properly.
      init();
      const wrapped = fft.wrap(updateClassDocNetworksOnUserChange);

      const event = {
        params: {
          root: "demo",
          space: "test",
          userId: "1234",
        },
      };

      await writeClassDocs([
        {
          context_id: "testclass-1",
          id: "1",
          teachers: ["1234"],
          uri: "https://example.concord.org/classes/1",
        },
        {
          context_id: "testclass-2",
          id: "2",
          teachers: ["1235"],
          uri: "https://example.concord.org/classes/2",
        },
        {
          context_id: "testclass-3",
          id: "2",
          networks: ["other-network"],
          teachers: ["1234", "1236"],
          uri: "https://example.concord.org/classes/2",
        },
      ]);

      await writeUserDocs([
        {
          uid: "1236",
          type: "teacher",
          networks: ["other-network"],
        },
        {
          uid: "1234",
          type: "teacher",
          networks: ["test-network"],
        },
      ]);

      await wrapped(event);

      expect(logger.info)
        .toHaveBeenCalledWith("User updated", "demo/test/users/1234" );

      const classDocsResult = await classesCollection.get();
      const classDocs = classDocsResult.docs.map((doc) => doc.data());
      expect(classDocs).toEqual([
        {
          context_id: "testclass-1",
          id: "1",
          networks: ["test-network"],
          teachers: ["1234"],
          uri: "https://example.concord.org/classes/1",
        },
        {
          context_id: "testclass-2",
          id: "2",
          teachers: ["1235"],
          uri: "https://example.concord.org/classes/2",
        },
        {
          context_id: "testclass-3",
          id: "2",
          networks: ["other-network", "test-network"],
          teachers: ["1234", "1236"],
          uri: "https://example.concord.org/classes/2",
        },
      ]);
    });

    test("remove network", async () => {
      const {updateClassDocNetworksOnUserChange} = await import("../src");
      init();
      const wrapped = fft.wrap(updateClassDocNetworksOnUserChange);

      const event = {
        params: {
          root: "demo",
          space: "test",
          userId: "1234",
        },
      };

      await writeClassDocs([
        {
          context_id: "testclass-1",
          id: "1",
          networks: ["test-network"],
          teachers: ["1234"],
          uri: "https://example.concord.org/classes/1",
        },
        {
          context_id: "testclass-2",
          id: "2",
          teachers: ["1235"],
          uri: "https://example.concord.org/classes/2",
        },
        {
          context_id: "testclass-3",
          id: "2",
          networks: ["other-network", "test-network"],
          teachers: ["1234", "1236"],
          uri: "https://example.concord.org/classes/2",
        },
      ]);

      await writeUserDocs([
        {
          uid: "1234",
          type: "teacher",
        },
        {
          uid: "1236",
          type: "teacher",
          networks: ["other-network"],
        },
      ]);

      await wrapped(event);

      expect(logger.info)
        .toHaveBeenCalledWith("User updated", "demo/test/users/1234" );

      const classDocsResult = await classesCollection.get();
      const classDocs = classDocsResult.docs.map((doc) => doc.data());
      expect(classDocs).toEqual([
        {
          context_id: "testclass-1",
          id: "1",
          networks: [],
          teachers: ["1234"],
          uri: "https://example.concord.org/classes/1",
        },
        {
          context_id: "testclass-2",
          id: "2",
          teachers: ["1235"],
          uri: "https://example.concord.org/classes/2",
        },
        {
          context_id: "testclass-3",
          id: "2",
          networks: ["other-network"],
          teachers: ["1234", "1236"],
          uri: "https://example.concord.org/classes/2",
        },
      ]);
    });
  });
});
