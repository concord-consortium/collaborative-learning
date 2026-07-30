import { normalizeTutorPrompts, tutorPromptsKey } from "./tutor-prompts";

describe("normalizeTutorPrompts", () => {
  it("returns undefined when the config is absent or empty", () => {
    expect(normalizeTutorPrompts(undefined)).toBeUndefined();
    expect(normalizeTutorPrompts({})).toBeUndefined();
  });

  it("returns undefined when both fields are whitespace-only", () => {
    expect(normalizeTutorPrompts({
      replaceGenericPrompt: "   \n\t", appendToGenericPrompt: ""
    })).toBeUndefined();
  });

  it("trims values and drops whitespace-only fields individually", () => {
    expect(normalizeTutorPrompts({
      replaceGenericPrompt: "  You are a tutor.  ", appendToGenericPrompt: "  "
    })).toEqual({ replace: "You are a tutor.", append: undefined });
    expect(normalizeTutorPrompts({
      appendToGenericPrompt: "Focus on energy transfer.\n"
    })).toEqual({ replace: undefined, append: "Focus on energy transfer." });
  });

  it("keeps both fields when both are set", () => {
    expect(normalizeTutorPrompts({
      replaceGenericPrompt: "a", appendToGenericPrompt: "b"
    })).toEqual({ replace: "a", append: "b" });
  });
});

describe("tutorPromptsKey", () => {
  it("is stable for equal prompts", () => {
    expect(tutorPromptsKey({ replace: "a", append: "b" }))
      .toBe(tutorPromptsKey({ replace: "a", append: "b" }));
  });

  it("changes when either field changes", () => {
    const base = tutorPromptsKey({ replace: "a", append: "b" });
    expect(tutorPromptsKey({ replace: "a2", append: "b" })).not.toBe(base);
    expect(tutorPromptsKey({ replace: "a", append: "b2" })).not.toBe(base);
  });

  it("distinguishes the same text split differently across fields", () => {
    expect(tutorPromptsKey({ replace: "ab" }))
      .not.toBe(tutorPromptsKey({ replace: "a", append: "b" }));
  });
});
