/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import {initialize, projectConfig} from "./initialize";
import {
  analysisSettingsPath, clueIframeURL, fallbackClueUnit, generateHtml, onAnalysisDocumentPending,
  renderUnitFor,
} from "../src/on-analysis-document-pending";
import * as classifier from "../../shared/ai-analysis-classify";
import * as summarizer from "../../shared/ai-summarizer/ai-summarizer";

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

// A Drawing tile holding two shapes and no text objects: something only a picture can carry.
const drawingTile = {
  id: "drawing-1",
  title: "Drawing 1",
  content: {
    type: "Drawing",
    objects: [
      {type: "rectangle", x: 10, y: 10, width: 40, height: 20, fill: "#888", stroke: "#000",
        strokeDashArray: "", strokeWidth: 1},
      {type: "ellipse", x: 80, y: 40, rx: 20, ry: 10, fill: "#ccc", stroke: "#000",
        strokeDashArray: "", strokeWidth: 1},
    ],
  },
};

// Builds a document out of the tiles given, one tile per row.
function docOf(...tiles: Record<string, any>[]) {
  const rowMap: Record<string, unknown> = {};
  const rowOrder: string[] = [];
  const tileMap: Record<string, unknown> = {};
  tiles.forEach((tile, index) => {
    const rowId = `row-${index + 1}`;
    rowOrder.push(rowId);
    rowMap[rowId] = {id: rowId, isSectionHeader: false, tiles: [{tileId: tile.id}]};
    tileMap[tile.id] = tile;
  });
  return JSON.stringify({rowMap, rowOrder, tileMap, sharedModelMap: {}, annotations: {}});
}

const sampleTile = JSON.parse(sampleDoc).tileMap["3EkhEN1cWCZ6SQ9X"];

// One Drawing tile with no text: visual-only.
const drawingDoc = docOf(drawingTile);
// A Text tile with content and a Drawing tile without: mixed.
const mixedDoc = docOf(sampleTile, drawingTile);
// A Drawing tile with nothing in it: a full-fidelity handler with nothing to describe.
const emptyDrawingDoc = docOf({...drawingTile, content: {...drawingTile.content, objects: []}});

// A Question whose authored prompt is an Image, answered with text. The prompt contributes nothing
// a summary can carry, so the screenshot is the only way the model sees the question.
function imagePromptQuestionDoc(withResponse: boolean) {
  const questionRows: Record<string, unknown> = {
    "q-row-1": {id: "q-row-1", tiles: [{tileId: "prompt-image"}]},
  };
  const rowOrder = ["q-row-1"];
  const tileMap: Record<string, unknown> = {
    "q1": {
      id: "q1",
      content: {type: "Question", questionId: "Q-1", rowOrder, rowMap: questionRows},
    },
    "prompt-image": {id: "prompt-image", content: {type: "Image", url: "hinge-photo.png"}},
  };
  if (withResponse) {
    rowOrder.push("q-row-2");
    questionRows["q-row-2"] = {id: "q-row-2", tiles: [{tileId: "answer"}]};
    tileMap.answer = {
      id: "answer",
      content: {type: "Text", format: "markdown", text: "Because it is stiff"},
    };
  }
  return JSON.stringify({
    rowMap: {"row-1": {id: "row-1", isSectionHeader: false, tiles: [{tileId: "q1"}]}},
    rowOrder: ["row-1"],
    tileMap,
    sharedModelMap: {},
    annotations: {},
  });
}

// A Text tile whose text is empty: nothing to evaluate.
const emptyDoc = docOf({
  ...sampleTile,
  content: {...sampleTile.content, text: JSON.stringify(
    {object: "value", document: {children: [{type: "paragraph", children: [{text: "   "}]}]}}),
  },
});

const kDocumentRoot = "demo/AI/portals/demo/classes/democlass1/users/1";
const kImageUrl = "https://shutterbug.example/testdoc.png";

// A Shutterbug reply that a well-behaved service would send.
function shutterbugOk(url = kImageUrl) {
  return {ok: true, status: 200, statusText: "OK", json: async () => ({url})} as Response;
}

// Stands in for the Shutterbug service. Pass a Response-like object to answer with, or an Error
// to fail with. `postedPage` reads back the render page that was posted.
function stubShutterbug(answer: Response | Error) {
  const spy = jest.spyOn(global, "fetch");
  if (answer instanceof Error) spy.mockRejectedValue(answer);
  else spy.mockResolvedValue(answer);
  return {
    spy,
    postedPage: () => JSON.parse(spy.mock.calls[0][1]?.body as string).content as string,
    postedRequest: () => JSON.parse(spy.mock.calls[0][1]?.body as string),
  };
}

// Stands for a document with no Firestore metadata document at all, which is different from one
// whose metadata exists and has no usable unit. A symbol rather than undefined, which would just
// select the default below.
const kNoMetadata = Symbol("no metadata document");

// Puts the document in the realtime database and its unit in the Firestore metadata. `null` writes
// a metadata document whose unit is null, which is how Firestore sometimes holds it.
async function givenDocument(
  docId: string, content: string, unit: string | null | typeof kNoMetadata = "vibe"
) {
  await getDatabase().ref(`${kDocumentRoot}/documents/${docId}`).set({content});
  if (unit !== kNoMetadata) {
    await admin.firestore().doc(`demo/AI/documents/${docId}`).set({unit});
  }
}

// Runs the function over a pending-queue entry for the document.
async function runPending(docId: string, overrides: Record<string, unknown> = {}) {
  const wrapped = fft.wrap(onAnalysisDocumentPending);
  const entry = {
    metadataPath: `${kDocumentRoot}/documentMetadata/${docId}`,
    documentPath: `${kDocumentRoot}/documents/${docId}`,
    commentsPath: `demo/AI/documents/${docId}/comments`,
    firestoreDocumentPath: `demo/AI/documents/${docId}`,
    docUpdated: "1001",
    evaluator: "categorize-design",
    ...overrides,
  };
  // Firestore cannot encode undefined, so an override of undefined drops the field instead.
  for (const [key, value] of Object.entries(entry)) {
    if (value === undefined) delete (entry as Record<string, unknown>)[key];
  }
  await wrapped({
    data: makeDocumentSnapshot(entry, `analysis/queue/pending/${docId}`),
    params: {docId},
    document: `analysis/queue/pending/${docId}`,
  });
}

const queue = (status: string) => admin.firestore().collection(`analysis/queue/${status}`);
const countIn = (status: string) =>
  queue(status).count().get().then((result) => result.data().count);
const imagedRecord = (docId: string) =>
  admin.firestore().doc(`analysis/queue/imaged/${docId}`).get().then((doc) => doc.data());
const failedRecord = () =>
  queue("failedImaging").get().then((snapshot) => snapshot.docs[0]?.data());

// The rule that makes the queue countable: a representation is either sent, left out by decision,
// or failed — never two of those at once, and never annotated when it was sent.
function expectReasonsAreExclusive(record: any) {
  for (const kind of ["summary", "image"] as const) {
    const omitted = record[`${kind}OmittedReason`];
    const failed = record[`${kind}Error`];
    if (record[kind === "summary" ? "sendSummary" : "sendImage"]) {
      expect(omitted).toBeUndefined();
      expect(failed).toBeUndefined();
    } else {
      expect([omitted, failed].filter((value) => value !== undefined)).toHaveLength(1);
    }
  }
}

// The live service is exercised by hand, not on every run: it is slow, it depends on a third party
// being up, and it posts a document off this machine. Set LIVE_SHUTTERBUG=1 to include it.
const liveTest = process.env.LIVE_SHUTTERBUG === "1" ? test : test.skip;

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
    // The mocked logger records calls for the whole file, so each test starts with its own.
    jest.clearAllMocks();
  });

  describe("onAnalysisDocumentPending", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    liveTest("sends a real document to the real Shutterbug service", async () => {
      // Mixed, so a screenshot is actually called for: a text-only document is not rendered at all.
      await givenDocument("testdoc1", mixedDoc, kNoMetadata);

      await runPending("testdoc1", {firestoreDocumentPath: undefined});

      expect(await countIn("pending")).toEqual(0);
      expect(await countIn("failedImaging")).toEqual(0);
      expect(await imagedRecord("testdoc1")).toMatchObject({
        docImageUrl: expect.stringContaining("shutterbug"),
        sendImage: true,
      });
    }, 30000);

    describe("what it produces", () => {
      test("a mixed document gets both a summary and a screenshot", async () => {
        await givenDocument("mixed1", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("mixed1");

        const record = await imagedRecord("mixed1");
        expect(record).toMatchObject({
          analysisVersion: 2,
          sendSummary: true,
          sendImage: true,
          docImageUrl: kImageUrl,
          classification: {
            modality: "mixed", hasStudentText: true, summaryCarriesStudentWork: true,
            needsImage: true, promptNeedsImage: false,
          },
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
          summarizer: "image",
        });
        expect(record?.docSummary).toEqual(expect.any(String));
        expectReasonsAreExclusive(record);

        // The page posted is the released build, rendered with the document's own unit.
        expect(shutterbug.postedPage()).toContain(`${clueIframeURL}?unit=vibe&amp;`);
        expect(shutterbug.postedRequest()).toEqual({content: expect.any(String), height: 1500});
      });

      test("a text-only document is not screenshotted", async () => {
        await givenDocument("text1", sampleDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("text1");

        const record = await imagedRecord("text1");
        expect(record).toMatchObject({
          sendSummary: true,
          sendImage: false,
          imageOmittedReason: "no-visual-content",
          classification: {
            modality: "text-only", hasStudentText: true, summaryCarriesStudentWork: true,
            needsImage: false, promptNeedsImage: false,
          },
          summarizer: "text",
        });
        expect(record?.docImageUrl).toBeUndefined();
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expectReasonsAreExclusive(record);
      });

      test("a drawing-only document sends its summary as well as its picture", async () => {
        // The drawing carries no text, so this used to go image-only. Its summary is now a table of
        // the objects the student drew, which is student work, so both halves go.
        await givenDocument("draw1", drawingDoc);
        stubShutterbug(shutterbugOk());

        await runPending("draw1");

        const record = await imagedRecord("draw1");
        expect(record).toMatchObject({
          sendSummary: true,
          sendImage: true,
          docImageUrl: kImageUrl,
          // Modality still groups it as visual-only and it still holds no student-authored text.
          // The record says which of those the send decision was made from.
          classification: {
            modality: "visual-only", hasStudentText: false, summaryCarriesStudentWork: true,
            needsImage: true, promptNeedsImage: false,
          },
          summarizer: "image",
        });
        expect(record?.docSummary).toEqual(expect.any(String));
        expect(record?.summaryOmittedReason).toBeUndefined();
        expectReasonsAreExclusive(record);
      });

      test("a drawing with no objects has nothing worth summarizing", async () => {
        // A full-fidelity handler with nothing to describe. The summary would say only that a
        // drawing tile is there, so it is produced, stored and withheld.
        await givenDocument("emptydraw1", emptyDrawingDoc);
        stubShutterbug(shutterbugOk());

        await runPending("emptydraw1");

        const record = await imagedRecord("emptydraw1");
        expect(record).toMatchObject({
          sendSummary: false,
          summaryOmittedReason: "no-student-work-in-summary",
          sendImage: true,
          summarizer: "image",
        });
        expect(record?.docSummary).toEqual(expect.any(String));
        expectReasonsAreExclusive(record);
      });

      test("an empty document is not evaluated and is not summarized", async () => {
        await givenDocument("empty1", emptyDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("empty1");

        expect(await countIn("imaged")).toEqual(0);
        expect(await countIn("pending")).toEqual(0);
        expect(shutterbug.spy).not.toHaveBeenCalled();
        const failed = await failedRecord();
        expect(failed?.error).toEqual("document has no student content");
        // The record still says what was worked out before the document was turned away.
        expect(failed).toMatchObject({
          analysisVersion: 2,
          classification: {
            modality: "empty", hasStudentText: false, summaryCarriesStudentWork: false,
            needsImage: false, promptNeedsImage: false,
          },
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
        });
        expect(failed?.docSummary).toBeUndefined();
      });

      test("a document with no metadata document renders with the fallback unit", async () => {
        await givenDocument("nounit1", mixedDoc, kNoMetadata);
        stubShutterbug(shutterbugOk());

        await runPending("nounit1");

        expect(await imagedRecord("nounit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: fallbackClueUnit},
        });
        expect(logger.warn).toHaveBeenCalledWith(
          `Document unit undefined is not usable for rendering, using "${fallbackClueUnit}"`);
      });

      test("a metadata unit of null renders with the fallback unit", async () => {
        // Distinct from the case above: the metadata document is there, and its unit is null, which
        // is how Firestore sometimes holds it.
        await givenDocument("nullunit1", mixedDoc, null);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("nullunit1");

        expect(await imagedRecord("nullunit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: fallbackClueUnit},
        });
        expect(logger.warn).toHaveBeenCalledWith(
          `Document unit null is not usable for rendering, using "${fallbackClueUnit}"`);
        // The render was posted with the fallback unit, not the null one.
        expect(shutterbug.postedPage()).toContain(`?unit=${fallbackClueUnit}&amp;unwrapped&amp;readOnly"`);
      });

      test("a question whose prompt is a picture is screenshotted for the answer's sake", async () => {
        // Nothing student-authored needs a picture here — the answer is text. Without the
        // screenshot the model would judge "Because it is stiff" against an empty prompt, because
        // an Image tile's summary carries nothing.
        await givenDocument("imgq1", imagePromptQuestionDoc(true));
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("imgq1");

        const record = await imagedRecord("imgq1");
        expect(record).toMatchObject({
          sendSummary: true,
          sendImage: true,
          docImageUrl: kImageUrl,
          summarizer: "image",
          classification: {
            modality: "text-only", hasStudentText: true, summaryCarriesStudentWork: true,
            needsImage: false, promptNeedsImage: true,
          },
        });
        expect(shutterbug.spy).toHaveBeenCalledTimes(1);
        expectReasonsAreExclusive(record);
      });

      test("a picture prompt with no answer is still an empty document", async () => {
        // A picture of the question is context for student work, never a substitute for it.
        await givenDocument("imgq2", imagePromptQuestionDoc(false));
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("imgq2");

        expect(await countIn("imaged")).toEqual(0);
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expect((await failedRecord())?.error).toEqual("document has no student content");
      });

      test("the mock evaluator produces nothing at all", async () => {
        await givenDocument("mock1", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("mock1", {evaluator: "mock"});

        expect(await imagedRecord("mock1")).toEqual({
          metadataPath: `${kDocumentRoot}/documentMetadata/mock1`,
          documentPath: `${kDocumentRoot}/documents/mock1`,
          commentsPath: "demo/AI/documents/mock1/comments",
          firestoreDocumentPath: "demo/AI/documents/mock1",
          docUpdated: "1001",
          evaluator: "mock",
          analysisVersion: 2,
          sendSummary: false,
          sendImage: false,
        });
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expect(await countIn("failedImaging")).toEqual(0);
      });
    });

    describe("when Shutterbug fails", () => {
      // Every case here answers the same question: does the evaluation still happen on whatever
      // else the document has? A screenshot that cannot be taken is not a failed analysis.
      const shutterbugFailures: [string, Response | Error, string][] = [
        ["a non-2xx status", {ok: false, status: 503, statusText: "Service Unavailable"} as Response, "503"],
        ["a body that is not JSON",
          {ok: true, status: 200, json: async () => {
            throw new SyntaxError("Unexpected token < in JSON");
          }} as unknown as Response, "not JSON"],
        ["no url in the reply", {ok: true, status: 200, json: async () => ({url: null})} as unknown as Response,
          "no image URL"],
        ["a plaintext url", {ok: true, status: 200, json: async () => ({url: "http://insecure.example/x.png"})} as unknown as Response,
          "non-https"],
        ["a request that times out", Object.assign(new Error("aborted"), {name: "TimeoutError"}), "did not answer within"],
      ];

      test.each(shutterbugFailures)(
        "%s leaves a mixed document with its summary", async (_name, answer, expected) => {
          await givenDocument("mixed2", mixedDoc);
          stubShutterbug(answer);

          await runPending("mixed2");

          const record = await imagedRecord("mixed2");
          expect(record).toMatchObject({sendSummary: true, sendImage: false, summarizer: "text"});
          expect(record?.imageError).toContain(expected);
          expect(record?.docImageUrl).toBeUndefined();
          expect(await countIn("failedImaging")).toEqual(0);
          expectReasonsAreExclusive(record);
        });

      test("a document with nothing but an empty drawing has nothing left to send", async () => {
        await givenDocument("draw2", emptyDrawingDoc);
        stubShutterbug(new Error("connection refused"));

        await runPending("draw2");

        expect(await countIn("imaged")).toEqual(0);
        const failed = await failedRecord();
        // The message names why each half is absent, so the record alone explains the failure.
        expect(failed?.error).toContain("nothing to send");
        expect(failed?.error).toContain("summary: no-student-work-in-summary");
        expect(failed?.error).toContain("image: Shutterbug error");
        expect(failed).toMatchObject({
          analysisVersion: 2,
          classification: {modality: "visual-only"},
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
          summaryOmittedReason: "no-student-work-in-summary",
          docSummary: expect.any(String),
        });
        expect(failed?.imageError).toContain("Shutterbug error");
      });

      test("the request carries an abort signal, so a hung service cannot hang the function", async () => {
        await givenDocument("mixed3", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("mixed3");

        expect(shutterbug.spy.mock.calls[0][1]?.signal).toBeDefined();
      });
    });

    describe("the screenshot switch", () => {
      test("images-disabled stops the screenshot and keeps the summary", async () => {
        await admin.firestore().doc(analysisSettingsPath).set({imagesEnabled: false});
        await givenDocument("mixed4", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("mixed4");

        const record = await imagedRecord("mixed4");
        expect(record).toMatchObject({
          sendSummary: true,
          sendImage: false,
          imageOmittedReason: "images-disabled",
          summarizer: "text",
        });
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expectReasonsAreExclusive(record);
      });

      test("a settings document that cannot be read does not cost the summary", async () => {
        // Firestore blips must not turn a readable document into a failed analysis. The switch
        // only ever turns screenshots off, so an unreadable setting is treated as an absent one.
        await givenDocument("mixed7", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());
        const realDoc = admin.firestore().doc.bind(admin.firestore());
        jest.spyOn(admin.firestore(), "doc").mockImplementation((path: string) =>
          path === analysisSettingsPath ?
            ({get: async () => {
              throw new Error("settings unavailable");
            }} as any) :
            realDoc(path));

        await runPending("mixed7");

        const record = await imagedRecord("mixed7");
        expect(record).toMatchObject({sendSummary: true, sendImage: true});
        expect(shutterbug.spy).toHaveBeenCalledTimes(1);
        expect(await countIn("failedImaging")).toEqual(0);
      });

      test("a text-only document never reads the switch at all", async () => {
        await admin.firestore().doc(analysisSettingsPath).set({imagesEnabled: false});
        await givenDocument("text2", sampleDoc);
        const settingsReads = jest.spyOn(admin.firestore(), "doc");

        await runPending("text2");

        expect(settingsReads.mock.calls.map((call) => call[0]))
          .not.toContain(analysisSettingsPath);
        expect(await imagedRecord("text2")).toMatchObject({
          sendSummary: true, sendImage: false, imageOmittedReason: "no-visual-content",
        });
      });

      test("a missing settings document means screenshots proceed", async () => {
        await givenDocument("mixed5", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("mixed5");

        expect(await imagedRecord("mixed5")).toMatchObject({sendImage: true});
        expect(shutterbug.spy).toHaveBeenCalledTimes(1);
      });

      test("an empty drawing has nothing to send while the switch is off", async () => {
        await admin.firestore().doc(analysisSettingsPath).set({imagesEnabled: false});
        await givenDocument("draw3", emptyDrawingDoc);

        await runPending("draw3");

        const failed = await failedRecord();
        expect(failed?.error).toContain("summary: no-student-work-in-summary");
        expect(failed?.error).toContain("image: images-disabled");
      });
    });

    describe("the error boundary", () => {
      test("content that is not JSON is named as such", async () => {
        await givenDocument("bad1", "this is not JSON");

        await runPending("bad1");

        expect(await countIn("pending")).toEqual(0);
        expect(await countIn("imaged")).toEqual(0);
        expect((await failedRecord())?.error).toContain("invalid document JSON");
      });

      test("a throw from the classifier is caught and recorded", async () => {
        await givenDocument("boom1", mixedDoc);
        jest.spyOn(classifier, "classifyDocument").mockImplementation(() => {
          throw new Error("classifier exploded");
        });

        await runPending("boom1");

        expect(await countIn("pending")).toEqual(0);
        expect(await countIn("imaged")).toEqual(0);
        const failed = await failedRecord();
        expect(failed?.error).toContain("unhandled:");
        expect(failed?.error).toContain("classifier exploded");
        // Worked out before the throw, so the record still says what was rendered against.
        expect(failed).toMatchObject({renderTarget: {clueUrl: clueIframeURL, unit: "vibe"}});
      });

      test("a summarizer that throws does not stop the screenshot", async () => {
        await givenDocument("mixed6", mixedDoc);
        stubShutterbug(shutterbugOk());
        jest.spyOn(summarizer, "documentSummarizer").mockImplementation(() => {
          throw new Error("summarizer exploded");
        });

        await runPending("mixed6");

        const record = await imagedRecord("mixed6");
        expect(record).toMatchObject({sendSummary: false, sendImage: true, summarizer: "image"});
        expect(record?.summaryError).toContain("summarizer exploded");
        expect(record?.docSummary).toBeUndefined();
        expectReasonsAreExclusive(record);
      });
    });

    test("does not process doc with unknown evaluator", async () => {
      await runPending("testdoc1", {evaluator: "does-not-exist", firestoreDocumentPath: undefined});

      expect(logger.warn).toHaveBeenCalledWith(
        "Error processing document", "analysis/queue/pending/testdoc1",
        "Unexpected value for evaluator: does-not-exist");

      expect(await countIn("pending")).toEqual(0);
      expect(await countIn("imaged")).toEqual(0);
      expect(await countIn("done")).toEqual(0);
      expect(await countIn("failedAnalyzing")).toEqual(0);
      expect(await countIn("failedImaging")).toEqual(1);
      expect(await failedRecord()).toMatchObject({
        documentId: "testdoc1",
        evaluator: "does-not-exist",
        error: "Unexpected value for evaluator: does-not-exist",
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
