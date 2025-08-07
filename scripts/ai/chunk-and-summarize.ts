#!/usr/bin/env tsx

/**
 * Script to summarize large markdown documents using OpenAI completions API.
 * The document is chunked into smaller sections based on markdown headers, and each section is summarized.
 * The summaries are then combined into a single summary.
 *
 * Usage:
 *   export OPENAI_API_KEY=<your-api-key>
 *   npx tsx chunk-and-summarize.ts <input-file> [output-file]
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Load environment variables
dotenv.config();
const openai = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
});


// Types
interface ChunkSummary {
  chunkIndex: number;
  content: string;
  summary: string;
  tokenCount: number;
}

interface SummaryResult {
  finalSummary: string;
  chunkSummaries: ChunkSummary[];
  totalTokens: number;
  processingTime: number;
}

// Configuration
const CONFIG = {
  // Chunking settings.
  // gpt-4o-mini has a context window of 128,000 tokens, but we make chunks smaller than that.
  chunkSize: 64000, // characters per chunk

  // OpenAI settings
  model: 'gpt-4o-mini',
  maxTokens: 2000,
  temperature: 0.3,

  // Processing settings
  maxConcurrentRequests: 3, // limit concurrent API calls
  retryAttempts: 3,
  retryDelay: 1000, // ms
} as const;

// Utility functions
/**
 * Loads the contents of a file and returns it as a LangChain Document.
 * @param filename - The path to the file to load.
 * @returns A LangChain Document object containing the file contents.
 */
export function makeDocument(filename: string): Document {
  if (!fs.existsSync(filename)) {
    throw new Error(`File not found: ${filename}`);
  }
  const content = fs.readFileSync(filename, "utf8");
  return new Document({
    pageContent: content,
    metadata: {
      source: filename,
      filename: path.basename(filename),
      filepath: path.resolve(filename),
    },
  });
}

async function chunkText(text: Document, chunkSize: number): Promise<Document<Record<string, any>>[]> {
  const splitter = new MarkdownTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  return splitter.splitDocuments([text]);
}

async function summarizeChunk(
  chunk: Document,
  chunkIndex: number,
  totalChunks: number
): Promise<ChunkSummary> {

  const messages = [
    new SystemMessage(`You are a helpful assistant that analyzes and extracts themes from student work.`),
    new HumanMessage(`Student work part ${chunkIndex + 1} of ${totalChunks}:
     ${chunk.pageContent}\n
     Summarize the key points, themes, topics, main ideas, and important details in this student work.\n
     Summary:`),
  ];

  const response = await openai.invoke(messages);

  return {
    chunkIndex,
    content: chunk.pageContent,
    summary: response.content.toString(),
    tokenCount: response.usage_metadata?.total_tokens || 0,
  };
}

async function combineSummaries(chunkSummaries: ChunkSummary[]): Promise<string> {
  const summariesText = chunkSummaries
    .map((cs, index) => `## Section ${index + 1}:\n\n${cs.summary}`)
    .join('\n\n');

  const messages = [
    new SystemMessage(`You are a helpful assistant that combines summaries into a single cohesive summary.`),
    new HumanMessage(`These are summaries of important ideas found in several sets of student work.
      ${summariesText}\n
      Combine these into a single list of the key points, themes, topics, main ideas,
      and important details that were found.\n
      Summary:`),
  ];

  const response = await openai.invoke(messages);
  return response.content.toString();
}

async function processChunksWithConcurrency(
  chunks: Document[]
): Promise<ChunkSummary[]> {
  const results: ChunkSummary[] = [];
  const semaphore = new Array(CONFIG.maxConcurrentRequests).fill(null);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Wait for a semaphore slot to be available
    await new Promise(resolve => {
      const checkSlot = () => {
        const availableIndex = semaphore.findIndex(slot => slot === null);
        if (availableIndex !== -1) {
          semaphore[availableIndex] = i;
          resolve(undefined);
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });

    // Process the chunk
    const summary = await summarizeChunk(chunk, i, chunks.length);
    results.push(summary);

    // Release the semaphore slot
    const slotIndex = semaphore.findIndex(slot => slot === i);
    if (slotIndex !== -1) {
      semaphore[slotIndex] = null;
    }

    console.log(`Processed chunk ${i + 1}/${chunks.length}`);
  }

  return results.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

async function summarizeDocument(inputFile: string, outputFile?: string): Promise<SummaryResult> {
  const startTime = Date.now();

  // Read input file
  console.log(`Reading file: ${inputFile}`);
  const content = makeDocument(inputFile);

  // Chunk the document
  console.log('Chunking document...');
  const chunks = await chunkText(content, CONFIG.chunkSize);
  console.log(`Created ${chunks.length} chunks`);

  // Process chunks with concurrency control
  console.log('Summarizing chunks...');
  const chunkSummaries = await processChunksWithConcurrency(chunks);

  // Combine summaries
  console.log('Combining summaries...');
  const finalSummary = await combineSummaries(chunkSummaries);

  // Calculate statistics
  const totalTokens = chunkSummaries.reduce((sum, cs) => sum + cs.tokenCount, 0);
  const processingTime = Date.now() - startTime;

  const result: SummaryResult = {
    finalSummary,
    chunkSummaries,
    totalTokens,
    processingTime,
  };

  // Write output
  const outputPath = outputFile || `${path.basename(inputFile, path.extname(inputFile))}_summary.md`;

  const outputContent = `# Document Summary

## Comprehensive Summary

${result.finalSummary}

## Processing Details

- **Input File**: ${inputFile}
- **Chunks Processed**: ${chunks.length}
- **Total Tokens**: ${result.totalTokens}
- **Processing Time**: ${(result.processingTime / 1000).toFixed(2)} seconds
- **Generated**: ${new Date().toISOString()}

## Individual Chunk Summaries

${result.chunkSummaries.map((cs, index) =>
  `### Section ${index + 1}\n\n${cs.summary}\n`
).join('\n')}
`;

  fs.writeFileSync(outputPath, outputContent);
  console.log(`Summary written to: ${outputPath}`);

  return result;
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx chunk-and-summarize.ts <input-file> [output-file]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx chunk-and-summarize.ts large-document.md');
    console.error('  npx tsx chunk-and-summarize.ts large-document.md summary.md');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1];

  // Validate input file
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' does not exist`);
    process.exit(1);
  }

  try {
    console.log('Starting document summarization...');
    const result = await summarizeDocument(inputFile, outputFile);

    console.log('\n=== Summary Complete ===');
    console.log(`Input file: ${inputFile}`);
    console.log(`Output file: ${outputFile || `${path.basename(inputFile, path.extname(inputFile))}_summary.md`}`);
    console.log(`Chunks processed: ${result.chunkSummaries.length}`);
    console.log(`Total tokens: ${result.totalTokens}`);
    console.log(`Processing time: ${(result.processingTime / 1000).toFixed(2)} seconds`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
