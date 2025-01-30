import * as admin from "firebase-admin";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {onDocumentTagged} from "../src/on-document-tagged";
import {initialize, projectConfig} from "./initialize";

type CollectionRef = admin.firestore.CollectionReference<admin.firestore.DocumentData, admin.firestore.DocumentData>;

const {fft, cleanup} = initialize();

describe("onDocumentTagged", () => {
  let documentCollection: CollectionRef;

  beforeEach(async () => {
    // The three lines below seemed to help prevent an "open handle" warning after the tests ran. They don't
    // actually solve the problem of Jest not exiting cleanly, but they do suppress the warning and so may be
    // helpful in further attempts to fix the problem.
    // const documents = await admin.firestore().collection("demo/test/documents").listDocuments();
    // const deletePromises = documents.map((doc) => doc.delete());
    // await Promise.all(deletePromises);

    await clearFirestoreData(projectConfig);

    documentCollection = admin.firestore().collection("demo/test/documents");
    await documentCollection.doc("1234").set({
      key: "doc-key",
      strategies: [],
    });
  });

  test("should add new values to a document's strategies array when a new comment is made", async () => {
    const wrapped = fft.wrap(onDocumentTagged);
    const commentRef = documentCollection.doc("1234").collection("comments").doc("5678");

    await commentRef.set({tags: ["tag1", "tag2"]});
    const event = {
      params: {
        root: "demo",
        space: "test",
        documentId: "1234",
        commentId: "5678",
      },
    };
    await wrapped(event);

    const docSnapshot = await documentCollection.doc("1234").get();
    const docData = docSnapshot.data();

    expect(docData).toEqual({
      key: "doc-key",
      strategies: ["tag1", "tag2"],
    });
  });

  // Currently, the AI system writes to a comments collection under an empty document whose ID is the same as the
  // document key. This test should be removed (or updated) when the AI system is modified to write to a comments
  // collection under a complete metadata document like comments from human users are.
  test("should add new values when a new AI-generated comment is made", async () => {
    const wrapped = fft.wrap(onDocumentTagged);
    const commentRef = documentCollection.doc("doc-key").collection("comments").doc("ai-comment-1");

    await commentRef.set({tags: ["ai-tag-1", "ai-tag-2"]});
    const event = {
      params: {
        root: "demo",
        space: "test",
        documentId: "doc-key",
        commentId: "ai-comment-1",
      },
    };
    await wrapped(event);

    const docSnapshot = await documentCollection.doc("1234").get();
    const docData = docSnapshot.data();

    expect(docData).toEqual({
      key: "doc-key",
      strategies: ["ai-tag-1", "ai-tag-2"],
    });
  });

  test("should remove values from a document's strategies array when an existing comment is deleted", async () => {
    const wrapped = fft.wrap(onDocumentTagged);
    const commentRef1 = documentCollection.doc("1234").collection("comments").doc("5678");
    const commentRef2 = documentCollection.doc("1234").collection("comments").doc("9012");

    // Add a comment with one tag.
    await commentRef1.set({tags: ["tag5"]});
    const event1 = {
      params: {
        root: "demo",
        space: "test",
        documentId: "1234",
        commentId: "5678",
      },
    };
    await wrapped(event1);

    let docSnapshot = await documentCollection.doc("1234").get();
    let docData = docSnapshot.data();
    expect(docData).toEqual({
      key: "doc-key",
      strategies: ["tag5"],
    });

    // Add a second comment with one redundant tag and one new tag.
    await commentRef2.set({tags: ["tag5", "tag6"]});
    const event2 = {
      params: {
        root: "demo",
        space: "test",
        documentId: "1234",
        commentId: "9012",
      },
    };
    await wrapped(event2);

    docSnapshot = await documentCollection.doc("1234").get();
    docData = docSnapshot.data();
    expect(docData).toEqual({
      key: "doc-key",
      strategies: ["tag5", "tag6"],
    });

    // Delete the second comment.
    await commentRef2.delete();
    const event3 = {
      params: {
        root: "demo",
        space: "test",
        documentId: "1234",
        commentId: "9012",
      },
    };
    await wrapped(event3);

    // Verify that only the redundant tag remains in the strategies array.
    docSnapshot = await documentCollection.doc("1234").get();
    docData = docSnapshot.data();

    expect(docData).toEqual({
      key: "doc-key",
      strategies: ["tag5"],
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
