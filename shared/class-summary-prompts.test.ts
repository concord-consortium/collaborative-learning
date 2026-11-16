import {
  buildSummaryPrompt, parseClassSummaryPrompts, CLASS_SUMMARY_STUDENT_INSTRUCTION,
} from "./class-summary-prompts";

describe("buildSummaryPrompt", () => {
  it("uses the built-in instruction when nothing is authored", () => {
    expect(buildSummaryPrompt())
      .toBe(`${CLASS_SUMMARY_STUDENT_INSTRUCTION}\nSummary:`);
  });

  it("replaces the built-in instruction", () => {
    expect(buildSummaryPrompt({ replaceStudentPrompt: "List the strategies." }))
      .toBe(`List the strategies.\nSummary:`);
  });

  // The cue is what tells the model to start writing. Authored text appended after it would be
  // read as the beginning of the answer rather than as an instruction.
  it("puts appended text before the cue, not after it", () => {
    expect(buildSummaryPrompt({ appendToStudentPrompt: "Name the students." }))
      .toBe(`${CLASS_SUMMARY_STUDENT_INSTRUCTION}\nName the students.\nSummary:`);
  });

  it("applies a replacement and an addition together", () => {
    const prompts = { replaceStudentPrompt: "List the strategies.", appendToStudentPrompt: "Be brief." };
    expect(buildSummaryPrompt(prompts)).toBe(`List the strategies.\nBe brief.\nSummary:`);
  });

  it("falls back to the built-in instruction for a whitespace-only replacement", () => {
    expect(buildSummaryPrompt({ replaceStudentPrompt: "   " }))
      .toBe(`${CLASS_SUMMARY_STUDENT_INSTRUCTION}\nSummary:`);
  });
});

describe("parseClassSummaryPrompts", () => {
  it("reads both authored fields", () => {
    expect(parseClassSummaryPrompts({ replaceStudentPrompt: "a", appendToStudentPrompt: "b" }))
      .toEqual({ replaceStudentPrompt: "a", appendToStudentPrompt: "b" });
  });

  it("keeps an authored field and drops a misspelled one", () => {
    expect(parseClassSummaryPrompts({ replaceStudentPrompt: "a", appendToStudentPromt: "b" }))
      .toEqual({ replaceStudentPrompt: "a" });
  });

  it.each([
    ["a non-object", "replaceStudentPrompt"],
    ["null", null],
    ["an empty object", {}],
    ["a block whose only field is the wrong type", { replaceStudentPrompt: 42 }],
  ])("returns undefined for %s", (_label, value) => {
    expect(parseClassSummaryPrompts(value)).toBeUndefined();
  });
});
