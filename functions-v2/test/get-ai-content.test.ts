import {Timestamp} from "firebase-admin/firestore";
import {DocumentSnapshot} from "firebase-functions/v2/firestore";
import {aiContentResponse, buildSystemMessageText, isCachedContentUpToDate, PROMPT_POLICY_VERSION,
  returnCachedContent} from "../src/get-ai-content";
import {buildRequestPrompt, classSummaryBlocks} from "../../shared/ai-context-tokens";
import {PROBLEM_APPROACH_INSTRUCTION, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION}
  from "../../shared/unit-summary-types";

// isCachedContentUpToDate, returnCachedContent and buildSystemMessageText are pure functions over
// plain data, so these are mocked-Firestore tests: fake DocumentSnapshot-shaped objects, no
// emulator involved.
function fakeSnapshot(exists: boolean, data?: Record<string, unknown>): DocumentSnapshot {
  return {exists, data: () => data} as unknown as DocumentSnapshot;
}

describe("aiContentResponse", () => {
  it("reports no hash rather than undefined, so a caller can tell it was absent", () => {
    expect(aiContentResponse({text: "an answer", error: null}).clientRequestHash).toBeNull();
  });
});

describe("returnCachedContent", () => {
  const summary = "Most of the class divided instead of subtracting.";
  const cached = (overrides?: Record<string, unknown>) => fakeSnapshot(true, {
    content: "an answer",
    prompt: `The class's work so far: ${summary}\n\nWhat should I try next?`,
    clientRequestHash: "hash-of-the-request-that-generated-this",
    lastUpdated: Timestamp.fromMillis(1000),
    ...overrides,
  });

  // The stored prompt holds the class and teacher summaries, which firestore.rules lets only
  // teachers read, and the caller names which of them go into it. Spreading the stored document
  // into the response would hand any student the class summary.
  it("returns no part of the prompt the answer was built from", () => {
    const response = returnCachedContent(cached());
    expect(Object.keys(response).sort())
      .toEqual(["clientRequestHash", "error", "lastUpdated", "text"]);
    expect(JSON.stringify(response)).not.toContain(summary);
  });

  it("echoes the caller's hash, so the client recognises the answer as its own", () => {
    expect(returnCachedContent(cached(), "my-own-hash"))
      .toMatchObject({clientRequestHash: "my-own-hash"});
  });

  // Waiting on another thread's lock. The answer belongs to the request that held the lock, and
  // the caller is given no hash to pass, so the stored one is what the client gets.
  it("falls back to the stored hash when the caller passes none", () => {
    expect(returnCachedContent(cached()))
      .toMatchObject({clientRequestHash: "hash-of-the-request-that-generated-this"});
  });
});

describe("isCachedContentUpToDate", () => {
  const prompt = "the tile prompt";
  const lastUpdated = Timestamp.fromMillis(1000);
  const question = "What should I try next?";

  function contentSnapshot(overrides?: Record<string, unknown>): DocumentSnapshot {
    return fakeSnapshot(true, {
      content: "cached text", prompt, promptPolicyVersion: PROMPT_POLICY_VERSION, lastUpdated, ...overrides,
    });
  }

  it("reuses the cache when the version and prompt match", () => {
    expect(isCachedContentUpToDate(prompt, contentSnapshot())).toBe(true);
  });

  it("regenerates when the cached promptPolicyVersion is older than the current one", () => {
    const content = contentSnapshot({promptPolicyVersion: PROMPT_POLICY_VERSION - 1});
    expect(isCachedContentUpToDate(prompt, content)).toBe(false);
  });

  // The literal 1, not PROMPT_POLICY_VERSION - 1, which would stop covering version 1 as soon as
  // the version advances again.
  it("regenerates a cache written under policy version 1", () => {
    const content = contentSnapshot({promptPolicyVersion: 1});
    expect(isCachedContentUpToDate(prompt, content)).toBe(false);
  });

  it("regenerates when promptPolicyVersion is absent (a cache written before this field existed)", () => {
    const content = contentSnapshot({promptPolicyVersion: undefined});
    expect(isCachedContentUpToDate(prompt, content)).toBe(false);
  });

  it("regenerates when the tile prompt text differs from the cached one", () => {
    const content = contentSnapshot({prompt: "a different prompt"});
    expect(isCachedContentUpToDate(prompt, content)).toBe(false);
  });

  // A changed class summary reaches the cache through the prompt, because the summary is inside
  // the composed prompt exactly when a token named it. These two build the real prompts rather
  // than standing in strings for them, so they fail if composition stops carrying the summary.
  it("regenerates when a summary the prompt named has since changed", () => {
    const cached = buildRequestPrompt(question, {}, ["classwork"], classSummaryBlocks({studentSummary: "old"}));
    const current = buildRequestPrompt(question, {}, ["classwork"], classSummaryBlocks({studentSummary: "new"}));
    expect(isCachedContentUpToDate(current, contentSnapshot({prompt: cached}))).toBe(false);
  });

  it("reuses the cache when the summary changed but no token named it", () => {
    const cached = buildRequestPrompt(question, {}, [], classSummaryBlocks({studentSummary: "old"}));
    const current = buildRequestPrompt(question, {}, [], classSummaryBlocks({studentSummary: "new"}));
    expect(isCachedContentUpToDate(current, contentSnapshot({prompt: cached}))).toBe(true);
  });
});

describe("buildSystemMessageText", () => {
  it("begins with the lookahead instruction regardless of systemPrompt", () => {
    expect(buildSystemMessageText("You are a pirate.").startsWith(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION)).toBe(true);
    expect(buildSystemMessageText(undefined).startsWith(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION)).toBe(true);
    expect(buildSystemMessageText("").startsWith(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION)).toBe(true);
  });

  it("carries the student-worded approach instruction regardless of systemPrompt", () => {
    expect(buildSystemMessageText("You are a pirate.")).toContain(PROBLEM_APPROACH_INSTRUCTION);
    expect(buildSystemMessageText(undefined)).toContain(PROBLEM_APPROACH_INSTRUCTION);
    expect(buildSystemMessageText("")).toContain(PROBLEM_APPROACH_INSTRUCTION);
  });

  it("falls back to the default persona when no systemPrompt is given", () => {
    expect(buildSystemMessageText(undefined)).toContain("You are a helpful, collaborative student.");
  });

  it("uses the author's systemPrompt when given, after both instructions", () => {
    const text = buildSystemMessageText("You are a pirate.");
    expect(text).toContain("You are a pirate.");
    expect(text.indexOf(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION)).toBeLessThan(text.indexOf("You are a pirate."));
    expect(text.indexOf(PROBLEM_APPROACH_INSTRUCTION)).toBeLessThan(text.indexOf("You are a pirate."));
    expect(text.indexOf(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION))
      .toBeLessThan(text.indexOf(PROBLEM_APPROACH_INSTRUCTION));
  });
});
