// Authored overrides for the prompt that summarizes student work in the teacher's Class Summary,
// and the assembly that applies them. Lives in shared/, not src/, because Cloud Functions can't
// load src/.

/**
 * Mirrors `chatTutorPrompts`: `replace` swaps out the built-in instruction, `append` is added
 * after the (possibly replaced) instruction. Both may be set.
 */
export interface IClassSummaryPrompts {
  replaceStudentPrompt?: string;
  appendToStudentPrompt?: string;
}

/**
 * Assembles the instruction sent with a block of work: the authored replacement or the built-in
 * instruction, then any authored addition, then the cue that asks for the answer. The cue is
 * passed in rather than written here so each caller keeps its own wording.
 */
export function buildSummaryPrompt(
  builtInInstruction: string, cue: string, prompts?: IClassSummaryPrompts
): string {
  const replacement = prompts?.replaceStudentPrompt?.trim();
  const addition = prompts?.appendToStudentPrompt?.trim();
  return [replacement || builtInInstruction, addition, cue].filter(Boolean).join("\n");
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
