import { utf8ByteLength } from "../utf8-byte-length";

// Existing FL activity_context contract. Curriculum facts are not protection-policy overrides.
export interface ActivityContext {
  task_prompt: string;
  source?: { system: "CLUE"; lesson_id: string; unit?: string; section?: string };
  learning_goal?: string;
}

export const kMaxTaskCharacters = 8000;
export const kMaxActivityBytes = 12288;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, limit: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= limit;
}

// Validate at both ends of the message boundary. Return a new snapshot, never a live store object.
// Oversized instructions are omitted whole, not cut into a different task or broken JSON.
export function readActivityContext(value: unknown): ActivityContext | undefined {
  if (!record(value) || Object.keys(value).some(k => !["task_prompt", "source", "learning_goal"].includes(k)) ||
      !text(value.task_prompt, kMaxTaskCharacters)) return undefined;
  const result: ActivityContext = { task_prompt: value.task_prompt };
  if ("source" in value) {
    const source = value.source;
    if (!record(source) || Object.keys(source).some(k => !["system", "lesson_id", "unit", "section"].includes(k)) ||
        source.system !== "CLUE" || !text(source.lesson_id, 200) ||
        ("unit" in source && !text(source.unit, 200)) ||
        ("section" in source && !text(source.section, 200))) return undefined;
    result.source = {
      system: "CLUE", lesson_id: source.lesson_id,
      ...(typeof source.unit === "string" ? { unit: source.unit } : {}),
      ...(typeof source.section === "string" ? { section: source.section } : {}),
    };
  }
  if ("learning_goal" in value) {
    if (!text(value.learning_goal, 2000)) return undefined;
    result.learning_goal = value.learning_goal;
  }
  return utf8ByteLength(JSON.stringify(result)) <= kMaxActivityBytes ? result : undefined;
}
