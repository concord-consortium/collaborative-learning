import { sessionTutorProvider } from "./tutor-provider";

// sessionTutorProvider is the module's only export, so these cover precedence and the default
// carve-out through it: the answer a caller can actually get is the one worth pinning.
describe("sessionTutorProvider", () => {
  // The load-bearing carve-out. The default provider stamps no field and adds no doc-id suffix,
  // so every conversation predating provider selection is untouched.
  it("is undefined when neither the param nor the config selects one", () => {
    expect(sessionTutorProvider(undefined, undefined)).toBeUndefined();
  });

  it("uses the unit config when no query param is given", () => {
    expect(sessionTutorProvider(undefined, "foreverlearning")).toBe("foreverlearning");
  });

  // Argument order is the point of testing the composition: the two parameters have the same
  // type, so swapping them at the call site inverts precedence with nothing to catch it. These
  // two cases disagree on the answer if the order is wrong.
  it("takes the query param over the unit config", () => {
    expect(sessionTutorProvider("foreverlearning", "openai")).toBe("foreverlearning");
  });

  it("is undefined when the query param selects the default over the unit config", () => {
    expect(sessionTutorProvider("openai", "foreverlearning")).toBeUndefined();
  });

  // A typo'd value must not select a provider no backend implements: the rules pin the stamped
  // field to an enum, so a bogus value would fail every message write.
  it("ignores an unrecognized query param and falls back to the config", () => {
    expect(sessionTutorProvider("forever-learning", "foreverlearning")).toBe("foreverlearning");
  });

  it("ignores an unrecognized unit config value", () => {
    expect(sessionTutorProvider(undefined, "gpt")).toBeUndefined();
  });
});
