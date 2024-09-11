import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {initialize, projectConfig} from "./initialize";
import {onUserDocWritten} from "../src/on-user-doc-written";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

type CollectionRef = admin.firestore.CollectionReference<
  admin.firestore.DocumentData, admin.firestore.DocumentData
>;

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
  });

  describe("onUserDocWritten", () => {
    let classesCollection: CollectionRef;
    let usersCollection: CollectionRef;

    beforeEach(() => {
      classesCollection = admin.firestore().collection("demo/test/classes");
      usersCollection = admin.firestore().collection("demo/test/users");
    });

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
      const wrapped = fft.wrap(onUserDocWritten);

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
      const wrapped = fft.wrap(onUserDocWritten);

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

    // If there is overlap between the networks of the co-teachers then removing
    // a network from one co-teacher might not change the networks of the class
    test("no network change in a class", async () => {
      const wrapped = fft.wrap(onUserDocWritten);

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
          networks: ["other-network", "test-network"],
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
          networks: ["other-network", "test-network"],
          teachers: ["1234", "1236"],
          uri: "https://example.concord.org/classes/2",
        },
      ]);
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
