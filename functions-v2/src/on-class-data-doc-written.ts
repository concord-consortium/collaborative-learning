import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {MarkdownTextSplitter} from "@langchain/textsplitters";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";

// When the scheduled task updates a document under /aicontent with new class content,
// this function will use an LLM to summarize the content.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const model = "gpt-4o-mini";

const classDataDocPath = "{realm}/{realmId}/aicontent/{unit}/classes/{classId}";

// gpt-4o-mini has a context window of 128,000 tokens; 64,000 characters should only be about 16 to 20,000 tokens.
const chunkSize = 64000; // characters per chunk

const systemPrompt = "You are a helpful assistant teacher that analyzes and extracts themes from student work.";

const summarizeStudentContentPrompt =
  "Summarize the key points, themes, topics, main ideas, and important details in this student work. " +
  "Do not describe the structure of the documents, just the content.\n" +
  "Summary:";

const combineSummariesPrompt = "These are summaries of important ideas found in several sets of student work.\n" +
  "Combine these into a single list of the key points, themes, topics, main ideas, " +
  "and important details that were found.\n\n";

const summarizeTeacherContentPrompt =
  "Analyze this teacher work, looking for and summarizing information about what the class is interested " +
  "in and any important themes and topics that will help with providing relevant examples later. " +
  "Do not describe the structure of the documents, just the content.\n" +
  "Summary:";
interface SummarizeResult {
  chunkIndex: number;
  summary: string;
  tokenCount: number;
}

async function summarizeChunk(
  openai: ChatOpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  role: "student" | "teacher"
): Promise<SummarizeResult> {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Student work part ${chunkIndex + 1} of ${totalChunks}:
     ${chunk}\n
     ${role === "teacher" ? summarizeTeacherContentPrompt : summarizeStudentContentPrompt}`),
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

export const onClassDataDocWritten = onDocumentWritten(
  {
    document: classDataDocPath,
    secrets: [openaiApiKey],
    maxInstances: 2, // Limit how many requests we are sending to OpenAI at once
    concurrency: 3,
  },
  async (event) => {
    if (!event.subject) {
      logger.error("No subject in event", event);
      return;
    }

    const content = event.data?.after.data();
    if (!content) {
      logger.info("Class data doc was deleted", event.subject);
      return;
    }

    if (content.studentContent && !content.studentSummary) {
      const openai = new ChatOpenAI({
        model,
        apiKey: openaiApiKey.value(),
      });

      const splitter = new MarkdownTextSplitter({chunkSize, chunkOverlap: 0});
      const chunks = await splitter.splitText(content.studentContent);
      const studentSummaries = await Promise.all(chunks.map(
        (chunk, index) => summarizeChunk(openai, chunk, index, chunks.length, "student")));

      let studentSummary: SummarizeResult;
      if (studentSummaries.length > 1) {
        studentSummary = await combineSummaries(openai, studentSummaries);
      } else {
        studentSummary = studentSummaries[0];
      }

      let teacherSummary: SummarizeResult;
      if (content.teacherContent && !content.teacherSummary) {
        teacherSummary = await summarizeChunk(openai, content.teacherContent, 0, 1, "teacher");
      } else {
        teacherSummary = {
          chunkIndex: 0,
          summary: "",
          tokenCount: 0,
        };
      }

      // Make sure we write _something_ into the student summary, to avoid infinite-looping this function.
      const summary = studentSummary.summary || "No summary found";

      await event.data?.after.ref.update({
        studentSummary: summary,
        teacherSummary: teacherSummary.summary,
        summaryTokenCount: studentSummary.tokenCount + teacherSummary.tokenCount,
        summaryCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Summarized the class work into the data doc", event.subject);
    } else {
      logger.info("Class data doc already summarized", event.subject);
    }
  }
);
