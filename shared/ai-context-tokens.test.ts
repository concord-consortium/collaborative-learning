import {
  buildContextSection, buildRequestPrompt, composePrompt, substituteContext, tokensUsed
} from "./ai-context-tokens";

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
describe("buildRequestPrompt", () => {
  const classSummaries = {
    studentSummary: "Class themes about water access.",
    teacherSummary: "Teacher notes about stakeholders.",
  };

  // Questions here arrive as the caller sends them: tokens already replaced with their noun
  // phrases, which is why the contexts asked for are a separate argument.
  it("omits class work when the prompt does not ask for it", () => {
    const prompt = buildRequestPrompt(
      "What could be improved?", {mywork: "My need statement."}, ["mywork"], classSummaries);
    expect(prompt).toContain("My need statement.");
    expect(prompt).not.toContain("Class themes about water access.");
    expect(prompt).not.toContain("Teacher notes about stakeholders.");
  });

  it("includes class work when the prompt asks for it", () => {
    const prompt = buildRequestPrompt(
      "Compare this document with the class's work.",
      {mywork: "Mine."}, ["mywork", "classwork"], classSummaries);
    expect(prompt).toContain("Class themes about water access.");
  });

  it("includes teacher work only when the prompt asks for it", () => {
    const asked = buildRequestPrompt(
      "Use the teacher's materials.", {}, ["teacherwork"], classSummaries);
    expect(asked).toContain("Teacher notes about stakeholders.");
    const notAsked = buildRequestPrompt(
      "Use the class's work.", {}, ["classwork"], classSummaries);
    expect(notAsked).not.toContain("Teacher notes about stakeholders.");
  });

  // A caller cannot read the class summary, so a block it sends under that name is not one.
  it("ignores a caller's own class-work block and reads its own", () => {
    const prompt = buildRequestPrompt(
      "Compare this document with the class's work.",
      {mywork: "Mine.", classwork: "Work the caller made up."},
      ["mywork", "classwork"], classSummaries);
    expect(prompt).toContain("Class themes about water access.");
    expect(prompt).not.toContain("Work the caller made up.");
  });

  it("drops a caller's class-work block even when it has no summary to put there", () => {
    const prompt = buildRequestPrompt(
      "Consider the class's work.", {classwork: "Work the caller made up."},
      ["classwork"], {});
    expect(prompt).not.toContain("Work the caller made up.");
    expect(prompt).not.toContain("<classwork>");
  });

  it("puts every context block above the question", () => {
    const question = "What could be improved?";
    const prompt = buildRequestPrompt(
      `${question} Consider the class's work.`, {mywork: "My need statement."},
      ["mywork", "classwork"], classSummaries);
    expect(prompt.indexOf("My need statement.")).toBeLessThan(prompt.indexOf(question));
    expect(prompt.indexOf("Class themes about water access.")).toBeLessThan(prompt.indexOf(question));
  });

  it("never lets class work into the my-work block", () => {
    const prompt = buildRequestPrompt(
      "Compare with the class's work.", {mywork: "My need statement."},
      ["mywork", "classwork"], classSummaries);
    const myWork = prompt.slice(prompt.indexOf("<mywork>"), prompt.indexOf("</mywork>"));
    expect(myWork).toContain("My need statement.");
    expect(myWork).not.toContain("Class themes");
  });

  it("asks for nothing extra when the class has no summary yet", () => {
    const prompt = buildRequestPrompt(
      "Compare with the class's work.", {mywork: "Mine."}, ["mywork", "classwork"], {});
    expect(prompt).not.toContain("<classwork>");
    expect(prompt).toContain("<mywork>");
  });
});
