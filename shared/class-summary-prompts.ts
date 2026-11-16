// The built-in prompt that summarizes student work for the teacher's Class Summary, the authored
// overrides for it, and the assembly that applies them. Lives in shared/ because two builds consume
// it: functions-v2 sends it to the model, and the authoring UI displays it read-only so unit authors
// can see what their overrides replace or append to.

/**
 * Held apart from its trailing cue so an authored addition lands before "Summary:" rather than
 * after it, where the model reads it as the start of the answer instead of as an instruction.
 */
export const CLASS_SUMMARY_STUDENT_INSTRUCTION =
  "Summarize the key points, themes, topics, main ideas, and important details in this student work. " +
  "Do not describe the structure of the documents, just the content.";

const CLASS_SUMMARY_CUE = "Summary:";

/**
 * Mirrors `chatTutorPrompts`: `replace` swaps out the built-in instruction, `append` is added
 * after the (possibly replaced) instruction. Both may be set.
 */
export interface IClassSummaryPrompts {
  replaceStudentPrompt?: string;
  appendToStudentPrompt?: string;
}

/**
 * Assembles the instruction sent with a block of student work: the authored replacement or the
 * built-in instruction, then any authored addition, then the cue that asks for the answer.
 */
export function buildSummaryPrompt(prompts?: IClassSummaryPrompts): string {
  const replacement = prompts?.replaceStudentPrompt?.trim();
  const addition = prompts?.appendToStudentPrompt?.trim();
  return [replacement || CLASS_SUMMARY_STUDENT_INSTRUCTION, addition, CLASS_SUMMARY_CUE]
    .filter(Boolean).join("\n");
}

/**
 * Accepts only string fields, and returns undefined for anything else -- including an authored
 * block that is present but misspelled. Callers parse a remote content.json where one bad value
 * must not invalidate the whole unit.
 */
export function parseClassSummaryPrompts(value: unknown): IClassSummaryPrompts | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const replaceStudentPrompt =
    typeof record.replaceStudentPrompt === "string" ? record.replaceStudentPrompt : undefined;
  const appendToStudentPrompt =
    typeof record.appendToStudentPrompt === "string" ? record.appendToStudentPrompt : undefined;
  if (replaceStudentPrompt === undefined && appendToStudentPrompt === undefined) return undefined;
  return {
    ...(replaceStudentPrompt !== undefined && {replaceStudentPrompt}),
    ...(appendToStudentPrompt !== undefined && {appendToStudentPrompt}),
  };
}
