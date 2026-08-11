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
  buildSummaryMessages,
  buildZodResponseSchema,
  categorizationResponseFormat,
  defaultAiPrompt
} from "../../../shared/ai-analysis-messages";

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
  const relatedSummaries: RelatedSummary[] = [];
  snapshot.forEach((doc) => {
    const aiAgreements: Record<AgreementValue, AiAgreement> = doc.data().aiAgreements || undefined;
    if (aiAgreements) {
      const agreements = Object.values(aiAgreements).reduce<Agreements>((acc, cur) => {
        const value = cur.value as AgreementValue;
        acc[value] = acc[value] || [];
        acc[value].push({content: cur.content, tags: cur.tags});
        return acc;
      }, {} as Agreements);
      relatedSummaries.push({
        summary,
        agreements,
      });
    }
  });
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
