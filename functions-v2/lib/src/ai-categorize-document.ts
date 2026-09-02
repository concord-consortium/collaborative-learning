import OpenAI from "openai";
import fs from "node:fs/promises";
import * as logger from "firebase-functions/logger";
import {
  Firestore,
  FieldValue,
  VectorQuery
} from "@google-cloud/firestore";
import { AiAgreement, isAiAgreement } from "../../src/summary-types";
import { kRatingValues } from "../../../shared/shared";
import {
  Agreements,
  RelatedSummary,
  buildImageMessages,
  buildMixedMessages,
  buildSummaryMessages,
  buildZodResponseSchema,
  categorizationResponseFormat,
  defaultAiPrompt
} from "../../../shared/ai-analysis-messages";

/**
 * The fields `mapRelatedSummaries` reads off a document returned by the related-summaries search.
 *
 * Local to this module rather than shared: it describes a Firestore document's shape, and it names
 * `AiAgreement`, which is a functions-v2 type. `shared/` carries what production and the harness
 * both have to agree on — the prompt, the message builders, and the entries those builders take.
 */
export interface RelatedSummarySource {
  summary?: unknown;
  aiAgreements?: Record<string, AiAgreement>;
}

// The message and schema builders live in shared/ so this function and the local evaluation
// harness (scripts/ai-harness) construct identical OpenAI requests. They are re-exported here
// so existing importers of this module keep working.
export {
  buildImageMessages,
  buildMixedMessages,
  buildSummaryMessages,
  buildZodResponseSchema,
  categorizationResponseFormat,
  defaultAiPrompt
};
export type { AgreementInfo, Agreements, IAiPrompt, RelatedSummary } from "../../../shared/ai-analysis-messages";

export async function categorizeDocument(file: string, apiKey: string) {
  const imageLoading = fs.readFile(file).then((data) => data.toString("base64"));
  const image = await imageLoading;
  const url = `data:image/png;base64,${image}`;
  return categorizeUrl(url, apiKey);
}

export async function categorizeUrl(url: string, apiKey: string, aiPrompt = defaultAiPrompt) {
  logger.info("Categorizing url");
  const openai = new OpenAI({apiKey});
  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    return openai.chat.completions.parse({
      model: "gpt-4o-mini",
      // model: "gpt-4o-2024-08-06",
      messages: buildImageMessages(aiPrompt, url),
      response_format: categorizationResponseFormat(responseSchema),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
  }
}

/**
 * What the related-summaries lookup and the `summaries/` record are both built from.
 *
 * `root` and `space` name the realm — `demo/AI`, `authed/{portalId}` — and come from the document's
 * path, since no field carries them. They confine the lookup to one realm: `summaries` is a flat
 * collection, so without them a record written in one realm can be returned to a document analyzed
 * in another whenever the context fields coincide.
 */
export interface DocumentMetadata {
  root: string;
  space: string;
  key: string;
  context_id: string;
  unit: string;
  investigation: string;
  problem: string;
  offeringId: string;
}

/**
 * Reads the document's Firestore metadata.
 *
 * `undefined` means there is nothing here to look up related summaries with and nothing to write a
 * summary record from: a path that is not a document path, a missing document, or the incomplete
 * context that personal documents have.
 *
 * `offeringId` is normalized because it is optional on a metadata document while the `summaries`
 * record stores it unconditionally, and `undefined` cannot be written to Firestore.
 */
export async function readDocumentMetadata(firestoreDocumentPath: string): Promise<DocumentMetadata | undefined> {
  // `{root}/{space}/documents/{docId}`, as built by on-analyzable-doc-written.
  const segments = firestoreDocumentPath.split("/");
  if (segments.length !== 4 || segments[2] !== "documents") {
    logger.warn(`Not a document path, skipping related summaries and the summary record: ${firestoreDocumentPath}`);
    return undefined;
  }
  const [root, space] = segments;

  const db = new Firestore();
  const document = await db.doc(firestoreDocumentPath).get();
  if (!document.exists) {
    logger.warn(`Document ${firestoreDocumentPath} does not exist`);
    return undefined;
  }
  const { key, context_id, unit, problem, investigation, offeringId } = document.data()!;
  logger.info("Document data", { key, context_id, unit, problem, investigation });

  // Typed, not just present: `getSummaryPath` escapes the key with a string method, so a non-string
  // throws where every other bad value skips. Clients can write metadata documents directly in the
  // open realms, and `onCommentRated` guards the same field the same way.
  if (typeof key !== "string" || !key) {
    logger.warn(`Document ${firestoreDocumentPath} has no usable key; skipping the summary record.`);
    return undefined;
  }

  if (!context_id || !unit || !problem || !investigation) {
    logger.info("Skipping related summary lookup. " +
      "Document doesn't have a complete context for finding related summaries. " +
      "Personal documents don't have this context. ");
    return undefined;
  }

  return {
    root,
    space,
    key,
    context_id,
    unit,
    problem,
    investigation,
    offeringId: typeof offeringId === "string" ? offeringId : "",
  };
}

/**
 * Finds summaries of similar documents that carry agreements, within the same realm.
 *
 * The caller supplies the query vector because the same embedding is stored on this document's own
 * summary record, and one analysis run should pay OpenAI for it once.
 */
export async function findRelatedSummaries(
  metadata: DocumentMetadata, queryVector: number[]
): Promise<RelatedSummary[]> {
  const db = new Firestore();
  const { root, space, key, context_id, unit, problem, investigation } = metadata;

  // lookup related documents based on summary embedding that have ai agreements
  const query: VectorQuery = db.collection('summaries')
    .where("root", "==", root)
    .where("space", "==", space)
    .where("key", "!=", key)
    .where("numAiAgreements", ">", 0)
    .where("context_id", "==", context_id)
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("investigation", "==", investigation)
    .findNearest({
      vectorField: "summaryEmbedding",
      queryVector: FieldValue.vector(queryVector),
      limit: 5,
      distanceMeasure: "EUCLIDEAN",
    });
  const snapshot = await query.get();
  return mapRelatedSummaries(snapshot.docs.map((doc) => doc.data() as RelatedSummarySource));
}

/**
 * Which stored agreements are allowed to reach the prompt.
 *
 * Rules validate rating values in `authed` only, and version-1 entries were stored with no value
 * check, so an out-of-enum value can already be in the collection — and `summaryContentParts` would
 * copy it into the prompt as a label. Ratings on peer comments are recorded with
 * `isAiComment: false` and deliberately not prompted yet.
 */
function isPromptableAgreement(entry: AiAgreement): boolean {
  if (!kRatingValues.includes(entry.value)) return false;
  return isAiAgreement(entry);
}

/**
 * Maps the documents found by the related-summaries search into the entries injected into the AI
 * prompt. A document with an empty `aiAgreements` map still yields an entry; only a missing map is
 * skipped. A document whose entries are all filtered out by `isPromptableAgreement` is the same
 * case as an empty map. Exported for unit testing.
 */
export function mapRelatedSummaries(docs: RelatedSummarySource[]): RelatedSummary[] {
  const relatedSummaries: RelatedSummary[] = [];
  for (const data of docs) {
    if (data.aiAgreements && typeof data.summary === "string" && data.summary.length > 0) {
      const agreements = Object.values(data.aiAgreements)
        .filter(isPromptableAgreement)
        .reduce<Agreements>((acc, cur) => {
          const value = cur.value;
          acc[value] = acc[value] || [];
          acc[value].push({content: cur.content, tags: cur.tags});
          return acc;
        }, {});
      relatedSummaries.push({
        summary: data.summary,
        agreements,
      });
    }
  }
  return relatedSummaries;
}

/**
 * What a categorization request resolves to.
 *
 * Taken from `categorizeUrl` rather than written as `ChatCompletion`, which is the unparsed shape:
 * it has no `parsed` field, and naming the parsed one directly would mean restating the generic
 * that `categorizationResponseFormat` already fixes, in a form that a future SDK could quietly
 * change out from under the caller.
 */
type ParsedCompletion = NonNullable<Awaited<ReturnType<typeof categorizeUrl>>>;

/**
 * One request's shape together with the representations that shape guarantees are there. Decided
 * once, so the shape reported to the caller and the messages actually built cannot disagree, and
 * so each builder gets its strings without a non-null assertion.
 */
type AnalysisRequest =
  | { shape: "mixed"; summary: string; imageUrl: string }
  | { shape: "summary-only"; summary: string }
  | { shape: "image-only"; imageUrl: string };

/** Which of the two representations a request carried. Recorded on the `done` queue record. */
export type AnalysisMessageShape = AnalysisRequest["shape"];

/** What is being sent to the model. `null` means "not being sent", not "does not exist". */
export interface DocumentRepresentations {
  summary: string | null;
  imageUrl: string | null;
}

/**
 * Test seam. Production callers pass nothing.
 *
 * These are called through same-module bindings, so exporting them and spying on the exports does
 * not intercept the internal calls once ts-jest has compiled the module. Injecting them is the
 * honest way to let a test stand in for them. Every dependency that would reach Firestore or the
 * network needs an entry, or a test that replaces one of them still reaches out through another.
 */
export interface CategorizeDeps {
  readDocumentMetadata: typeof readDocumentMetadata;
  getEmbeddings: typeof getEmbeddings;
  findRelatedSummaries: typeof findRelatedSummaries;
  createOpenAI: (apiKey: string) => OpenAI;
}

const defaultCategorizeDeps: CategorizeDeps = {
  readDocumentMetadata,
  getEmbeddings,
  findRelatedSummaries,
  createOpenAI: (apiKey: string) => new OpenAI({apiKey}),
};

/**
 * What one categorization run produced.
 *
 * `summaryEmbedding` and `documentMetadata` serve the caller's summary write rather than the
 * evaluation: the queue record carries a path, not the document's fields, so the caller has no
 * metadata of its own. Both must be present for a record to be written.
 */
export interface CategorizeResult {
  completion: ParsedCompletion | undefined;
  messageShape: AnalysisMessageShape;
  summaryEmbedding: number[] | undefined;
  documentMetadata: DocumentMetadata | undefined;
}

/**
 * Sends one request carrying whatever representations the document produced.
 *
 * There is one builder per shape and they all live in shared/ai-analysis-messages, so this
 * function and the evaluation harness construct byte-identical requests. An image-only request is
 * built with the mixed builder and a null summary, which produces the same message
 * `buildImageMessages` would: "image only because the text was omitted" then stays on one code
 * path rather than becoming a second one that can drift.
 */
export async function categorizeRepresentations(
  representations: DocumentRepresentations,
  apiKey: string,
  firestoreDocumentPath: string,
  aiPrompt = defaultAiPrompt,
  deps: CategorizeDeps = defaultCategorizeDeps
): Promise<CategorizeResult> {
  const { summary, imageUrl } = representations;
  if (summary === null && imageUrl === null) {
    // The producer will not write such a record and the consumer turns empty values into this
    // case rather than passing them on, so reaching here means calling the model with a bare
    // prompt and paying for an answer about nothing.
    throw new Error("no representation to send");
  }
  // imageUrl is non-null in the last case: the check above returned when both were null.
  const request: AnalysisRequest =
    summary !== null && imageUrl !== null ?
      { shape: "mixed", summary, imageUrl } :
      summary !== null ?
        { shape: "summary-only", summary } :
        { shape: "image-only", imageUrl: imageUrl! };
  const messageShape = request.shape;
  logger.info(`Categorizing ${messageShape} for: ${firestoreDocumentPath}`);

  // Declared out here so both exits report them; an OpenAI failure is not a reason to lose them.
  let documentMetadata: DocumentMetadata | undefined;
  let summaryEmbedding: number[] | undefined;
  let relatedSummaries: RelatedSummary[] = [];

  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    // Only when a summary is being sent, so a document that receives agreement counts is always one
    // that can contribute them. Related summaries are enrichment and their absence costs the
    // evaluation nothing, so the three steps share one catch, and each step's failure stops the
    // ones after it.
    if (summary !== null) {
      try {
        documentMetadata = await deps.readDocumentMetadata(firestoreDocumentPath);
        if (documentMetadata) {
          // getEmbeddings resolves undefined on any OpenAI error, and neither use may see it: a
          // query vector of undefined throws from findNearest, and a stored one would persist as a
          // zero-dimension vector no search can find.
          summaryEmbedding = await deps.getEmbeddings(summary, apiKey);
          if (summaryEmbedding?.length) {
            relatedSummaries = await deps.findRelatedSummaries(documentMetadata, summaryEmbedding);
          } else {
            summaryEmbedding = undefined;
            logger.warn("no embedding for this summary, continuing without related summaries");
          }
        }
      } catch (error) {
        logger.warn("related summaries unavailable, continuing without them", error);
      }
    }

    // One builder per shape, over the shape decided above.
    const buildMessages = () => {
      switch (request.shape) {
      case "mixed":
        return buildMixedMessages(aiPrompt, request.summary, relatedSummaries, request.imageUrl);
      case "summary-only":
        return buildSummaryMessages(aiPrompt, request.summary, relatedSummaries);
      case "image-only":
        return buildMixedMessages(aiPrompt, null, [], request.imageUrl);
      }
    };
    const messages = buildMessages();

    const completion = await deps.createOpenAI(apiKey).chat.completions.parse({
      model: "gpt-4o-mini",
      messages,
      response_format: categorizationResponseFormat(responseSchema),
    });
    return { completion, messageShape, summaryEmbedding, documentMetadata };
  } catch (error) {
    console.log("OpenAI error", error);
    return { completion: undefined, messageShape, summaryEmbedding, documentMetadata };
  }
}

export async function getEmbeddings(input: string, apiKey: string) {
  const openai = new OpenAI({apiKey});
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error("OpenAI error", error);
    return undefined;
  }
}
