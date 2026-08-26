/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import {initialize, projectConfig} from "./initialize";
import {
  clueIframeURL, fallbackClueUnit, generateHtml, onAnalysisDocumentPending, renderUnitFor,
} from "../src/on-analysis-document-pending";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

const sampleDoc = `{
  "rowMap": {
    "YCdQvLvVf-rWZHvK": {
      "id": "YCdQvLvVf-rWZHvK",
      "isSectionHeader": false,
      "tiles": [{"tileId": "3EkhEN1cWCZ6SQ9X"}]
    }
  },
  "rowOrder": ["YCdQvLvVf-rWZHvK"],
  "tileMap": {
    "3EkhEN1cWCZ6SQ9X": {
      "id": "3EkhEN1cWCZ6SQ9X",
      "title": "Text 1",
      "content": {
        "type": "Text",
        "text": "{\\"object\\":\\"value\\",\\"document\\":{\\"children\\":[{\\"type\\":\\"paragraph\\",\\"children\\":[{\\"text\\":\\"Text tile. Textile.\\"}]}]}}",
        "format": "slate"
      }
    }
  },
  "sharedModelMap": {},
  "annotations": {}
}`;

// The text a student could type that would end the script element early if it were not escaped.
const scriptBreakout = "</script><img src=x onerror=alert(1)>";

// The sample document with the breakout text typed into its Text tile.
function docWithScriptBreakout() {
  const doc = JSON.parse(sampleDoc);
  doc.tileMap["3EkhEN1cWCZ6SQ9X"].content.text = JSON.stringify({
    object: "value",
    document: {children: [{type: "paragraph", children: [{text: scriptBreakout}]}]},
  });
  return doc;
}

describe("generateHtml", () => {
  test("escapes document content so it cannot break out of the script element", () => {
    const doc = docWithScriptBreakout();
    const html = generateHtml(doc);

    // The page's own two script elements, and no others.
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).not.toContain("<img");

    // The escaped JSON still parses back to the document that was passed in.
    const initialValue = html.match(/const initialValue=(.*)<\/script>/)?.[1];
    expect(JSON.parse(initialValue as string)).toEqual(doc);
  });

  test("escapes the ampersands in the iframe source", () => {
    const html = generateHtml(JSON.parse(sampleDoc));
    expect(html).toMatch(/src="[^"]+\/authoring-iframe\/index\.html\?unit=[^"&]+&amp;unwrapped&amp;readOnly"/);
  });

  test("renders through the released CLUE build, not a branch", () => {
    expect(clueIframeURL).toBe("https://collaborative-learning.concord.org/authoring-iframe/index.html");
    expect(generateHtml(JSON.parse(sampleDoc))).not.toContain("/branch/");
  });

  test("renders with the unit it is given, falling back to the default unit", () => {
    expect(generateHtml(JSON.parse(sampleDoc), "msa")).toContain(`src="${clueIframeURL}?unit=msa&amp;`);
    expect(generateHtml(JSON.parse(sampleDoc))).toContain(`?unit=${fallbackClueUnit}&amp;`);
  });
});

describe("renderUnitFor", () => {
  test("accepts a plain unit code", () => {
    expect(renderUnitFor("msa")).toBe("msa");
    expect(renderUnitFor("s+s")).toBe("s+s");
    expect(renderUnitFor("bio4community")).toBe("bio4community");
  });

  test("falls back to the default unit for anything else", () => {
    expect(renderUnitFor(undefined)).toBe(fallbackClueUnit);
    expect(renderUnitFor(null)).toBe(fallbackClueUnit);
    expect(renderUnitFor("")).toBe(fallbackClueUnit);
    expect(renderUnitFor("https://example.com/content.json")).toBe(fallbackClueUnit);
    expect(renderUnitFor("some/path")).toBe(fallbackClueUnit);
    expect(renderUnitFor(42)).toBe(fallbackClueUnit);
  });
});

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onAnalysisDocumentPending", () => {
    test("runs when queued document is pending", async () => {
      // Set up document with some content to be imaged.
      await getDatabase().ref("demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1").set({
        content: sampleDoc,
      });

      const wrapped = fft.wrap(onAnalysisDocumentPending);

      await wrapped({
        data: makeDocumentSnapshot({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          docUpdated: "1001",
          evaluator: "categorize-design",
        }, "analysis/queue/pending/testdoc1"),
        params: {
          docId: "testdoc1",
        },
        document: "analysis/queue/pending/testdoc1",
      });

      expect(logger.warn).not.toHaveBeenCalled();

      // Document should have been removed from pending queue, and added to "imaged" queue.

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = admin.firestore().collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(1);

      await imagedQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          docUpdated: "1001",
          evaluator: "categorize-design",
          docImaged: expect.any(Object),
          docImageUrl: expect.stringContaining("shutterbug"),
          summarizer: "image",
        });
      });

      const doneQueue = admin.firestore().collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedAnalyzingQueue = admin.firestore().collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedImagingQueue = admin.firestore().collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(0);
    }, 10000);

    test("does not process doc with unknown evaluator", async () => {
      const wrapped = fft.wrap(onAnalysisDocumentPending);

      await wrapped({
        data: makeDocumentSnapshot({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
          commentsPath: "demo/AI/documents/testdoc1/comments",
          docUpdated: "1001",
          evaluator: "does-not-exist",
        }, "analysis/queue/pending/testdoc1"),
        params: {
          docId: "testdoc1",
        },
        document: "analysis/queue/pending/testdoc1",
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Error processing document", "analysis/queue/pending/testdoc1",
        "Unexpected value for evaluator: does-not-exist");

      // Document should have been removed from pending folder, and added to error folder.

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = admin.firestore().collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = admin.firestore().collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedAnalyzingQueue = admin.firestore().collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedImagingQueue = admin.firestore().collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(1);

      await failedImagingQueue.get().then((snapshot) => {
        snapshot.forEach((doc) => {
          expect(doc.data()).toEqual({
            metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
            documentId: "testdoc1",
            docUpdated: "1001",
            evaluator: "does-not-exist",
            error: "Unexpected value for evaluator: does-not-exist",
          });
        });
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
