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
 * Which stored agreements are allowed to reach the prompt.
 *
 * Two conditions. The value has to be one the app can actually produce. Firestore rules check that
 * in the `authed` and `qa` realms, but `demo` and `dev` let any signed-in user write anything, and
 * values stored before those rules were tightened are still there. `summaryContentParts` builds its
 * agreement sentence out of the keys of the record this function feeds, so an unrecognized value
 * would otherwise be copied into the prompt verbatim as a label.
 *
 * And the agreement has to be with an AI comment. A rating on another student's comment is stored
 * with `isAiComment: false` and is deliberately held back from the prompt for now.
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

export async function categorizeSummary(summary: string, apiKey: string, firestoreDocumentPath: string, aiPrompt = defaultAiPrompt) {
  logger.info(`Categorizing summary for: ${firestoreDocumentPath}`);
  const openai = new OpenAI({apiKey});
  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    const relatedSummaries = await findRelatedSummaries(summary, apiKey, firestoreDocumentPath);
    logger.info("relatedSummaries", relatedSummaries);

    return openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: buildSummaryMessages(aiPrompt, summary, relatedSummaries),
      response_format: categorizationResponseFormat(responseSchema),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
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
