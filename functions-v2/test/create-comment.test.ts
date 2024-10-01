import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {Firestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";

import {initialize, projectConfig} from "./initialize";
import {onAnalysisImageReady} from "../src/on-analysis-image-ready";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();


let firestore: Firestore;

describe("functions", () => {
  beforeEach(async () => {
    firestore = admin.firestore();
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onProcessingQueueWritten", () => {
    test("does nothing when queued document is not yet imaged", async () => {
      const wrapped = fft.wrap(onAnalysisImageReady);

      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue/testdoc1").set({
        metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
        updated: "1001",
        status: "updated",
      });

      const event = {
        params: {
          docId: "testdoc1",
        },
      };

      await wrapped(event);
      expect(logger.info).not.toHaveBeenCalled();
      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue").once("value", (snapshot) => {
        expect(snapshot.val()).toEqual({
          testdoc1: {
            metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
            updated: "1001",
            status: "updated",
          },
        });
      });
    });

    test("creates comment when queued document is imaged", async () => {
      const wrapped = fft.wrap(onAnalysisImageReady);

      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue/testdoc1").set({
        metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
        updated: "1001",
        status: "imaged",
      });

      const event = {
        params: {
          docId: "testdoc1",
        },
      };

      await wrapped(event);

      expect(logger.info)
        .toHaveBeenLastCalledWith("Creating comment for",
          "demo/AI/portals/demo/aiProcessingQueue/testdoc1");

      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue").once("value", (snapshot) => {
        const queue = snapshot.val();
        expect(Object.keys(queue)).toHaveLength(1);
        expect(queue).toEqual({
          testdoc1: {
            metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
            updated: "1001",
            status: "done",
          },
        });
      });

      firestore.collection("demo/AI/documents/testdoc1/comments").get().then((snapshot) => {
        expect(snapshot.size).toBe(1);
        const comment = snapshot.docs[0].data();
        expect(comment).toEqual({
          content: "The document mentions a 'Water Saving Idea' and refers specifically to a 'rain barrel', " +
            "indicating a focus on the functionality of the design in terms of saving water. " +
            "Key Indicators: Water Saving Idea, rain barrel",
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("updates comment when queued document is imaged again", async () => {
      const wrapped = fft.wrap(onAnalysisImageReady);

      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue/testdoc1").set({
        metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
        updated: "1001",
        status: "imaged",
      });

      await firestore.collection("demo/AI/documents/testdoc1/comments").add({
        content: "Old comment",
        createdAt: 1,
        name: "Ada Insight",
        uid: "ada_insight_1",
      });
      await firestore.collection("demo/AI/documents/testdoc1/comments").get().then((snapshot) => {
        expect(snapshot.size).toBe(1);
      });

      const event = {
        params: {
          docId: "testdoc1",
        },
      };

      await wrapped(event);

      expect(logger.info)
        .toHaveBeenLastCalledWith("Updating existing comment for",
          "demo/AI/portals/demo/aiProcessingQueue/testdoc1");

      await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue").once("value", (snapshot) => {
        const queue = snapshot.val();
        expect(Object.keys(queue)).toHaveLength(1);
        expect(queue).toEqual({
          testdoc1: {
            metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
            updated: "1001",
            status: "done",
          },
        });
      });

      await firestore.collection("demo/AI/documents/testdoc1/comments").get().then((snapshot) => {
        expect(snapshot.size).toBe(1);
        const comment = snapshot.docs[0].data();
        expect(comment).toEqual({
          content: "The document mentions a 'Water Saving Idea' and refers specifically to a 'rain barrel', " +
            "indicating a focus on the functionality of the design in terms of saving water. " +
            "Key Indicators: Water Saving Idea, rain barrel",
          tags: ["function"],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
        expect(comment.createdAt).not.toEqual(1);
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
