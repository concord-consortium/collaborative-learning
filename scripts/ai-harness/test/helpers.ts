import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { harnessRoot } from "../src/corpus.js";
import type { RunTask } from "../src/execute.js";
import { HarnessRequest, InputImageAccounting, requestKeyFor } from "../src/messages.js";
import { kRetries } from "../src/cost.js";
import type { ModelPricing, RunMeta } from "../src/schemas.js";

/** The repository root — two levels up from scripts/ai-harness. */
export const repoRoot = path.resolve(harnessRoot, "..", "..");

const testDataRoots: string[] = [];

// Registered once, when this module is first imported by a test file, rather than per call: some
// suites build their scratch directory inside a test body, and jest refuses a hook declared there.
// The guard is for `test:render`, which runs under tsx and has no jest globals at all.
if (typeof afterAll === "function") {
  afterAll(() => {
    if (process.env.KEEP_TEST_DATA) return;
    for (const directory of testDataRoots) fs.rmSync(directory, { recursive: true, force: true });
  });
}

/**
 * Scratch space for tests. It lives inside `data/` because nothing the harness generates is ever
 * written outside that (gitignored) tree.
 *
 * Removed again when the suite finishes, not merely at the start of the next run: a full corpus of
 * documents and rendered PNGs per suite, left on disk indefinitely, adds up. Set `KEEP_TEST_DATA=1`
 * to keep it for inspection after a failure.
 */
export function makeTestDataRoot(name: string): string {
  const directory = path.join(harnessRoot, "data", "test-runs", name);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  testDataRoots.push(directory);
  return directory;
}

export const testPricing: ModelPricing = {
  inputPerMTokUsd: 0.15,
  outputPerMTokUsd: 0.6,
  maxOutputTokens: 1024,
  imageTokens: {
    detailLowFlat: 2833,
    base: 2833,
    perTile: 5667,
    tileSize: 512,
    maxShortSide: 768,
    maxLongSide: 2048
  }
};

export const testRunMeta: RunMeta = {
  date: "2026-08-11T00:00:00.000Z",
  openaiSdkVersion: "6.45.0",
  gitCommit: "0000000000000000000000000000000000000000",
  gitDirty: false
};

export function makeRequest(text: string, maxCompletionTokens = 1024): HarnessRequest {
  return {
    apiRequest: {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a teaching assistant." },
        { role: "user", content: [{ type: "text", text }] }
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "categorization-response", strict: true, schema: { type: "object" } }
      },
      generationSettings: { max_completion_tokens: maxCompletionTokens }
    },
    inputAccounting: { images: [] }
  };
}

/** A request with one image part, the shape `buildImageRequest` produces. */
export function makeImageRequest(
  imageUrl: string, accounting: InputImageAccounting, maxCompletionTokens = 1024
): HarnessRequest {
  const base = makeRequest("Evaluate this.", maxCompletionTokens);
  return {
    apiRequest: {
      ...base.apiRequest,
      messages: [
        { role: "system", content: "You are a teaching assistant." },
        {
          role: "user",
          content: [
            { type: "text", text: "Evaluate this." },
            { type: "image_url", image_url: { url: imageUrl, detail: accounting.detail } }
          ]
        }
      ]
    },
    inputAccounting: { images: [accounting] }
  };
}

/**
 * A real, minimal PNG of the requested size, so tests can exercise the header reader, the freshness
 * checks and the image cost model without committing binary fixtures for every case.
 */
export function makeTestPng(widthPx: number, heightPx: number, fill = 0x40): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(widthPx, 0);
  header.writeUInt32BE(heightPx, 4);
  header[8] = 8;   // bit depth
  header[9] = 2;   // colour type: truecolour
  // Each scanline is a filter byte followed by three bytes per pixel.
  const raw = Buffer.alloc(heightPx * (1 + widthPx * 3), fill);
  for (let row = 0; row < heightPx; row += 1) raw[row * (1 + widthPx * 3)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// CRC32 is defined in terms of shifts and exclusive-or; writing it any other way would be an
// obfuscation rather than a clarification.
/* eslint-disable no-bitwise */
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
/* eslint-enable no-bitwise */

export function makeTask(docId: string, runId: string, text: string, worstCase = 0.01): RunTask {
  const request = makeRequest(text);
  return {
    docId,
    runId,
    run: { id: runId, message: "text-only", textVariant: "default", prompt: "categorize-design-default" },
    modality: "text-only",
    computedModality: "text-only",
    promptName: "categorize-design-default",
    promptSha256: "prompt-hash",
    aiPrompt: { systemPrompt: "You are a teaching assistant.", mainPrompt: "Evaluate this.", discussionPrompt: "?" },
    makeRequest: () => request,
    requestKey: requestKeyFor(request),
    worstCaseUsd: worstCase,
    retries: kRetries,
    representation: {
      kind: "text", variantId: "default", variantVersion: 1, sourceContentSha256: "0".repeat(64)
    },
    imageTokensEstimated: 0,
    hostedImages: []
  };
}

/**
 * Every file under `root`, as absolute paths, skipping `node_modules` and `.git`.
 *
 * `fs.readdirSync(root, { recursive: true })` walks those too, which for the harness root is tens of
 * thousands of entries and several seconds. This is for taking a before-and-after picture of what a
 * command wrote.
 *
 * A directory that disappears mid-walk is skipped rather than thrown on. Jest runs suites in
 * parallel workers, and every one of them removes its own scratch directory when it finishes — so
 * walking the harness root means walking a tree that other processes are actively deleting from. A
 * directory that has gone is not a file anyone wrote.
 */
export function listFilesUnder(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

/** Where `makeTestDataRoot` puts every suite's scratch directory. */
export const testRunsRoot = path.join(harnessRoot, "data", "test-runs");

export function readLines(file: string): unknown[] {
  return fs.readFileSync(file, "utf8").split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line));
}
