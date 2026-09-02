import OpenAI from "openai";
import fs from "node:fs/promises";
import * as logger from "firebase-functions/logger";
import {
  Firestore,
  FieldValue,
  VectorQuery
} from "@google-cloud/firestore";
import { AiAgreement } from "../../src/on-document-summarized";
import { AgreementValue } from "../../../shared/shared";
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

async function findRelatedSummaries(summary: string, apiKey: string, firestoreDocumentPath: string) {
  // get the document to build the filters
  const db = new Firestore();
  const document = await db.doc(firestoreDocumentPath).get();
  if (!document.exists) {
    throw new Error(`Document ${firestoreDocumentPath} does not exist`);
  }
  const { key, context_id, unit, problem, investigation } = document.data()!;
  logger.info("Document data", { key, context_id, unit, problem, investigation });

  if (!context_id || !unit || !problem || !investigation) {
    logger.info("Skipping related summary lookup. " +
      "Document doesn't have a complete context for finding related summaries. " +
      "Personal documents don't have this context. ");
    return [];
  }

  // get the embeddings for the summary
  const embeddings = await getEmbeddings(summary, apiKey);

  // lookup related documents based on summary embedding that have ai agreements
  const query: VectorQuery = db.collection('summaries')
    .where("key", "!=", key)
    .where("numAiAgreements", ">", 0)
    .where("context_id", "==", context_id)
    .where("unit", "==", unit)
    .where("problem", "==", problem)
    .where("investigation", "==", investigation)
    .findNearest({
      vectorField: "summaryEmbedding",
      queryVector: FieldValue.vector(embeddings),
      limit: 5,
      distanceMeasure: "EUCLIDEAN",
    });
  const snapshot = await query.get();
  return mapRelatedSummaries(snapshot.docs.map((doc) => doc.data() as RelatedSummarySource));
}

/**
 * Maps the documents found by the related-summaries search into the entries injected into the AI
 * prompt. A document with an empty `aiAgreements` map still yields an entry; only a missing map is
 * skipped. Exported for unit testing.
 */
export function mapRelatedSummaries(docs: RelatedSummarySource[]): RelatedSummary[] {
  const relatedSummaries: RelatedSummary[] = [];
  for (const data of docs) {
    if (data.aiAgreements && typeof data.summary === "string" && data.summary.length > 0) {
      const agreements = Object.values(data.aiAgreements).reduce<Agreements>((acc, cur) => {
        const value = cur.value as AgreementValue;
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
 * `findRelatedSummaries` is called through a same-module binding, so exporting it and spying on
 * the export does not intercept the internal call once ts-jest has compiled the module. Injecting
 * it is the honest way to let a test stand in for it.
 */
export interface CategorizeDeps {
  findRelatedSummaries: typeof findRelatedSummaries;
  createOpenAI: (apiKey: string) => OpenAI;
}

const defaultCategorizeDeps: CategorizeDeps = {
  findRelatedSummaries,
  createOpenAI: (apiKey: string) => new OpenAI({apiKey}),
};

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
): Promise<{ completion: ParsedCompletion | undefined; messageShape: AnalysisMessageShape }> {
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

  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    // Related summaries are enrichment, and their absence costs the evaluation nothing. The whole
    // lookup is inside the try, not just the embeddings call: getEmbeddings returns undefined on
    // error and FieldValue.vector(undefined) then throws from inside findRelatedSummaries.
    let relatedSummaries: RelatedSummary[] = [];
    if (summary !== null) {
      try {
        relatedSummaries = await deps.findRelatedSummaries(summary, apiKey, firestoreDocumentPath);
      } catch (error) {
        logger.warn("related summaries unavailable, continuing without them", error);
      }
    }

    // One builder per shape, over the shape decided above. The image-only case uses the mixed
    // builder with a null summary, as this function's comment explains.
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
    return { completion, messageShape };
  } catch (error) {
    console.log("OpenAI error", error);
    return { completion: undefined, messageShape };
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
