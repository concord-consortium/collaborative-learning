import fs from "node:fs";
import path from "node:path";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { harnessRoot } from "../src/corpus.js";
import { sha256Canonical, validatePromptFile } from "../src/schemas.js";

const promptFile = path.join(harnessRoot, "prompts", "categorize-design-default.json");

/**
 * The committed prompt is a copy of production's built-in default, and this
 * is what stops the copy drifting away from it unnoticed.
 */
describe("the committed default prompt", () => {
  const raw = JSON.parse(fs.readFileSync(promptFile, "utf8"));

  it("validates, which also checks its own declared hash", () => {
    const prompt = validatePromptFile(raw, promptFile);
    expect(prompt.name).toBe("categorize-design-default");
    expect(prompt.provenance.source).toContain("ai-analysis-messages");
  });

  it("hashes identically to defaultAiPrompt from the shared module", () => {
    const productionHash = sha256Canonical(defaultAiPrompt);
    expect(raw.provenance.aiPromptSha256).toBe(productionHash);
    expect(sha256Canonical(raw.aiPrompt)).toBe(productionHash);
  });

  it("is byte-for-byte the same prompt object", () => {
    expect(raw.aiPrompt).toEqual(defaultAiPrompt);
  });

  it("rejects a prompt file whose declared hash does not match its content", () => {
    const tampered = { ...raw, aiPrompt: { ...raw.aiPrompt, systemPrompt: "You are a pirate." } };
    expect(() => validatePromptFile(tampered, "tampered.json"))
      .toThrow(/tampered\.json: provenance\.aiPromptSha256 does not match/);
  });
});
