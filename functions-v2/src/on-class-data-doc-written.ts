import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
// Modular import: admin.firestore.FieldValue is undefined in the functions emulator.
import {FieldValue} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {MarkdownTextSplitter} from "@langchain/textsplitters";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {getUnitSummary} from "../../shared/get-unit-summary";
import {buildSummaryPrompt, IClassSummaryPrompts} from "../../shared/class-summary-prompts";
import {
  fencedUnitContext, formatUnitSummarySlice, unitSummarySlice, withCurriculumInstructions,
} from "../../shared/unit-summary-slice";

// When the scheduled task updates a document under /aicontent with new class content,
// this function will use an LLM to summarize the content.

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const model = "gpt-4o-mini";

const classDataDocPath = "{realm}/{realmId}/aicontent/{unit}/classes/{classId}";

// gpt-4o-mini has a context window of 128,000 tokens; 64,000 characters should only be about 16 to 20,000 tokens.
const chunkSize = 64000; // characters per chunk

const systemPrompt = "You are a helpful assistant teacher that analyzes and extracts themes from student work.";

// Held apart from its trailing cue so an authored addition lands before "Summary:" rather than
// after it, where the model reads it as the start of the answer instead of as an instruction.
const summarizeStudentContentInstruction =
  "Summarize the key points, themes, topics, main ideas, and important details in this student work. " +
  "Do not describe the structure of the documents, just the content.";

const summaryCue = "Summary:";

const combineSummariesPrompt = "These are summaries of important ideas found in several sets of student work.\n" +
  "Combine these into a single list of the key points, themes, topics, main ideas, " +
  "and important details that were found.\n\n";

const summarizeTeacherContentPrompt =
  "Analyze this teacher work, looking for and summarizing information about what the class is interested " +
  "in and any important themes and topics that will help with providing relevant examples later. " +
  "Do not describe the structure of the documents, just the content.\n" +
  "Summary:";

function unitContextSection(unitContext: string): string {
  return fencedUnitContext(unitContext, "the class");
}

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
  role: "student" | "teacher",
  unitContext: string | undefined,
  prompts: IClassSummaryPrompts | undefined
): Promise<SummarizeResult> {
  const capRole = role.charAt(0).toUpperCase() + role.slice(1);
  const contextPrefix = unitContext ? `${unitContextSection(unitContext)}\n\n` : "";
  const instruction = role === "teacher"
    ? summarizeTeacherContentPrompt
    : buildSummaryPrompt(summarizeStudentContentInstruction, summaryCue, prompts);
  const messages = [
    new SystemMessage(withCurriculumInstructions(systemPrompt, "the class")),
    new HumanMessage(`${contextPrefix}${capRole} work part ${chunkIndex + 1} of ${totalChunks}:
     ${chunk}\n
     ${instruction}`),
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
  chunkSummaries: SummarizeResult[],
  unitContext: string | undefined,
  prompts: IClassSummaryPrompts | undefined
): Promise<SummarizeResult> {
  const summariesText = chunkSummaries
    .map((cs, index) => `## Section ${index + 1}:\n\n${cs.summary}`)
    .join("\n\n");
  const contextPrefix = unitContext ? `${unitContextSection(unitContext)}\n\n` : "";

  // An authored addition is repeated here so it still applies once the chunk summaries are merged;
  // without it, this call flattens a steered summary back into generic themes. A replacement is
  // deliberately not carried over: it is written to be applied to student work, and this call is
  // given summaries of it.
  const addition = prompts?.appendToStudentPrompt?.trim();
  const combineInstruction = addition
    ? `${combineSummariesPrompt}${addition}\n\n`
    : combineSummariesPrompt;

  const messages = [
    new SystemMessage(withCurriculumInstructions(systemPrompt, "the class")),
    new HumanMessage(contextPrefix +
      combineInstruction +
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

      // Fail closed: any doubt (no currentProblemOrdinal, no fetched summary, no slice for this
      // ordinal) leaves unitContext undefined, and every call below still runs -- just without
      // curriculum context. The instructions themselves are unconditional
      // (withCurriculumInstructions), so their absence never depends on this succeeding. The
      // authored prompts fail closed the same way: unresolved means the built-in prompt runs.
      let unitContext: string | undefined;
      let classSummaryPrompts: IClassSummaryPrompts | undefined;
      try {
        // Fetched whether or not the class has a current problem, because a unit-level prompt
        // applies either way; only the context slice needs the ordinal.
        const unitSummaryResult = await getUnitSummary(event.params.unit);
        if (unitSummaryResult) {
          if (content.currentProblemOrdinal) {
            const slice = unitSummarySlice(
              unitSummaryResult.summary, unitSummaryResult.liveProblems, content.currentProblemOrdinal
            );
            unitContext = slice && formatUnitSummarySlice(slice);
          }
          classSummaryPrompts = (content.currentProblemOrdinal &&
            unitSummaryResult.classSummaryPrompts.byProblemOrdinal[content.currentProblemOrdinal]) ||
            unitSummaryResult.classSummaryPrompts.unit;
        }
      } catch (error) {
        logger.warn("unit summary unavailable, continuing without it", error);
      }

      const splitter = new MarkdownTextSplitter({chunkSize, chunkOverlap: 0});
      const chunks = await splitter.splitText(content.studentContent);
      const studentSummaries = await Promise.all(chunks.map(
        (chunk, index) => summarizeChunk(
          openai, chunk, index, chunks.length, "student", unitContext, classSummaryPrompts)));

      let studentSummary: SummarizeResult;
      if (studentSummaries.length > 1) {
        studentSummary = await combineSummaries(openai, studentSummaries, unitContext, classSummaryPrompts);
      } else {
        studentSummary = studentSummaries[0];
      }

      let teacherSummary: SummarizeResult;
      if (content.teacherContent && !content.teacherSummary) {
        // The teacher half keeps its built-in prompt; classSummaryPrompts steers student work only.
        teacherSummary = await summarizeChunk(
          openai, content.teacherContent, 0, 1, "teacher", unitContext, undefined);
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
        summaryCreatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Summarized the class work into the data doc", event.subject);
    } else {
      logger.info("Class data doc already summarized", event.subject);
    }
  }
);
