import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {z} from "zod";
import fs from "node:fs/promises";
import * as logger from "firebase-functions/logger";
import {
  Firestore,
  FieldValue,
  VectorQuery
} from "@google-cloud/firestore";
import { AiAgreement } from "../../src/on-document-summarized";
import { AgreementValue } from "../../../shared/shared";

interface IAiPrompt {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription?: string;
  categories?: string[];
  keyIndicatorsPrompt?: string;
  discussionPrompt?: string;
}

interface AgreementInfo {
  content: string,
  tags: string[],
}
type Agreements = Record<AgreementValue, AgreementInfo[]>

interface RelatedSummary {
  summary: string;
  agreements: Agreements;
}

const defaultAiPrompt: IAiPrompt = {
  mainPrompt: `This is a picture of a student document.
They are working on engineering task. Please tell me which of the following areas of their design they are focusing on:
- user: who's it for?
- environment: where's it used?
- form: what's it look like?
- function: what does it do?
and why you chose that area.
Or if the document doesn't include enough content to clearly identify a focus area let me know by setting "category" to "unknown".
Your answer should be a JSON document in the given format.`,
  categorizationDescription: "Categorize the document based on its content.",
  categories: ["user", "environment", "form", "function"],
  keyIndicatorsPrompt: "What are the key indicators that support this categorization?",
  discussionPrompt: "Please provide any additional discussion or context regarding the categorization.",
  systemPrompt: "You are a teaching assistant in an engineering design course."
};

export async function categorizeDocument(file: string, apiKey: string) {
  const imageLoading = fs.readFile(file).then((data) => data.toString("base64"));
  const image = await imageLoading;
  const url = `data:image/png;base64,${image}`;
  return categorizeUrl(url, apiKey);
}

export function buildZodResponseSchema(aiPrompt: IAiPrompt) {
  const schema: Record<string, z.ZodType> = {};
  if (aiPrompt.categorizationDescription && aiPrompt.categories && aiPrompt.categories.length > 0) {
    schema.category = z.enum(["unknown", ...aiPrompt.categories!],
      {description: aiPrompt.categorizationDescription});
  }
  if (aiPrompt.keyIndicatorsPrompt) {
    schema.keyIndicators = z.array(z.string(), {description: aiPrompt.keyIndicatorsPrompt});
  }
  if (aiPrompt.discussionPrompt) {
    schema.discussion = z.string({description: aiPrompt.discussionPrompt});
  }
  return schema;
}

export function buildImageMessages(aiPrompt: IAiPrompt, url: string): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: aiPrompt.mainPrompt,
        },
        {
          type: "image_url",
          image_url: {
            url,
            detail: "auto", // auto, low, high
          },
        },
      ],
    },
  ];
}

export function buildSummaryMessages(aiPrompt: IAiPrompt, summary: string, relatedSummaries: RelatedSummary[]): ChatCompletionMessageParam[] {
  const userContent: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: aiPrompt.mainPrompt,
    },
    {
      type: "text",
      text: `This is the AI generated summary:\n${summary}`,
    },
  ];

  if (relatedSummaries.length > 0) {
    relatedSummaries.forEach((related) => {
      let text = `This is AI generated summary of a similar document:\n${related.summary}`;
      const agreementCounts = Object.entries(related.agreements)
        .map(([value, info]) => `${value}: ${info.length}`)
        .join(", ");
      if (agreementCounts.length > 0) {
        text += `\n\nOther users agreed with this summary as follows: ${agreementCounts}`;
      }
      userContent.push({
        type: "text",
        text,
      });
    });
  }

  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

export async function categorizeUrl(url: string, apiKey: string, aiPrompt = defaultAiPrompt) {
  logger.info("Categorizing url");
  const openai = new OpenAI({apiKey});
  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    return openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      // model: "gpt-4o-2024-08-06",
      messages: buildImageMessages(aiPrompt, url),
      response_format: zodResponseFormat(z.object(responseSchema), "categorization-response"),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
  }
}

export async function categorizeSummary(summary: string, apiKey: string, firestoreDocumentPath: string, aiPrompt = defaultAiPrompt) {
  logger.info(`Categorizing summary for: ${firestoreDocumentPath}`);
  const openai = new OpenAI({apiKey});
  try {
    const responseSchema = buildZodResponseSchema(aiPrompt);
    if (Object.keys(responseSchema).length === 0) {
      throw new Error("aiPrompt must specify at least one response field for the schema.");
    }

    // get the embeddings for the summary
    const embeddings = await getEmbeddings(summary, apiKey);

    // get the document to build the filters
    const db = new Firestore();
    const document = await db.doc(firestoreDocumentPath).get();
    if (!document.exists) {
      throw new Error(`Document ${firestoreDocumentPath} does not exist`);
    }
    const { key, context_id, unit, problem, investigation } = document.data()!;
    logger.info("Document data", { key, context_id, unit, problem, investigation });

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
    logger.info("relatedSummaries", relatedSummaries);

    return openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: buildSummaryMessages(aiPrompt, summary, relatedSummaries),
      response_format: zodResponseFormat(z.object(responseSchema), "categorization-response"),
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
