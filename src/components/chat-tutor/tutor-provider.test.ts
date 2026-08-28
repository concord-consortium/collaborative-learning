import { nonDefaultTutorProvider, resolveTutorProvider } from "./tutor-provider";

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
