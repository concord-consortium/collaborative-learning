import {Timestamp} from "firebase-admin/firestore";
import {DocumentSnapshot} from "firebase-functions/v2/firestore";
import {buildSystemMessageText, isCachedContentUpToDate, PROMPT_POLICY_VERSION} from "../src/get-ai-content";
import {PROBLEM_APPROACH_INSTRUCTION, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION}
  from "../../shared/unit-summary-types";

// isCachedContentUpToDate and buildSystemMessageText are pure functions over plain data, so these
// are mocked-Firestore tests: fake DocumentSnapshot-shaped objects, no emulator involved.
function fakeSnapshot(exists: boolean, data?: Record<string, unknown>): DocumentSnapshot {
  return {exists, data: () => data} as unknown as DocumentSnapshot;
}

describe("isCachedContentUpToDate", () => {
  const prompt = "the tile prompt";
  const lastUpdated = Timestamp.fromMillis(1000);

  function contentSnapshot(overrides?: Record<string, unknown>): DocumentSnapshot {
    return fakeSnapshot(true, {
      content: "cached text", prompt, promptPolicyVersion: PROMPT_POLICY_VERSION, lastUpdated, ...overrides,
    });
  }

  it("reuses the cache when the version and prompt match and there's no newer class summary", () => {
    const classInfo = fakeSnapshot(true, {});
    expect(isCachedContentUpToDate(prompt, classInfo, contentSnapshot())).toBe(true);
  });

  it("regenerates when the cached promptPolicyVersion is older than the current one", () => {
    const classInfo = fakeSnapshot(true, {});
    const content = contentSnapshot({promptPolicyVersion: PROMPT_POLICY_VERSION - 1});
    expect(isCachedContentUpToDate(prompt, classInfo, content)).toBe(false);
  });

  // The literal 1, not PROMPT_POLICY_VERSION - 1: the relative form only ever checks one version
  // back, so it stops covering version 1 as soon as the version advances again.
  it("regenerates a cache written under policy version 1", () => {
    const classInfo = fakeSnapshot(true, {});
    const content = contentSnapshot({promptPolicyVersion: 1});
    expect(isCachedContentUpToDate(prompt, classInfo, content)).toBe(false);
  });

  it("regenerates when promptPolicyVersion is absent (a cache written before this field existed)", () => {
    const classInfo = fakeSnapshot(true, {});
    const content = contentSnapshot({promptPolicyVersion: undefined});
    expect(isCachedContentUpToDate(prompt, classInfo, content)).toBe(false);
  });

  it("regenerates when the cached content is older than the class's summaryCreatedAt", () => {
    const classInfo = fakeSnapshot(true, {summaryCreatedAt: Timestamp.fromMillis(2000)});
    expect(isCachedContentUpToDate(prompt, classInfo, contentSnapshot())).toBe(false);
  });

  // lastUpdated on the class doc is never written by on-class-data-doc-written.ts, so the old
  // check (comparing against it) was always inert. summaryCreatedAt absent means no class summary
  // has been generated yet, which must not be treated as staleness.
  it("reuses the cache when summaryCreatedAt is absent from the class doc", () => {
    const classInfo = fakeSnapshot(true, {});
    expect(isCachedContentUpToDate(prompt, classInfo, contentSnapshot())).toBe(true);
  });

  it("regenerates when the tile prompt text differs from the cached one", () => {
    const classInfo = fakeSnapshot(true, {});
    const content = contentSnapshot({prompt: "a different prompt"});
    expect(isCachedContentUpToDate(prompt, classInfo, content)).toBe(false);
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
