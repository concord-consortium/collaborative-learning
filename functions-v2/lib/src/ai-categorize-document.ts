import OpenAI from "openai";
import fs from "node:fs/promises";
import * as logger from "firebase-functions/logger";
import {
  Firestore,
  FieldValue,
  VectorQuery
} from "@google-cloud/firestore";
import { AiAgreement, AiAgreementV2, isAiAgreement } from "../../src/summary-types";
import { IEvaluationRequestContext, kRatingValues } from "../../../shared/shared";
import {
  Agreements,
  PeerComment,
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
export type {
  AgreementInfo, Agreements, IAiPrompt, PeerComment, RelatedSummary
} from "../../../shared/ai-analysis-messages";

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
 * The module's Firestore client.
 *
 * Each `new Firestore()` opens its own gRPC channel and nothing closes it, and a warm container
 * reuses this module across invocations — so one per call becomes one per call that never goes
 * away. Created on first use rather than at import so that loading this module costs nothing.
 *
 * @return {Firestore} the shared client
 */
function firestoreClient(): Firestore {
  sharedFirestore ??= new Firestore();
  return sharedFirestore;
}
let sharedFirestore: Firestore | undefined;

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
  /** Where the unit, investigation and problem came from. Stored on the summary and `done` records. */
  contextSource: "document" | "request";
}

/**
 * Why a document yielded no metadata. The two are worth telling apart: a document with no class or
 * problem, and no request context to stand in for one, reports `no-context`, where `no-metadata`
 * means a document that should have been readable was not.
 */
export type MetadataGap = "no-context" | "no-metadata";

/** The document's metadata, or why there is none. Exactly one of the two is set. */
export type DocumentMetadataResult =
  | {metadata: DocumentMetadata; gap?: never}
  | {metadata?: never; gap: MetadataGap};

/**
 * Reads the document's Firestore metadata.
 *
 * A gap means there is nothing here to look up related summaries with and nothing to write a
 * summary record from.
 *
 * `offeringId` is normalized because it is optional on a metadata document while the `summaries`
 * record stores it unconditionally, and `undefined` cannot be written to Firestore.
 *
 * `requestContext` stands in for the curriculum fields of a personal document, which has none of
 * its own. It is ignored for every other kind of document.
 */
export async function readDocumentMetadata(
  firestoreDocumentPath: string, requestContext?: IEvaluationRequestContext
): Promise<DocumentMetadataResult> {
  // `{root}/{space}/documents/{docId}`, as built by on-analyzable-doc-written.
  const segments = firestoreDocumentPath.split("/");
  if (segments.length !== 4 || segments[2] !== "documents") {
    logger.warn(`Not a document path, skipping related summaries and the summary record: ${firestoreDocumentPath}`);
    return {gap: "no-metadata"};
  }
  const [root, space] = segments;

  const db = firestoreClient();
  const document = await db.doc(firestoreDocumentPath).get();
  if (!document.exists) {
    logger.warn(`Document ${firestoreDocumentPath} does not exist`);
    return {gap: "no-metadata"};
  }
  const { key, type, context_id, unit, problem, investigation, offeringId } = document.data()!;
  logger.info("Document data", { key, type, context_id, unit, problem, investigation });

  // Typed, not just present: `getSummaryPath` escapes the key with a string method, so a non-string
  // throws where every other bad value skips. Clients can write metadata documents directly in the
  // open realms, and `onCommentRated` guards the same field the same way.
  if (typeof key !== "string" || !key) {
    logger.warn(`Document ${firestoreDocumentPath} has no usable key; skipping the summary record.`);
    return {gap: "no-metadata"};
  }

  // A personal document's record has no curriculum fields, so the request is its only context.
  // "personal" is `PersonalDocument` in src/models/document/document-types.ts.
  const fromRequest = type === "personal" ? requestContext : undefined;
  const filledUnit = unit || fromRequest?.unit;
  const filledProblem = problem || fromRequest?.problem;
  const filledInvestigation = investigation || fromRequest?.investigation;
  const filledOfferingId = offeringId || fromRequest?.offeringId;
  // `offeringId` does not count towards this: the lookup does not filter on it.
  const filledFromRequest = !!fromRequest && (!unit || !problem || !investigation);

  if (!context_id || !filledUnit || !filledProblem || !filledInvestigation) {
    logger.info("Skipping related summary lookup. " +
      "Document doesn't have a complete context for finding related summaries, " +
      "and the evaluation request didn't supply one. ");
    return {gap: "no-context"};
  }

  return {metadata: {
    root,
    space,
    key,
    context_id,
    unit: filledUnit,
    problem: filledProblem,
    investigation: filledInvestigation,
    offeringId: typeof filledOfferingId === "string" ? filledOfferingId : "",
    contextSource: filledFromRequest ? "request" : "document",
  }};
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
  const db = firestoreClient();
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
  const {relatedSummaries, stats} =
    mapRelatedSummaries(snapshot.docs.map((doc) => doc.data() as RelatedSummarySource));
  // Counts only, in every environment: what people wrote about each other must not reach the logs.
  logger.info("Related summaries found", {found: snapshot.docs.length, stats});
  return relatedSummaries;
}

/**
 * The most rated human comments one related document may contribute.
 *
 * A cap so that one heavily discussed document cannot crowd everything else out of the prompt.
 */
const kMaxPeerCommentsPerSummary = 10;

/**
 * Whether an entry's rating value is one the app can produce.
 *
 * Rules validate rating values in `authed` only, and version-1 entries were stored with no value
 * check, so an out-of-enum value can already be in the collection — and the prompt would copy it in
 * as a label. Every entry that reaches the prompt, by either route below, passes this first.
 */
function hasValidValue(entry: AiAgreement): boolean {
  return kRatingValues.includes(entry.value);
}

/**
 * Whether an entry records a rating of a comment a person wrote.
 *
 * Only a version-2 entry can be one: a version-1 entry records agreement with the AI's summary by
 * construction (see `summary-types`). Narrowing to that version is also what lets the grouping
 * below read `commentId` and `raterUid`, which version 1 does not carry.
 *
 * `=== false` rather than "not true", matching `isAiAgreement`: an entry whose `isAiComment` is
 * neither boolean belongs to neither group, so a malformed record is left out of the prompt rather
 * than having its text sent as somebody's comment.
 */
function isPeerEntry(entry: AiAgreement): entry is AiAgreementV2 {
  return entry.version === 2 && entry.isAiComment === false;
}

/**
 * Whether a comment's ratings earn it a place in the prompt.
 *
 * True for every comment as written, because a comment is only grouped when somebody rated it. It
 * is a named function because a stricter rule — a majority of `yes`, say — would go here and
 * nowhere else.
 */
function qualifiesForPrompt(comment: PeerComment): boolean {
  return Object.values(comment.ratings).some((count) => count > 0);
}

/** How many people rated a comment, across all values. */
function totalRatings(comment: PeerComment): number {
  return Object.values(comment.ratings).reduce((sum, count) => sum + count, 0);
}

/**
 * When a rating was made, treating a missing time as the beginning of time.
 *
 * `updatedAt` is required on the type but these entries are read back from Firestore, where one can
 * lack it; `onCommentRated` guards the same field the same way before moving a timestamp forwards.
 * Without the default, a single entry missing the field makes every comparison in its group false,
 * and the choice below falls back to the order the entries came out of the map — which is the thing
 * the tie-break exists to prevent.
 */
function ratedAt(entry: AiAgreementV2): number {
  return entry.updatedAt ?? 0;
}

/**
 * Turns one document's peer entries into one record per comment.
 *
 * An entry is per rater, so a comment three people rated arrives as three entries carrying three
 * copies of its text — and the copies can differ, since each was captured when that person rated.
 * One entry supplies the text and tags: the one with the latest `updatedAt`, ties broken by the
 * lower `raterUid`.
 *
 * That rule gives a stable choice, not the newest wording, and the stored data cannot give the
 * newest wording: `onCommentRated` bumps an existing rater's `updatedAt` to the current event's
 * time while leaving that rater's older text in place, so two entries can hold the same timestamp
 * and different wording.
 */
function groupPeerComments(entries: AiAgreementV2[]): PeerComment[] {
  const byCommentId = new Map<string, AiAgreementV2[]>();
  for (const entry of entries) {
    const group = byCommentId.get(entry.commentId);
    if (group) {
      group.push(entry);
    } else {
      byCommentId.set(entry.commentId, [entry]);
    }
  }

  return Array.from(byCommentId, ([commentId, group]) => {
    const ratings: PeerComment["ratings"] = {};
    for (const entry of group) {
      ratings[entry.value] = (ratings[entry.value] ?? 0) + 1;
    }
    const source = group.reduce((best, entry) =>
      ratedAt(entry) > ratedAt(best) ||
        (ratedAt(entry) === ratedAt(best) && entry.raterUid < best.raterUid) ? entry : best);
    return {
      commentId,
      commentUid: source.commentUid,
      content: source.content,
      tags: source.tags,
      ratings,
      // The chosen entry holds the latest timestamp, so this is the latest among the ratings.
      updatedAt: ratedAt(source),
    };
  });
}

/**
 * Orders comments by how much of the class stood behind them and keeps the first
 * `kMaxPeerCommentsPerSummary`.
 *
 * `commentId` is the last sort key so that the same stored entries always send the same comments.
 * Without it the cut would follow whatever order the entries came out of the map in.
 */
function selectPeerComments(comments: PeerComment[]): PeerComment[] {
  return comments
    .filter(qualifiesForPrompt)
    .sort((a, b) =>
      (b.ratings.yes ?? 0) - (a.ratings.yes ?? 0) ||
      totalRatings(b) - totalRatings(a) ||
      (a.commentId < b.commentId ? -1 : a.commentId > b.commentId ? 1 : 0))
    .slice(0, kMaxPeerCommentsPerSummary);
}

/**
 * How many entries one related document contributed at each stage of selection.
 *
 * Reported because nothing downstream can recover it: once the prompt is built, everything that
 * was filtered out is gone.
 */
export interface RelatedSummaryStats {
  /** Entries stored in the document's `aiAgreements` map. */
  storedEntries: number;
  /** Of those, ratings of the AI's comments carrying a usable value. */
  aiEntries: number;
  /** Of those, ratings of people's comments carrying a usable value. */
  peerEntries: number;
  /** Distinct comments those peer entries describe. */
  peerComments: number;
  /** Comments left after `qualifiesForPrompt` and the cap. */
  sent: number;
}

/**
 * Maps the documents found by the related-summaries search into the entries injected into the AI
 * prompt, and counts what each one contributed. A document with an empty `aiAgreements` map still
 * yields an entry; only a missing map is skipped. A document whose entries are all filtered out is
 * the same case as an empty map. `stats` has one element per returned entry, in the same order.
 * Exported for unit testing.
 */
export function mapRelatedSummaries(
  docs: RelatedSummarySource[]
): {relatedSummaries: RelatedSummary[]; stats: RelatedSummaryStats[]} {
  const relatedSummaries: RelatedSummary[] = [];
  const stats: RelatedSummaryStats[] = [];
  for (const data of docs) {
    if (data.aiAgreements && typeof data.summary === "string" && data.summary.length > 0) {
      const storedEntries = Object.values(data.aiAgreements);
      const valid = storedEntries.filter(hasValidValue);
      const aiEntries = valid.filter(isAiAgreement);
      const peerEntries = valid.filter(isPeerEntry);
      const agreements = aiEntries.reduce<Agreements>((acc, cur) => {
        const value = cur.value;
        acc[value] = acc[value] || [];
        acc[value].push({content: cur.content, tags: cur.tags});
        return acc;
      }, {});
      const peerComments = groupPeerComments(peerEntries);
      const sent = selectPeerComments(peerComments);
      relatedSummaries.push({
        summary: data.summary,
        agreements,
        peerComments: sent,
      });
      stats.push({
        storedEntries: storedEntries.length,
        aiEntries: aiEntries.length,
        peerEntries: peerEntries.length,
        peerComments: peerComments.length,
        sent: sent.length,
      });
    }
  }
  return {relatedSummaries, stats};
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
  /** Set when `documentMetadata` is not: why the read produced nothing. */
  metadataGap: MetadataGap | undefined;
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
  requestContext?: IEvaluationRequestContext,
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
  let metadataGap: MetadataGap | undefined;
  let summaryEmbedding: number[] | undefined;
  let relatedSummaries: RelatedSummary[] = [];

  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    // Only when a summary is being sent, so a document that receives agreement counts is always one
    // that can contribute them. Related summaries are enrichment: their absence costs the
    // evaluation nothing.
    if (summary !== null) {
      try {
        ({metadata: documentMetadata, gap: metadataGap} =
          await deps.readDocumentMetadata(firestoreDocumentPath, requestContext));
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
    return { completion, messageShape, summaryEmbedding, documentMetadata, metadataGap };
  } catch (error) {
    console.log("OpenAI error", error);
    return { completion: undefined, messageShape, summaryEmbedding, documentMetadata, metadataGap };
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
