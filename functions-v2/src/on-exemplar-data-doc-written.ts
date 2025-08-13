import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {defineSecret} from "firebase-functions/params";
import {MarkdownTextSplitter} from "@langchain/textsplitters";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";

// When the scheduled task updates a document under /exemplars with new class content,
// this function will use an LLM to summarize the content.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const model = "gpt-4o-mini";

const exemplarDataDocPath = "{realm}/{realmId}/exemplars/{unit}/classes/{classId}";

// gpt-4o-mini has a context window of 128,000 tokens; 64,000 characters should only be about 16 to 20,000 tokens.
const chunkSize = 64000; // characters per chunk

const systemPrompt = "You are a helpful assistant that analyzes and extracts themes from student work.";

const summarizeChunkPrompt = "Summarize the key points, themes, topics, main ideas, " +
"and important details in this student work. Do not describe the structure of the documents, just the content.\n" +
"Summary:";

const combineSummariesPrompt = "These are summaries of important ideas found in several sets of student work.\n" +
      "Combine these into a single list of the key points, themes, topics, main ideas, " +
      "and important details that were found.\n\n";

interface SummarizeResult {
  chunkIndex: number;
  summary: string;
  tokenCount: number;
}

async function summarizeChunk(
  openai: ChatOpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<SummarizeResult> {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Student work part ${chunkIndex + 1} of ${totalChunks}:
     ${chunk}\n
     ${summarizeChunkPrompt}`),
  ];

  logger.info("Calling LLM to summarize chunk", chunkIndex);
  const response = await openai.invoke(messages);

  return {
    chunkIndex,
    summary: response.content.toString(),
    tokenCount: response.usage_metadata?.total_tokens || 0,
  };
}

async function combineSummaries(
  openai: ChatOpenAI,
  chunkSummaries: SummarizeResult[]
): Promise<SummarizeResult> {
  const summariesText = chunkSummaries
    .map((cs, index) => `## Section ${index + 1}:\n\n${cs.summary}`)
    .join("\n\n");

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(combineSummariesPrompt +
      summariesText +
      "\n\nSummary:"),
  ];

  logger.info("Calling LLM to combine summaries");
  const response = await openai.invoke(messages);

  const thisCallTokens = response.usage_metadata?.total_tokens || 0;
  const totalTokens = chunkSummaries.reduce((acc, cs) => acc + cs.tokenCount, thisCallTokens);

  return {
    chunkIndex: 0,
    summary: response.content.toString(),
    tokenCount: totalTokens,
  };
}

export const onExemplarDataDocWritten = onDocumentWritten(
  {
    document: exemplarDataDocPath,
    secrets: [openaiApiKey],
    maxInstances: 2,
    concurrency: 3,
  },
  async (event) => {
    if (!event.subject) {
      logger.error("No subject in event", event);
      return;
    }

    const content = event.data?.after.data();
    if (!content) {
      logger.info("exemplar data doc was deleted", event.subject);
      return;
    }

    if (content.fullContent && !content.summary) {
      const splitter = new MarkdownTextSplitter({chunkSize, chunkOverlap: 0});
      const chunks = await splitter.splitText(content.fullContent);

      const openai = new ChatOpenAI({
        model,
        apiKey: openaiApiKey.value(),
      });

      const summaries = await Promise.all(chunks.map(
        (chunk, index) => summarizeChunk(openai, chunk, index, chunks.length)));

      let overall: SummarizeResult;
      if (summaries.length > 1) {
        overall = await combineSummaries(openai, summaries);
      } else {
        overall = summaries[0];
      }

      // Make sure we write _something_ into the summary, to avoid infinte-looping this function.
      const summary = overall.summary || "No summary found";

      await event.data?.after.ref.update({
        summary,
        summaryTokenCount: overall.tokenCount,
      });

      logger.info("Summarized exemplar data doc", event.subject);
    } else {
      logger.info("Exemplar data doc already summarized", event.subject);
    }
  }
);
