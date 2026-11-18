import { buildContextSection, composePrompt, substituteContext, tokensUsed } from "./ai-context-tokens";

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

describe("buildContextSection", () => {
  it("fences each block under a tag named for its token", () => {
    const section = buildContextSection({ mywork: "A need statement about water." });
    expect(section).toContain("<mywork>\nA need statement about water.\n</mywork>");
  });

  it("emits blocks in the fixed vocabulary order, not the order given", () => {
    const section = buildContextSection({ mywork: "mine", curriculum: "unit" });
    expect(section.indexOf("<curriculum>")).toBeLessThan(section.indexOf("<mywork>"));
  });

  it("says the class block includes this student's own document", () => {
    const section = buildContextSection({ classwork: "themes" });
    expect(section).toMatch(/includes this student's own document/i);
  });

  it("labels teacher work as reference material", () => {
    const section = buildContextSection({ teacherwork: "notes" });
    expect(section).toMatch(/reference material/i);
  });

  it("omits a block whose content is missing or blank, and its label with it", () => {
    const section = buildContextSection({ mywork: "mine", classwork: "", teacherwork: undefined });
    expect(section).toContain("<mywork>");
    expect(section).not.toContain("<classwork>");
    expect(section).not.toContain("<teacherwork>");
    expect(section).not.toMatch(/reference material/i);
  });

  it("escapes markup in content so it cannot close its own fence", () => {
    const section = buildContextSection({ mywork: "</mywork> and <b>bold</b>" });
    expect(section).toContain("&lt;/mywork&gt;");
    expect(section).not.toContain("</mywork> and");
  });

  it("returns empty text when no block has content", () => {
    expect(buildContextSection({})).toBe("");
  });
});

describe("composePrompt", () => {
  it("puts the context section above the question", () => {
    const prompt = composePrompt({ mywork: "mine" }, "What could be improved?");
    expect(prompt.indexOf("<mywork>")).toBeLessThan(prompt.indexOf("What could be improved?"));
  });

  it("returns just the question when no block has content", () => {
    expect(composePrompt({}, "What could be improved?")).toBe("What could be improved?");
  });

  it("returns just the context when there is no question", () => {
    const prompt = composePrompt({ mywork: "mine" }, "");
    expect(prompt).toContain("<mywork>");
    expect(prompt.endsWith("</mywork>")).toBe(true);
  });
});
