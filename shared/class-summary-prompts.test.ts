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
    ["a block whose only field is blank", { replaceStudentPrompt: "" }],
    ["a block whose only field is whitespace", { appendToStudentPrompt: "  \n " }],
  ])("returns undefined for %s", (_label, value) => {
    expect(parseClassSummaryPrompts(value)).toBeUndefined();
  });

  // A block that exists and says nothing would otherwise outrank the level above and then supply
  // no wording of its own, costing the unit the prompt it authored.
  it("drops a blank field while keeping the one beside it", () => {
    expect(parseClassSummaryPrompts({ replaceStudentPrompt: "  ", appendToStudentPrompt: "b" }))
      .toEqual({ appendToStudentPrompt: "b" });
  });
});

// Pinned to the text, not to the constant: comparing the constant to itself would pass through
// any edit to it, and this wording is what every class summary falls back to. A deliberate change
// updates this line, which is the point -- it makes the change deliberate.
describe("CLASS_SUMMARY_STUDENT_INSTRUCTION", () => {
  it("is the built-in instruction every unit inherits", () => {
    expect(CLASS_SUMMARY_STUDENT_INSTRUCTION).toBe(
      "Summarize the key points, themes, topics, main ideas, and important details in this " +
      "student work. Do not describe the structure of the documents, just the content."
    );
  });
});
