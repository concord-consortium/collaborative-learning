import fs from "node:fs";
import path from "node:path";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { harnessRoot } from "../src/corpus.js";
import { sha256Canonical, validatePromptFile } from "../src/schemas.js";

const promptsDir = path.join(harnessRoot, "prompts");
const promptFile = path.join(promptsDir, "categorize-design-default.json");

/**
 * Every committed prompt, not just the one below.
 *
 * `validatePromptFile` checks each file's declared `aiPromptSha256` against its own `aiPrompt`, and
 * `buildTasks` loads prompts through it — so a file that fails this aborts `plan` and `run` before a
 * single task is built. Nothing exercised any prompt but `categorize-design-default`, and a reworded
 * `categorize-design-mixed` shipped with a stale hash and a green suite: the only experiment that
 * covers mixed, detail, imageSet and extras could not run at all.
 *
 * Filtered and sorted for the same reasons as the experiment-file block in experiments.test.ts:
 * readdir order is the filesystem's, and a stray non-JSON file should be skipped rather than throw.
 */
describe("every committed prompt file", () => {
  const promptFiles = fs.readdirSync(promptsDir).filter((name) => name.endsWith(".json")).sort();

  // A glob that matches nothing passes every case it is given, so the count is asserted first.
  it("finds the prompts to check", () => {
    expect(promptFiles.length).toBeGreaterThan(1);
  });

  it.each(promptFiles)("%s validates, hash included", (name) => {
    const file = path.join(promptsDir, name);
    const prompt = validatePromptFile(JSON.parse(fs.readFileSync(file, "utf8")), file);
    // The name is what an experiment's `prompt` field names, and the filename is how it is found —
    // so a copy-paste that leaves them disagreeing makes a prompt unreachable under its own name.
    expect(prompt.name).toBe(path.basename(name, ".json"));
  });
});

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
