import {Timestamp} from "firebase-admin/firestore";
import {DocumentSnapshot} from "firebase-functions/v2/firestore";
import {aiContentResponse, buildSystemMessageText, isCachedContentUpToDate, PROMPT_POLICY_VERSION}
  from "../src/get-ai-content";
import {PROBLEM_APPROACH_INSTRUCTION, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION}
  from "../../shared/unit-summary-types";

// isCachedContentUpToDate and buildSystemMessageText are pure functions over plain data, so these
// are mocked-Firestore tests: fake DocumentSnapshot-shaped objects, no emulator involved.
function fakeSnapshot(exists: boolean, data?: Record<string, unknown>): DocumentSnapshot {
  return {exists, data: () => data} as unknown as DocumentSnapshot;
}

// The composed prompt carries the class and teacher summaries, which firestore.rules lets only
// teachers read, and the caller names which contexts go into it. A response that echoed the prompt
// would let any student ask for the class summary and read it back.
describe("aiContentResponse", () => {
  it("never carries the prompt it was built from", () => {
    const response = aiContentResponse({
      text: "an answer", clientRequestHash: "abc", lastUpdated: 1, error: null,
    });
    expect(response).not.toHaveProperty("prompt");
    expect(Object.keys(response).sort())
      .toEqual(["clientRequestHash", "error", "lastUpdated", "text"]);
  });

  it("reports no hash rather than undefined, so a caller can tell it was absent", () => {
    expect(aiContentResponse({text: "an answer", error: null}).clientRequestHash).toBeNull();
  });
});

describe("isCachedContentUpToDate", () => {
  const prompt = "the tile prompt";
  const lastUpdated = Timestamp.fromMillis(1000);

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

  // A regenerated class summary reaches this through the prompt, because the summary it changed
  // is inside the composed prompt whenever it was asked for. A prompt that never named class work
  // keeps its answer, rather than paying to rebuild a byte-identical one.
  it("regenerates for a prompt holding a summary that has since changed", () => {
    const withOldSummary = contentSnapshot({prompt: "context: old class summary\n\nthe question"});
    expect(isCachedContentUpToDate("context: new class summary\n\nthe question", withOldSummary))
      .toBe(false);
  });

  it("reuses the cache for a prompt that names no class work, whatever the class has done", () => {
    expect(isCachedContentUpToDate(prompt, contentSnapshot())).toBe(true);
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

