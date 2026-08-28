import { nonDefaultTutorProvider, resolveTutorProvider, sessionTutorProvider } from "./tutor-provider";

describe("resolveTutorProvider", () => {
  it("defaults to openai when neither the param nor the config selects one", () => {
    expect(resolveTutorProvider(undefined, undefined)).toBe("openai");
  });

  it("uses the unit config when no query param is given", () => {
    expect(resolveTutorProvider(undefined, "foreverlearning")).toBe("foreverlearning");
  });

  // QA needs to flip a single session regardless of what the unit authored.
  it("lets the query param override the unit config", () => {
    expect(resolveTutorProvider("openai", "foreverlearning")).toBe("openai");
  });

  // A typo'd param must not select a provider no backend implements: the rules pin the
  // stamped field to an enum, so a bogus value would fail every message write.
  it("ignores an unrecognized query param and falls back to the config", () => {
    expect(resolveTutorProvider("forever-learning", "foreverlearning")).toBe("foreverlearning");
  });

  it("ignores an unrecognized unit config value", () => {
    expect(resolveTutorProvider(undefined, "gpt")).toBe("openai");
  });
});

describe("nonDefaultTutorProvider", () => {
  // The load-bearing carve-out: the default provider stamps no field and adds no doc-id
  // suffix, so every conversation predating provider selection is untouched.
  it("is undefined for the default provider", () => {
    expect(nonDefaultTutorProvider("openai")).toBeUndefined();
  });

  it("is the provider id for a non-default provider", () => {
    expect(nonDefaultTutorProvider("foreverlearning")).toBe("foreverlearning");
  });
});

describe("sessionTutorProvider", () => {
  // Argument order is the whole point of testing the composition: the two parameters have
  // the same type, so swapping them at the call site inverts precedence with nothing to
  // catch it. These two cases disagree on the answer if the order is wrong.
  it("takes the query param over the unit config", () => {
    expect(sessionTutorProvider("foreverlearning", "openai")).toBe("foreverlearning");
  });

  it("is undefined when the query param selects the default over the unit config", () => {
    expect(sessionTutorProvider("openai", "foreverlearning")).toBeUndefined();
  });

  it("is undefined when neither selects a provider", () => {
    expect(sessionTutorProvider(undefined, undefined)).toBeUndefined();
  });

  it("uses the unit config when no query param is given", () => {
    expect(sessionTutorProvider(undefined, "foreverlearning")).toBe("foreverlearning");
  });
});
