import { substituteContext, tokensUsed } from "./ai-context-tokens";

describe("tokensUsed", () => {
  it("finds each known token named in a prompt", () => {
    const used = tokensUsed("Compare {{mywork}} with {{classwork}}.");
    expect(Array.from(used).sort()).toEqual(["classwork", "mywork"]);
  });

  it("reports a token named twice only once", () => {
    expect(Array.from(tokensUsed("{{mywork}} and {{mywork}}"))).toEqual(["mywork"]);
  });

  it("ignores a name that is not in the vocabulary", () => {
    expect(Array.from(tokensUsed("{{myWork}} {{stakeholders}}"))).toEqual([]);
  });

  it("finds nothing in a prompt with no tokens", () => {
    expect(tokensUsed("What could be improved?").size).toBe(0);
  });
});

describe("substituteContext", () => {
  it("replaces a known token with its noun phrase", () => {
    expect(substituteContext("Compare {{mywork}} with {{classwork}}."))
      .toBe("Compare this document with the class's work.");
  });

  it("leaves an unrecognized token as literal text", () => {
    expect(substituteContext("Look at {{myWork}}.")).toBe("Look at {{myWork}}.");
  });

  it("returns empty text when the prompt is only tokens", () => {
    expect(substituteContext("{{classwork}}")).toBe("");
    expect(substituteContext("  {{classwork}} {{mywork}}  ")).toBe("");
  });

  it("keeps a prompt that has no tokens unchanged", () => {
    expect(substituteContext("What could be improved?")).toBe("What could be improved?");
  });
});
