/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {initialize, projectConfig} from "./initialize";
import {
  analysisSettingsPath, clueIframeURL, fallbackClueUnit, generateHtml, maxImageBytes,
  onAnalysisDocumentPending, readAtMost, renderUnitFor,
} from "../src/on-analysis-document-pending";
import * as classifier from "../../shared/ai-analysis-classify";
import * as summarizer from "../../shared/ai-summarizer/ai-summarizer";
import * as claimRequestIdsModule from "../src/claim-request-ids";
import {kMaxFrameHeightPx} from "../../shared/render-page";
import {pngHeaderBytes} from "../../shared/png-header-test-helpers";
// fetch/Response are ambient globals here, but ReadableStream needs an explicit import.
import {ReadableStream} from "node:stream/web";

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
    // The placeholder code, which a document created before its unit loaded carries.
    expect(renderUnitFor("NULL")).toBe(fallbackClueUnit);
    expect(renderUnitFor("some/path")).toBe(fallbackClueUnit);
    expect(renderUnitFor(42)).toBe(fallbackClueUnit);
  });
});

describe("readAtMost", () => {
  // A real stream, not a `body: null` fake: only a real stream can show the reader was cancelled.
  test("reads exactly the bound and cancels the reader, leaving the rest unread", async () => {
    let cancelled = false;
    // The 24-byte bound falls mid-third-chunk, so the fourth is left enqueued and unread.
    const chunks = [0, 10, 20, 30].map((start) =>
      new Uint8Array(Array.from({length: 10}, (_, i) => start + i)));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(stream);

    const bytes = await readAtMost(response, 24);

    expect(Array.from(bytes)).toEqual(Array.from({length: 24}, (_, i) => i));
    // Via the reader, not the stream: `getReader()` locks the stream, so cancelling the stream
    // itself would reject instead of running the underlying source's `cancel()`.
    expect(cancelled).toBe(true);
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
// A Drawing tile with no objects: empty under documentHasStudentWork, which counts a Drawing only
// when it has objects.
const emptyDrawingDoc = docOf({...drawingTile, content: {...drawingTile.content, objects: []}});

// An Image tile alone: the classifier can't inspect it, so it always counts as student work even
// though its stub summary carries none — the case a failed screenshot needs to reach a
// "nothing to send" failure record.
const imageDoc = docOf({id: "image-1", content: {type: "Image", url: "photo.png"}});

// A Geometry tile alone: inspectable-only, so it always counts as student work and is never skipped.
const geometryDoc = docOf({id: "geometry-1", content: {type: "Geometry"}});

// An AI tile alone: AI output is never student work, whatever it contains.
const aiTileDoc = docOf({id: "ai-1", content: {type: "AI", prompt: "What do you think?"}});

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
const kImageUrl = "https://shutterbug-test.s3.amazonaws.com/testdoc.png";

// A Shutterbug reply that a well-behaved service would send.
function shutterbugOk(url = kImageUrl) {
  return {ok: true, status: 200, statusText: "OK", json: async () => ({url})} as Response;
}

// A well-behaved S3 image-check reply: 206, honouring `Range`, `Content-Range` naming the size.
// `body: null` uses readAtMost's `arrayBuffer()` fallback. Every field is overridable.
function imageCheckOk(options: {
  widthPx?: number; heightPx?: number; status?: number; statusText?: string;
  headers?: Record<string, string>; bytes?: Uint8Array;
} = {}) {
  const {
    widthPx = 1000, heightPx = 1200, status = 206, statusText = "Partial Content",
    headers = {"content-range": "bytes 0-23/48211"},
  } = options;
  const bytes = options.bytes ?? pngHeaderBytes(widthPx, heightPx);
  return {
    ok: true,
    status,
    statusText,
    headers: new Headers(headers),
    body: null,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

// A real, chunked body of `totalBytes` zero bytes, prefixed with a genuine PNG header when asked.
// `highWaterMark: 0` disables prefetch, so `bytesPulled` counts only what a reader actually
// consumed, not a chunk produced ahead of it — otherwise a widened read bound could hide there.
function bodyStreamOf(totalBytes: number, prefix: Uint8Array = new Uint8Array(0)) {
  let sent = 0;
  let cancelled = false;
  let bytesPulled = 0;
  const chunkSize = 1024 * 1024;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent < prefix.length) {
        controller.enqueue(prefix);
        sent += prefix.length;
        bytesPulled += prefix.length;
        return;
      }
      const remaining = totalBytes - sent;
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const take = Math.min(chunkSize, remaining);
      controller.enqueue(new Uint8Array(take));
      sent += take;
      bytesPulled += take;
    },
    cancel() {
      cancelled = true;
    },
  }, {highWaterMark: 0});
  return {stream, wasCancelled: () => cancelled, bytesPulled: () => bytesPulled};
}

// A 200 that ignores `Range` and streams the whole picture back, the way a host that does not
// honour it would.
function imageCheckStreaming(options: {
  widthPx?: number; heightPx?: number; extraBytes?: number;
  headers?: Record<string, string>;
} = {}) {
  const {widthPx = 1000, heightPx = 1200, extraBytes = 10 * 1024 * 1024, headers} = options;
  const header = pngHeaderBytes(widthPx, heightPx);
  const {stream, wasCancelled, bytesPulled} = bodyStreamOf(extraBytes, header);
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(headers ?? {"content-length": String(header.length + extraBytes)}),
    body: stream,
  } as unknown as Response;
  return {response, wasCancelled, bytesPulled};
}

// A real streamed body of exactly `totalBytes` bytes, with no size header at all — what
// bodyExceedsBytes's fallback GET has to measure by reading.
function fallbackBodyOf(totalBytes: number) {
  return {
    ok: true, status: 200, statusText: "OK", headers: new Headers({}),
    body: bodyStreamOf(totalBytes).stream,
  } as unknown as Response;
}

// Stands in for the Shutterbug service. Pass a Response-like object to answer with, or an Error
// to fail with. `postedPage` reads back the render page that was posted. `imageAnswer` answers
// the image-check request that follows a successful post, defaulting to a 1000x1200 PNG.
// `fallbackAnswer` answers the fallback GET that follows an image check with no usable size
// header, defaulting to `imageAnswer` for call sites that don't exercise the fallback.
function stubShutterbug(
  answer: Response | Error,
  imageAnswer: Response | Error = imageCheckOk(),
  fallbackAnswer: Response | Error = imageAnswer,
) {
  const spy = jest.spyOn(global, "fetch");
  const queueOnce = (value: Response | Error) =>
    value instanceof Error ? spy.mockRejectedValueOnce(value) : spy.mockResolvedValueOnce(value);
  queueOnce(answer);
  queueOnce(imageAnswer);
  // Covers the fallback's bounded GET too, if the image check needs one.
  if (fallbackAnswer instanceof Error) spy.mockRejectedValue(fallbackAnswer);
  else spy.mockResolvedValue(fallbackAnswer);
  return {
    spy,
    postedPage: () => JSON.parse(spy.mock.calls[0][1]?.body as string).content as string,
    postedRequest: () => JSON.parse(spy.mock.calls[0][1]?.body as string),
    imageCheckCall: () => spy.mock.calls[1],
    fallbackCall: () => spy.mock.calls[2],
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

function aRequestContext(unit: string) {
  return {unit, investigation: "1", problem: "1", offeringId: "1234"};
}

function pendingEntryFields(docId: string, overrides: Record<string, unknown> = {}) {
  const entry: Record<string, unknown> = {
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
    if (value === undefined) delete entry[key];
  }
  return entry;
}

// runPending hands the trigger a synthetic event, not a real document — a test simulating another
// write landing on the document must create it here first.
function seedPendingDoc(docId: string, overrides: Record<string, unknown> = {}) {
  return admin.firestore().doc(`analysis/queue/pending/${docId}`).set(pendingEntryFields(docId, overrides));
}

// Runs the function over a pending-queue entry for the document.
async function runPending(docId: string, overrides: Record<string, unknown> = {}) {
  const wrapped = fft.wrap(onAnalysisDocumentPending);
  const entry = pendingEntryFields(docId, overrides);
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
// "done" records are added with an auto-generated id (unlike "imaged", which is keyed by docId),
// so they are found by the documentId field instead.
const doneRecord = (docId: string) =>
  queue("done").where("documentId", "==", docId).get().then((snapshot) => snapshot.docs[0]?.data());
const statusFor = (docId: string, requestId = "automatic", evaluator = "categorize-design") =>
  getDatabase().ref(`${kDocumentRoot}/documentMetadata/${docId}/evaluationStatus/${evaluator}/${requestId}`)
    .once("value").then((snapshot) => snapshot.val());

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
        expect(shutterbug.postedRequest())
          .toEqual({content: expect.any(String), height: 500, fullPage: true});
        // The page itself is what bounds a fullPage capture; the viewport above does not.
        expect(shutterbug.postedPage()).toContain(`Math.min(height, ${kMaxFrameHeightPx})`);
      });

      test("a populated document's requestId rides through to the imaged record", async () => {
        await givenDocument("mixed1b", mixedDoc);
        stubShutterbug(shutterbugOk());

        await runPending("mixed1b", {requestIds: ["req-mixed1b"]});

        expect(await imagedRecord("mixed1b")).toMatchObject({requestIds: ["req-mixed1b"]});
      });

      // A second click's id, added to the document while Shutterbug is awaited, would otherwise
      // be lost when this function deletes the document it read at creation.
      test("a requestId added to the queue document while Shutterbug is being awaited still " +
           "reaches the imaged record", async () => {
        await givenDocument("midflight1", mixedDoc);
        await seedPendingDoc("midflight1", {requestIds: ["req-midflight-a"]});
        const pendingDocRef = admin.firestore().doc("analysis/queue/pending/midflight1");
        jest.spyOn(global, "fetch").mockImplementationOnce(async () => {
          await pendingDocRef.update({requestIds: FieldValue.arrayUnion("req-midflight-b")});
          return shutterbugOk();
        });

        await runPending("midflight1", {requestIds: ["req-midflight-a"]});

        expect(await imagedRecord("midflight1")).toMatchObject({
          requestIds: ["req-midflight-a", "req-midflight-b"],
        });
      });

      // The next function's own trigger fires the instant the imaged document is created and
      // never looks again, so a late id has to be there from that first write — patching it in
      // with a second write, after the document already exists, would arrive too late for a
      // trigger that already fired and read the incomplete version.
      test("a requestId added to the queue document while Shutterbug is being awaited is present " +
           "from the imaged document's first write, not patched in afterward", async () => {
        await givenDocument("midflight2", mixedDoc);
        await seedPendingDoc("midflight2", {requestIds: ["req-midflight2-a"]});
        const pendingDocRef = admin.firestore().doc("analysis/queue/pending/midflight2");
        jest.spyOn(global, "fetch").mockImplementationOnce(async () => {
          await pendingDocRef.update({requestIds: FieldValue.arrayUnion("req-midflight2-b")});
          return shutterbugOk();
        });

        const imagedDocRef = admin.firestore().doc("analysis/queue/imaged/midflight2");
        let firstWriteRequestIds: unknown;
        const firstWriteSeen = new Promise<void>((resolve) => {
          const unsubscribe = imagedDocRef.onSnapshot((snapshot) => {
            if (snapshot.exists) {
              firstWriteRequestIds = snapshot.data()?.requestIds;
              unsubscribe();
              resolve();
            }
          });
        });

        await runPending("midflight2", {requestIds: ["req-midflight2-a"]});
        await firstWriteSeen;

        expect(firstWriteRequestIds).toEqual(["req-midflight2-a", "req-midflight2-b"]);
      });

      // An imaged document already sitting at this docId means an evaluation for it is already in
      // progress, using that document's own content (a model call, in on-analysis-document-imaged.ts,
      // can take a while). This run's own freshly-computed content must not replace it — only the
      // ids need to reach it, so that run's eventual completion status covers this one's click too.
      test("writeImaged unions its ids into an existing imaged document instead of replacing it",
        async () => {
          await givenDocument("union1", mixedDoc);
          stubShutterbug(shutterbugOk());

          const imagedDocRef = admin.firestore().doc("analysis/queue/imaged/union1");
          await imagedDocRef.set(pendingEntryFields("union1", {
            analysisVersion: 2,
            sendSummary: true,
            docSummary: "An evaluation already in progress for this document.",
            sendImage: false,
            requestIds: ["req-union-existing"],
          }));

          await runPending("union1", {requestIds: ["req-union-new"]});

          expect(await imagedRecord("union1")).toMatchObject({
          // The in-progress evaluation's own content survives untouched.
            docSummary: "An evaluation already in progress for this document.",
            sendImage: false,
            // Both ids are present.
            requestIds: expect.arrayContaining(["req-union-existing", "req-union-new"]),
          });
          expect((await imagedRecord("union1"))?.requestIds).toHaveLength(2);
          // The pending entry is still removed, same as any other run.
          expect(await countIn("pending")).toEqual(0);
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

      test("a drawing with no objects is skipped, not partially evaluated", async () => {
        await givenDocument("emptydraw1", emptyDrawingDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("emptydraw1", {requestIds: ["req-emptydraw1"]});

        expect(await countIn("pending")).toEqual(0);
        expect(await countIn("imaged")).toEqual(0);
        expect(await countIn("failedImaging")).toEqual(0);
        const record = await doneRecord("emptydraw1");
        expect(record).toMatchObject({
          analysisVersion: 2,
          sendSummary: false,
          sendImage: false,
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
          classification: {
            modality: "visual-only", hasStudentText: false, summaryCarriesStudentWork: false,
            needsImage: true, promptNeedsImage: false,
          },
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
        });
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expect(await statusFor("emptydraw1", "req-emptydraw1"))
          .toMatchObject({outcome: "skipped-empty", requestId: "req-emptydraw1"});
      });

      test("an empty document is skipped, not evaluated", async () => {
        // Nothing here reaches the model or Shutterbug; a `done` record is written directly.
        await givenDocument("empty1", emptyDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("empty1", {requestIds: ["req-empty1"]});

        expect(await countIn("pending")).toEqual(0);
        expect(await countIn("imaged")).toEqual(0);
        expect(await countIn("failedImaging")).toEqual(0);
        const record = await doneRecord("empty1");
        expect(record).toMatchObject({
          analysisVersion: 2,
          sendSummary: false,
          sendImage: false,
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
          classification: {
            modality: "empty", hasStudentText: false, summaryCarriesStudentWork: false,
            needsImage: false, promptNeedsImage: false,
          },
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
        });
        // No summary, and no picture: nothing was produced at all, unlike the old behavior.
        expect(record?.docSummary).toBeUndefined();
        expect(shutterbug.spy).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("is empty; skipped evaluation"));

        const status = await statusFor("empty1", "req-empty1");
        expect(status).toMatchObject({outcome: "skipped-empty", requestId: "req-empty1", docUpdated: "1001"});
      });

      // See AnalysisQueueDocument.requestIds for why a queue entry can carry more than one id.
      test("a skipped-empty status is written for every requestId a coalesced queue entry carries", async () => {
        await givenDocument("emptyMulti", emptyDoc);
        stubShutterbug(shutterbugOk());

        await runPending("emptyMulti", {requestIds: ["req-empty-a", "req-empty-b"]});

        expect(await statusFor("emptyMulti", "req-empty-a")).toMatchObject({outcome: "skipped-empty"});
        expect(await statusFor("emptyMulti", "req-empty-b")).toMatchObject({outcome: "skipped-empty"});
      });

      // Same case as the imaged-record test above, but the id lands while metadata is being read,
      // before the empty check.
      test("a requestId added to the queue document while its metadata is being read gets its " +
           "own skipped-empty status, and a late id is re-queued instead of also skipped",
      async () => {
        await givenDocument("emptymidflight1", emptyDoc);
        await seedPendingDoc("emptymidflight1", {requestIds: ["req-emptymidflight-a"]});
        const pendingDocRef = admin.firestore().doc("analysis/queue/pending/emptymidflight1");
        const realDoc = admin.firestore().doc.bind(admin.firestore());
        const docSpy = jest.spyOn(admin.firestore(), "doc").mockImplementation((path: string) => {
          if (path !== "demo/AI/documents/emptymidflight1") return realDoc(path);
          return {
            get: async () => {
              await pendingDocRef.update({requestIds: FieldValue.arrayUnion("req-emptymidflight-b")});
              return realDoc(path).get();
            },
          } as any;
        });

        await runPending("emptymidflight1", {requestIds: ["req-emptymidflight-a"]});
        docSpy.mockRestore();

        expect(await statusFor("emptymidflight1", "req-emptymidflight-a"))
          .toMatchObject({outcome: "skipped-empty"});
        // Not part of this run's own snapshot, so it gets no status here.
        expect(await statusFor("emptymidflight1", "req-emptymidflight-b")).toBeNull();

        // It's back on a fresh pending document instead, for its own run to judge.
        const requeued = await pendingDocRef.get();
        expect(requeued.exists).toBe(true);
        expect(requeued.data()).toMatchObject({requestIds: ["req-emptymidflight-b"]});
      });

      // A third click can independently create a fresh pending document in this gap; re-creation
      // must union into it, not replace it.
      test("re-creating a pending document for a late id unions into one that appeared in the " +
           "meantime, rather than replacing it", async () => {
        await givenDocument("emptyunion1", emptyDoc);
        await seedPendingDoc("emptyunion1", {requestIds: ["req-emptyunion-a"]});

        const pendingDocRef = admin.firestore().doc("analysis/queue/pending/emptyunion1");
        const realClaimRequestIds = claimRequestIdsModule.claimRequestIds;
        const claimSpy = jest.spyOn(claimRequestIdsModule, "claimRequestIds")
          .mockImplementation(async (docRef) => {
            const claimed = await realClaimRequestIds(docRef);
            // A distinct docUpdated, so the assertion below can tell this document's own fields
            // apart from the skipped run's older copy of them.
            await pendingDocRef.set(pendingEntryFields("emptyunion1", {
              requestIds: ["req-emptyunion-appeared"], docUpdated: "9999",
            }));
            return [...(claimed ?? []), "req-emptyunion-b"];
          });

        await runPending("emptyunion1", {requestIds: ["req-emptyunion-a"]});
        claimSpy.mockRestore();

        const requeued = await pendingDocRef.get();
        expect(requeued.exists).toBe(true);
        expect(requeued.data()?.requestIds).toEqual(
          expect.arrayContaining(["req-emptyunion-appeared", "req-emptyunion-b"])
        );
        // The document that appeared in the meantime is kept, not replaced with the skipped run's
        // own (older) copy of the same fields.
        expect(requeued.data()?.docUpdated).toBe("9999");
      });

      test("a rejected status write after a skip still leaves the done record and cleanup in place", async () => {
        // Simulates the Realtime Database write itself failing, so writeEvaluationStatus's own
        // catch-and-warn runs for real.
        await givenDocument("empty4", emptyDoc);
        const db = getDatabase();
        const realRef = db.ref.bind(db);
        jest.spyOn(db, "ref").mockImplementation((path) => {
          const ref = realRef(path);
          if (typeof path === "string" && path.includes("evaluationStatus")) {
            return Object.assign(Object.create(Object.getPrototypeOf(ref)), ref, {
              set: async () => {
                throw new Error("rtdb unavailable");
              },
            });
          }
          return ref;
        });

        await runPending("empty4");

        const record = await doneRecord("empty4");
        expect(record).toMatchObject({summaryOmittedReason: "empty-document", imageOmittedReason: "empty-document"});
        expect(await countIn("pending")).toEqual(0);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Could not write evaluation status"), expect.any(Error));
      });

      test("a skipped-empty status is still written when the pending queue entry cannot be removed", async () => {
        await givenDocument("empty5", emptyDoc);
        const realDoc = admin.firestore().doc.bind(admin.firestore());
        const docSpy = jest.spyOn(admin.firestore(), "doc").mockImplementation((path: string) => {
          if (path !== "analysis/queue/pending/empty5") return realDoc(path);
          // claimRequestIds never calls docRef.delete() directly — it goes through
          // docRef.firestore.runTransaction(), so the failure has to be staged there to actually
          // be reached, rather than in a .delete() the code never calls.
          return {
            firestore: {
              runTransaction: async () => {
                throw new Error("firestore unavailable");
              },
            },
          } as any;
        });

        await runPending("empty5", {requestIds: ["req-empty5"]});
        docSpy.mockRestore();

        // The delete failure did not fall through to the generic error path: no contradictory
        // failure record, and the correct status was still written.
        expect(logger.error).toHaveBeenCalledWith(
          "Could not remove the pending queue entry, which will not be retried", expect.any(Error));
        expect(await countIn("failedImaging")).toEqual(0);
        expect(await doneRecord("empty5")).toMatchObject({summaryOmittedReason: "empty-document"});
        expect(await statusFor("empty5", "req-empty5")).toMatchObject({outcome: "skipped-empty"});
      });

      test("a document holding only an AI tile is skipped: AI output is never student work", async () => {
        await givenDocument("aitile1", aiTileDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("aitile1");

        expect(await countIn("imaged")).toEqual(0);
        const record = await doneRecord("aitile1");
        expect(record).toMatchObject({
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
        });
        expect(shutterbug.spy).not.toHaveBeenCalled();
      });

      test("a Geometry-only document is not skipped: the classifier cannot inspect it", async () => {
        await givenDocument("geo1", geometryDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("geo1");

        expect(await countIn("done")).toEqual(0);
        const record = await imagedRecord("geo1");
        expect(record).toMatchObject({
          sendSummary: false,
          summaryOmittedReason: "no-student-work-in-summary",
          sendImage: true,
        });
        // post + the image check that follows every successful one
        expect(shutterbug.spy).toHaveBeenCalledTimes(2);
      });

      test("a document with no metadata document renders with the fallback unit", async () => {
        await givenDocument("nounit1", mixedDoc, kNoMetadata);
        stubShutterbug(shutterbugOk());

        await runPending("nounit1");

        expect(await imagedRecord("nounit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: fallbackClueUnit},
        });
        expect(logger.warn).toHaveBeenCalledWith(
          "Document unit undefined and request unit undefined are both unusable for rendering, " +
          `using "${fallbackClueUnit}"`);
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
          "Document unit null and request unit undefined are both unusable for rendering, " +
          `using "${fallbackClueUnit}"`);
        // The render was posted with the fallback unit, not the null one.
        expect(shutterbug.postedPage()).toContain(`?unit=${fallbackClueUnit}&amp;unwrapped&amp;readOnly"`);
      });

      // A personal document's record has no unit. Rendering with the fallback would draw every
      // tile the fallback unit does not list as an "unknown tile" placeholder.
      test("a metadata unit of null gives way to the unit the student was running", async () => {
        await givenDocument("requnit1", mixedDoc, null);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("requnit1", {requestContext: aRequestContext("msa")});

        // The next function reads the context off this record, not off the evaluation request.
        expect(await imagedRecord("requnit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: "msa"},
          requestContext: aRequestContext("msa"),
        });
        expect(logger.info).toHaveBeenCalledWith(
          "Document has no usable unit (null); rendering with the unit the student was running: \"msa\"");
        expect(logger.warn).not.toHaveBeenCalled();
        expect(shutterbug.postedPage()).toContain("?unit=msa&amp;unwrapped&amp;readOnly\"");
      });

      test("a document with its own unit keeps it, whatever the student was running", async () => {
        await givenDocument("ownunit1", mixedDoc, "vibe");
        stubShutterbug(shutterbugOk());

        await runPending("ownunit1", {requestContext: aRequestContext("msa")});

        expect(await imagedRecord("ownunit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
        });
      });

      // A unit loaded from a custom URL: stored, but not a code the curriculum site can serve.
      test("a metadata unit that cannot be rendered gives way to the request unit", async () => {
        await givenDocument("badunit1", mixedDoc, "https://example.com/content.json");
        stubShutterbug(shutterbugOk());

        await runPending("badunit1", {requestContext: aRequestContext("msa")});

        expect(await imagedRecord("badunit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: "msa"},
        });
      });

      test("a request unit that cannot be rendered falls back like any other", async () => {
        await givenDocument("badrequnit1", mixedDoc, null);
        stubShutterbug(shutterbugOk());

        await runPending("badrequnit1", {requestContext: aRequestContext("https://example.com/content.json")});

        expect(await imagedRecord("badrequnit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: fallbackClueUnit},
        });
        // Nothing said which unit to render with, so the picture may show placeholders.
        expect(logger.warn).toHaveBeenCalledWith(
          "Document unit null and request unit \"https://example.com/content.json\" are both " +
          `unusable for rendering, using "${fallbackClueUnit}"`);
      });

      // The screenshot rule is wider than the fill rule in readDocumentMetadata: a learning log
      // gets no context from the request, but its tiles still belong to the student's unit.
      test("a document that is not personal is still rendered with the request unit", async () => {
        await givenDocument("llunit1", mixedDoc, null);
        await admin.firestore().doc("demo/AI/documents/llunit1").set({unit: null, type: "learningLog"});
        stubShutterbug(shutterbugOk());

        await runPending("llunit1", {requestContext: aRequestContext("msa")});

        expect(await imagedRecord("llunit1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: "msa"},
        });
      });

      test("a metadata unit of NULL gives way to the request unit", async () => {
        await givenDocument("nullcode1", mixedDoc, "NULL");
        stubShutterbug(shutterbugOk());

        await runPending("nullcode1", {requestContext: aRequestContext("msa")});

        expect(await imagedRecord("nullcode1")).toMatchObject({
          renderTarget: {clueUrl: clueIframeURL, unit: "msa"},
        });
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
        // post + the image check that follows every successful one
        expect(shutterbug.spy).toHaveBeenCalledTimes(2);
        expectReasonsAreExclusive(record);
      });

      test("a picture prompt with no answer is skipped: there is no student work to judge", async () => {
        // An authored prompt is never student work; with no response rows, nothing here is either.
        await givenDocument("imgq2", imagePromptQuestionDoc(false));
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("imgq2");

        expect(await countIn("imaged")).toEqual(0);
        expect(await countIn("failedImaging")).toEqual(0);
        const record = await doneRecord("imgq2");
        expect(record).toMatchObject({
          sendImage: false,
          sendSummary: false,
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
          classification: {modality: "empty", promptNeedsImage: true},
        });
        expect(shutterbug.spy).not.toHaveBeenCalled();
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
        ["a private-host url", {ok: true, status: 200, json: async () => ({url: "https://169.254.169.254/x.png"})} as unknown as Response,
          "private or loopback host"],
        ["a public https url on an unexpected host",
          {ok: true, status: 200, json: async () => ({url: "https://images.example.test/x.png"})} as unknown as Response,
          "unexpected host"],
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

      test("an empty drawing is skipped before Shutterbug is ever called, whatever it would answer", async () => {
        // Shutterbug is stubbed to fail; the skip check must happen before it's ever consulted.
        await givenDocument("draw2", emptyDrawingDoc);
        const shutterbug = stubShutterbug(new Error("connection refused"));

        await runPending("draw2");

        expect(await countIn("imaged")).toEqual(0);
        expect(await countIn("failedImaging")).toEqual(0);
        expect(shutterbug.spy).not.toHaveBeenCalled();
        const record = await doneRecord("draw2");
        expect(record).toMatchObject({
          analysisVersion: 2,
          classification: {modality: "visual-only"},
          renderTarget: {clueUrl: clueIframeURL, unit: "vibe"},
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
        });
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
        // post + the image check that follows every successful one
        expect(shutterbug.spy).toHaveBeenCalledTimes(2);
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
        // post + the image check that follows every successful one
        expect(shutterbug.spy).toHaveBeenCalledTimes(2);
      });

      test("an empty drawing is skipped without ever reading the screenshot switch", async () => {
        await admin.firestore().doc(analysisSettingsPath).set({imagesEnabled: false});
        await givenDocument("draw3", emptyDrawingDoc);
        const settingsReads = jest.spyOn(admin.firestore(), "doc");

        await runPending("draw3");

        expect(settingsReads.mock.calls.map((call) => call[0])).not.toContain(analysisSettingsPath);
        const record = await doneRecord("draw3");
        expect(record).toMatchObject({
          summaryOmittedReason: "empty-document",
          imageOmittedReason: "empty-document",
        });
      });
    });

    describe("the image check", () => {
      // Every case posts successfully to Shutterbug first, then asks what happens to the picture
      // once its dimensions and size come back.
      const documentPath = (docId: string) => `${kDocumentRoot}/documents/${docId}`;

      test("happy path: the picture is sent, unclipped, with no warning", async () => {
        await givenDocument("imgchk1", mixedDoc);
        stubShutterbug(shutterbugOk());

        await runPending("imgchk1");

        const record = await imagedRecord("imgchk1");
        expect(record).toMatchObject({sendImage: true, docImageUrl: kImageUrl});
        expect(record?.imageClipped).toBeUndefined();
        expect(record?.imageOmittedReason).toBeUndefined();
        expect(record?.imageError).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
        expectReasonsAreExclusive(record);
      });

      test("a capture just below the ceiling is sent unclipped", async () => {
        await givenDocument("imgchk10a", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({heightPx: kMaxFrameHeightPx - 1}));

        await runPending("imgchk10a");

        const record = await imagedRecord("imgchk10a");
        expect(record).toMatchObject({sendImage: true});
        expect(record?.imageClipped).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
      });

      test("a capture at the ceiling is sent, and the clip is recorded and logged once", async () => {
        await givenDocument("imgchk2", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({heightPx: kMaxFrameHeightPx}));

        await runPending("imgchk2");

        const record = await imagedRecord("imgchk2");
        expect(record).toMatchObject({
          sendImage: true,
          imageClipped: {capturedHeightPx: kMaxFrameHeightPx, ceilingPx: kMaxFrameHeightPx},
        });
        expect(record?.imageOmittedReason).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          `Screenshot of ${documentPath("imgchk2")} was clipped at ${kMaxFrameHeightPx}px ` +
          `(captured ${kMaxFrameHeightPx}px)`);
      });

      // A real capture lands a little past the ceiling (the outer page's own margin) — the case
      // ">=" exists for.
      test("a capture past the ceiling (the outer page's own margin) is still a clip", async () => {
        await givenDocument("imgchk10b", mixedDoc);
        const capturedHeightPx = kMaxFrameHeightPx + 16;
        stubShutterbug(shutterbugOk(), imageCheckOk({heightPx: capturedHeightPx}));

        await runPending("imgchk10b");

        const record = await imagedRecord("imgchk10b");
        expect(record).toMatchObject({
          sendImage: true,
          imageClipped: {capturedHeightPx, ceilingPx: kMaxFrameHeightPx},
        });
        expect(logger.warn).toHaveBeenCalledWith(
          `Screenshot of ${documentPath("imgchk10b")} was clipped at ${kMaxFrameHeightPx}px ` +
          `(captured ${capturedHeightPx}px)`);
      });

      test("over the byte limit via Content-Range: the picture is omitted, not sent", async () => {
        await givenDocument("imgchk3", mixedDoc);
        const overLimit = 25 * 1024 * 1024;
        stubShutterbug(shutterbugOk(), imageCheckOk({headers: {"content-range": `bytes 0-23/${overLimit}`}}));

        await runPending("imgchk3");

        const record = await imagedRecord("imgchk3");
        expect(record).toMatchObject({
          sendImage: false, imageOmittedReason: "image-too-large", docImageUrl: kImageUrl,
          // The summary is untouched by an image omission.
          sendSummary: true,
        });
        expect(record?.docSummary).toBeTruthy();
        expect(record?.imageClipped).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(
          `Screenshot of ${documentPath("imgchk3")} is ${overLimit} bytes, over the`));
        expectReasonsAreExclusive(record);
      });

      test("a 200 with Content-Length over the limit is omitted the same way", async () => {
        await givenDocument("imgchk4", mixedDoc);
        const overLimit = 25 * 1024 * 1024;
        stubShutterbug(shutterbugOk(), imageCheckOk({
          status: 200, statusText: "OK", headers: {"content-length": String(overLimit)},
        }));

        await runPending("imgchk4");

        expect(await imagedRecord("imgchk4")).toMatchObject({
          sendImage: false, imageOmittedReason: "image-too-large", docImageUrl: kImageUrl,
        });
      });

      test("no size header at all, and a body under the limit: the picture is sent", async () => {
        await givenDocument("imgchk5", mixedDoc);
        // No size header; falls back to a bounded GET, which finds a small body and proceeds.
        const shutterbug = stubShutterbug(shutterbugOk(), imageCheckOk({headers: {}}));

        await runPending("imgchk5");

        expect(await imagedRecord("imgchk5")).toMatchObject({sendImage: true});
        // The fallback GET, same as the range request: a redirect must not be followed either.
        expect(shutterbug.spy.mock.calls[2]?.[1]?.redirect).toBe("manual");
      });

      // Exercises a real stream, unlike `imageCheckOk`'s `body: null` stand-in.
      test("a 200 that ignores Range still reads only the header, from a real stream", async () => {
        await givenDocument("imgchk10c", mixedDoc);
        const {response, wasCancelled, bytesPulled} = imageCheckStreaming({widthPx: 1000, heightPx: 1200});
        stubShutterbug(shutterbugOk(), response);

        await runPending("imgchk10c");

        expect(await imagedRecord("imgchk10c")).toMatchObject({sendImage: true});
        expect(wasCancelled()).toBe(true);
        // Not just cancelled eventually: exactly the 24-byte header, none of the 10 MiB behind it.
        expect(bytesPulled()).toBe(24);
      });

      // Against the real `maxImageBytes` constant, not a duplicated number.
      test("the fallback measures a body exactly at the byte limit as sendable", async () => {
        await givenDocument("imgchk10d", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({headers: {}}), fallbackBodyOf(maxImageBytes));

        await runPending("imgchk10d");

        const record = await imagedRecord("imgchk10d");
        expect(record).toMatchObject({sendImage: true, docImageUrl: kImageUrl});
        expectReasonsAreExclusive(record);
      });

      test("the fallback measures a body one byte over the limit as too large", async () => {
        await givenDocument("imgchk10e", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({headers: {}}), fallbackBodyOf(maxImageBytes + 1));

        await runPending("imgchk10e");

        const record = await imagedRecord("imgchk10e");
        expect(record).toMatchObject({
          sendImage: false, imageOmittedReason: "image-too-large", docImageUrl: kImageUrl,
          sendSummary: true,
        });
        expect(record?.docSummary).toBeTruthy();
        expectReasonsAreExclusive(record);
      });

      test("the fallback GET rejects: the picture is omitted, and the summary survives", async () => {
        await givenDocument("imgchk10f", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({headers: {}}), new Error("connection reset"));

        await runPending("imgchk10f");

        const record = await imagedRecord("imgchk10f");
        expect(record?.sendImage).toBe(false);
        expect(record?.imageError).toMatch(/^Image check error:/);
        expect(record?.sendSummary).toBe(true);
        expect(record?.docSummary).toBeTruthy();
        expectReasonsAreExclusive(record);
      });

      test("a redirect on the fallback GET is refused, not followed", async () => {
        await givenDocument("imgchk10g", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({headers: {}}), {
          ok: false, status: 302, statusText: "Found",
          headers: new Headers({location: "https://169.254.169.254/x.png"}),
          body: null,
        } as unknown as Response);

        await runPending("imgchk10g");

        const record = await imagedRecord("imgchk10g");
        expect(record?.sendImage).toBe(false);
        expect(record?.imageError).toMatch(/^Image check error:/);
        expect(record?.imageError).toContain("302");
        expect(record?.sendSummary).toBe(true);
        expectReasonsAreExclusive(record);
      });

      test("the range request rejects: the picture is omitted, not sent unverified", async () => {
        await givenDocument("imgchk6", mixedDoc);
        stubShutterbug(shutterbugOk(), new Error("connection reset"));

        await runPending("imgchk6");

        const record = await imagedRecord("imgchk6");
        expect(record?.sendImage).toBe(false);
        expect(record?.imageError).toMatch(/^Image check error:/);
        expect(record?.docImageUrl).toEqual(kImageUrl);
        expectReasonsAreExclusive(record);
      });

      test("bytes that are not a PNG (wrong signature): the picture is omitted", async () => {
        await givenDocument("imgchk7", mixedDoc);
        stubShutterbug(shutterbugOk(), imageCheckOk({bytes: new Uint8Array(24)}));

        await runPending("imgchk7");

        const record = await imagedRecord("imgchk7");
        expect(record?.sendImage).toBe(false);
        expect(record?.imageError).toMatch(/^Image check error:/);
        expect(record?.imageError).toContain("PNG signature");
      });

      test("a redirect from the image host is refused, not followed", async () => {
        // The fetch is `redirect: "manual"`, so a real redirect never gets a second request out to
        // wherever it points — it comes back as this 3xx, which is rejected like any bad response.
        await givenDocument("imgchk9", mixedDoc);
        stubShutterbug(shutterbugOk(), {
          ok: false, status: 302, statusText: "Found",
          headers: new Headers({location: "https://169.254.169.254/x.png"}),
          body: null,
        } as unknown as Response);

        await runPending("imgchk9");

        const record = await imagedRecord("imgchk9");
        expect(record?.sendImage).toBe(false);
        expect(record?.imageError).toMatch(/^Image check error:/);
        expect(record?.imageError).toContain("302");
      });

      test("the range GET carries the Range header and a timeout", async () => {
        await givenDocument("imgchk8", mixedDoc);
        const shutterbug = stubShutterbug(shutterbugOk());

        await runPending("imgchk8");

        const call = shutterbug.imageCheckCall();
        expect(call?.[0]).toEqual(kImageUrl);
        expect(call?.[1]?.headers).toEqual({Range: "bytes=0-23"});
        expect(call?.[1]?.signal).toBeDefined();
        // Not "follow" — a redirect must come back as itself, not be followed to a second request.
        expect(call?.[1]?.redirect).toBe("manual");
      });

      // Unlike the check above, nothing here resolves the fetch itself: the record only appears
      // once the real timeout fires and aborts it. Assertions run after `runPending` resolves,
      // against plain captured variables — inside the `new Promise` executor a throw would just
      // reject the promise, which the handler records the same way as the intended abort.
      test("the range GET's timeout actually cuts off a stalled request, not just carries a signal",
        async () => {
          await givenDocument("imgchk11", mixedDoc);
          const spy = jest.spyOn(global, "fetch");
          spy.mockResolvedValueOnce(shutterbugOk());
          let capturedSignal: AbortSignal | undefined;
          let abortObserved = false;
          spy.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
            capturedSignal = init?.signal as AbortSignal;
            capturedSignal.addEventListener("abort", () => {
              abortObserved = true;
              reject(Object.assign(new Error("The operation was aborted"), {name: "TimeoutError"}));
            });
          }));

          const startedAt = Date.now();
          await runPending("imgchk11");
          const elapsedMs = Date.now() - startedAt;

          expect(capturedSignal).toBeInstanceOf(AbortSignal);
          expect(abortObserved).toBe(true);
          // Rules out an already-aborted signal, which would finish in milliseconds.
          expect(elapsedMs).toBeGreaterThanOrEqual(9_000);
          const record = await imagedRecord("imgchk11");
          expect(record?.sendImage).toBe(false);
          expect(record?.imageError).toMatch(/^Image check error:/);
        }, 15_000);
    });

    describe("a summary too large to store", () => {
      test("is recorded as an error, and the picture still goes", async () => {
        await givenDocument("big1", mixedDoc);
        stubShutterbug(shutterbugOk());
        jest.spyOn(summarizer, "documentSummarizer").mockReturnValue("x".repeat(300_000));

        await runPending("big1");

        const record = await imagedRecord("big1");
        expect(record).toMatchObject({sendSummary: false, sendImage: true, summarizer: "image"});
        expect(record?.summaryError).toContain("over the");
        // Not stored, which is the point: the write that hands the document on has to succeed.
        expect(record?.docSummary).toBeUndefined();
        expectReasonsAreExclusive(record);
      });

      test("does not stop a failure record being written when the write itself fails", async () => {
        // The recorder of last resort must not fail for the reason the work did. Here the first
        // write is refused the way Firestore refuses an oversized document; the retry has to land
        // and the pending entry has to go.
        // imageDoc, not emptyDrawingDoc — an empty drawing is now skipped before reaching this
        // path; the point here is the failure-record retry, not emptiness.
        await givenDocument("bigfail1", imageDoc);
        stubShutterbug(new Error("connection refused"));
        const attempts: Record<string, unknown>[] = [];
        const realCollection = admin.firestore().collection.bind(admin.firestore());
        const collectionSpy = jest.spyOn(admin.firestore(), "collection")
          .mockImplementation((path: string) => {
            if (!path.endsWith("failedImaging")) return realCollection(path);
            const real = realCollection(path);
            return {
              add: async (doc: Record<string, unknown>) => {
                attempts.push(doc);
                if (attempts.length === 1) throw new Error("document exceeds the maximum size");
                return real.add(doc);
              },
            } as any;
          });

        await runPending("bigfail1", {requestIds: ["req-bigfail1"]});
        collectionSpy.mockRestore();

        expect(attempts).toHaveLength(2);
        // The first attempt carried the accumulated fields; the retry carries none of them.
        expect(attempts[0]).toHaveProperty("classification");
        expect(attempts[1]).not.toHaveProperty("classification");

        expect(await countIn("pending")).toEqual(0);
        expect(await countIn("failedImaging")).toEqual(1);
        const failed = await failedRecord();
        expect(failed?.error).toContain("nothing to send");
        expect(failed?.error).toContain("accumulated fields omitted");
        // The failure still resolves the waiting bubble, via the same status mechanism as a skip.
        expect(await statusFor("bigfail1", "req-bigfail1")).toMatchObject({outcome: "failed", requestId: "req-bigfail1"});
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

      test("a failed status is still written when the pending queue entry cannot be removed", async () => {
        await givenDocument("bad2", "this is not JSON");
        const realDoc = admin.firestore().doc.bind(admin.firestore());
        const docSpy = jest.spyOn(admin.firestore(), "doc").mockImplementation((path: string) => {
          if (path !== "analysis/queue/pending/bad2") return realDoc(path);
          // claimRequestIds never calls docRef.delete() directly — it goes through
          // docRef.firestore.runTransaction(), so the failure has to be staged there to actually
          // be reached, rather than in a .delete() the code never calls.
          return {
            firestore: {
              runTransaction: async () => {
                throw new Error("firestore unavailable");
              },
            },
          } as any;
        });

        await runPending("bad2", {requestIds: ["req-bad2"]});
        docSpy.mockRestore();

        expect(logger.error).toHaveBeenCalledWith(
          "Could not remove the pending queue entry, which will not be retried", expect.any(Error));
        expect((await failedRecord())?.error).toContain("invalid document JSON");
        expect(await statusFor("bad2", "req-bad2")).toMatchObject({outcome: "failed", requestId: "req-bad2"});
      });

      // Same coalescing case as the skipped-empty version above, but through the error boundary.
      test("a failed status is written for every requestId a coalesced queue entry carries", async () => {
        await givenDocument("bad3", "this is not JSON");

        await runPending("bad3", {requestIds: ["req-bad-a", "req-bad-b"]});

        expect(await statusFor("bad3", "req-bad-a")).toMatchObject({outcome: "failed"});
        expect(await statusFor("bad3", "req-bad-b")).toMatchObject({outcome: "failed"});
      });

      // Same case as the skipped-empty version above, but through the error boundary.
      test("a requestId added to the queue document while its metadata is being read still gets " +
           "its own failed status", async () => {
        await givenDocument("badmidflight1", "this is not JSON");
        await seedPendingDoc("badmidflight1", {requestIds: ["req-badmidflight-a"]});
        const pendingDocRef = admin.firestore().doc("analysis/queue/pending/badmidflight1");
        const realDoc = admin.firestore().doc.bind(admin.firestore());
        const docSpy = jest.spyOn(admin.firestore(), "doc").mockImplementation((path: string) => {
          if (path !== "demo/AI/documents/badmidflight1") return realDoc(path);
          return {
            get: async () => {
              await pendingDocRef.update({requestIds: FieldValue.arrayUnion("req-badmidflight-b")});
              return realDoc(path).get();
            },
          } as any;
        });

        await runPending("badmidflight1", {requestIds: ["req-badmidflight-a"]});
        docSpy.mockRestore();

        expect(await statusFor("badmidflight1", "req-badmidflight-a")).toMatchObject({outcome: "failed"});
        expect(await statusFor("badmidflight1", "req-badmidflight-b")).toMatchObject({outcome: "failed"});
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
