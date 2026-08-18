import {
  ValidationError, canonicalJson, sha256Canonical, validateAiPrompt, validateCorpusManifest,
  validateExperimentFile, validatePricingConfig, validatePromptFile, validateResultRow
} from "../src/schemas.js";
import { projectResponseFormat } from "../src/messages.js";
import { testRunMeta } from "./helpers.js";

describe("canonical serialization", () => {
  it("sorts object keys recursively and emits no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }))
      .toBe('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  });

  it("hashes values that differ only in key order identically", () => {
    expect(sha256Canonical({ a: 1, b: 2 })).toBe(sha256Canonical({ b: 2, a: 1 }));
  });

  it("preserves array order", () => {
    expect(sha256Canonical([1, 2])).not.toBe(sha256Canonical([2, 1]));
  });

  it("drops undefined members so they cannot change a hash", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("validators name the file and the field", () => {
  it("rejects a manifest with the wrong schema version", () => {
    expect(() => validateCorpusManifest({ schemaVersion: 2 }, "manifest.json"))
      .toThrow(/manifest\.json: schemaVersion must be 1/);
  });

  it("rejects a document id that is not kebab-case", () => {
    expect(() => validateCorpusManifest({
      schemaVersion: 1,
      name: "c",
      createdAt: "now",
      documents: [{ id: "Not Valid", file: "documents/x.json", source: "synthetic", contentSha256: "x",
        computedModality: "empty" }]
    }, "manifest.json")).toThrow(/manifest\.json: documents\[0\]\.id must match/);
  });

  it("rejects duplicate document ids", () => {
    const entry = {
      id: "a", file: "documents/a.json", source: "synthetic", contentSha256: "x", computedModality: "empty"
    };
    expect(() => validateCorpusManifest(
      { schemaVersion: 1, name: "c", createdAt: "now", documents: [entry, entry] }, "manifest.json"))
      .toThrow(/duplicate document id "a"/);
  });

  it("rejects an unknown modality", () => {
    expect(() => validateCorpusManifest({
      schemaVersion: 1,
      name: "c",
      createdAt: "now",
      documents: [{ id: "a", file: "documents/a.json", source: "synthetic", contentSha256: "x",
        computedModality: "mostly-drawn" }]
    }, "manifest.json")).toThrow(/computedModality must be one of/);
  });

  it("rejects a pricing config with a non-numeric price", () => {
    expect(() => validatePricingConfig({
      schemaVersion: 1,
      effectiveDate: "2026-08-11",
      models: { "gpt-4o-mini": { inputPerMTokUsd: "cheap", outputPerMTokUsd: 0.6, maxOutputTokens: 1024 } }
    }, "pricing.json")).toThrow(/pricing\.json: models\.gpt-4o-mini\.inputPerMTokUsd must be a finite number/);
  });

  it("throws ValidationError, which carries the file and field", () => {
    try {
      validateCorpusManifest({ schemaVersion: 1, name: 1, createdAt: "now", documents: [] }, "manifest.json");
      throw new Error("expected a ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe("name");
      expect((error as ValidationError).file).toBe("manifest.json");
    }
  });
});

describe("experiment validation", () => {
  const context = {
    knownTextVariants: ["default", "minimal"],
    knownImageModes: ["puppeteer-full-height", "shutterbug-production-current"],
    promptExists: (name: string) => name === "categorize-design-default"
  };
  const run = {
    id: "text-default", message: "text-only", textVariant: "default", prompt: "categorize-design-default"
  };

  it("accepts the shipped shape", () => {
    const experiment = validateExperimentFile(
      { schemaVersion: 1, name: "text-baselines", runs: [run] }, "experiment.json", context);
    expect(experiment.runs).toHaveLength(1);
  });

  it("rejects a message shape milestone 1 cannot run", () => {
    expect(() => validateExperimentFile(
      { schemaVersion: 1, name: "x", runs: [{ ...run, message: "mixed" }] }, "experiment.json", context))
      .toThrow(/runs\[0\]\.message must be one of text-only/);
  });

  it("rejects an unknown text variant", () => {
    expect(() => validateExperimentFile(
      { schemaVersion: 1, name: "x", runs: [{ ...run, textVariant: "svg-drawings" }] }, "experiment.json", context))
      .toThrow(/runs\[0\]\.textVariant must be one of default, minimal/);
  });

  it("rejects a prompt file that does not exist", () => {
    expect(() => validateExperimentFile(
      { schemaVersion: 1, name: "x", runs: [{ ...run, prompt: "nope" }] }, "experiment.json", context))
      .toThrow(/prompts\/nope\.json/);
  });

  it("rejects a name that would escape the default results path", () => {
    // The name becomes a path segment in data/results/<corpus>-<name>.jsonl.
    for (const name of ["../../escaped", "has spaces", "Capitalized", "with/slash"]) {
      expect(() => validateExperimentFile(
        { schemaVersion: 1, name, runs: [run] }, "experiment.json", context))
        .toThrow(/name must match/);
    }
  });

  it("rejects duplicate run ids", () => {
    expect(() => validateExperimentFile(
      { schemaVersion: 1, name: "x", runs: [run, run] }, "experiment.json", context))
      .toThrow(/duplicates an earlier run id/);
  });
});

describe("result rows are a discriminated union on status", () => {
  const common = {
    schemaVersion: 2,
    experiment: "text-baselines",
    experimentSha256: "abc",
    runId: "text-default",
    corpus: "synthetic-corpus",
    docId: "text",
    modality: "text-only",
    computedModality: "text-only",
    message: "text-only",
    representation: {
      kind: "text" as const, variantId: "default", variantVersion: 1,
      sourceContentSha256: "0".repeat(64)
    },
    prompt: { name: "categorize-design-default", sha256: "def" },
    requestKey: "key",
    runMeta: testRunMeta
  };
  const usage = { promptTokens: 10, completionTokens: 5, source: "api" };
  const cost = { modeledUsd: 0.0001, incurredThisRunUsd: 0.0001 };
  const responseOriginMeta = { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null };

  it("validates a success row", () => {
    const row = validateResultRow(
      { ...common, status: "success", response: { parsed: { category: "form" }, raw: {} }, usage, cost,
        responseOriginMeta },
      "results.jsonl");
    expect(row.status).toBe("success");
  });

  it("validates a refusal row", () => {
    const row = validateResultRow(
      { ...common, status: "refusal", refusal: "no", usage, cost, responseOriginMeta }, "results.jsonl");
    expect(row.status).toBe("refusal");
  });

  it("validates an error row", () => {
    const row = validateResultRow(
      { ...common, status: "error", error: { type: "APIError", message: "boom", attempts: 3 } }, "results.jsonl");
    expect(row.status).toBe("error");
  });

  it("validates a skipped row and requires a null requestKey", () => {
    const row = validateResultRow(
      { ...common, status: "skipped", requestKey: null, skipReasons: ["empty document"] }, "results.jsonl");
    expect(row.status).toBe("skipped");
    expect(row.requestKey).toBeNull();
    expect(() => validateResultRow({ ...common, status: "skipped", skipReasons: [] }, "results.jsonl"))
      .toThrow(/requestKey must be null on a skipped row/);
  });

  it("rejects a success row that is missing the fields its status requires", () => {
    expect(() => validateResultRow({ ...common, status: "success", usage, cost, responseOriginMeta }, "results.jsonl"))
      .toThrow(/response must be an object/);
    expect(() => validateResultRow(
      { ...common, status: "refusal", usage, cost, responseOriginMeta }, "results.jsonl"))
      .toThrow(/refusal must be a string/);
    expect(() => validateResultRow({ ...common, status: "error" }, "results.jsonl"))
      .toThrow(/error must be an object/);
  });

  it("rejects an unknown status", () => {
    expect(() => validateResultRow({ ...common, status: "degraded" }, "results.jsonl"))
      .toThrow(/status must be one of success, refusal, error, skipped/);
  });
});

describe("the response-format projection", () => {
  const valid = {
    type: "json_schema",
    json_schema: { name: "categorization-response", strict: true, schema: { type: "object" } },
    $brand: "auto-parseable-response-format",
    $parseRaw: () => undefined
  };

  it("keeps only the serializable fields the cache key is built from", () => {
    expect(projectResponseFormat(valid)).toEqual({
      type: "json_schema",
      json_schema: { name: "categorization-response", strict: true, schema: { type: "object" } }
    });
  });

  it("accepts a helper that omits strict", () => {
    const { strict, ...json_schema } = valid.json_schema;
    expect(projectResponseFormat({ ...valid, json_schema }).json_schema.strict).toBeUndefined();
  });

  it.each([
    ["a renamed type", { ...valid, type: "text" }],
    ["a missing json_schema", { type: "json_schema" }],
    ["a missing name", { ...valid, json_schema: { schema: {} } }],
    ["a renamed schema field", { ...valid, json_schema: { name: "x", jsonSchema: {} } }]
  ])("throws on %s rather than silently dropping it from the key", (_label, shape) => {
    expect(() => projectResponseFormat(shape)).toThrow(/Unexpected response-format shape/);
  });

  it("would otherwise collide two different schemas onto one cache key", () => {
    // Why this is guarded rather than cast: canonicalJson drops undefined, so a renamed schema field
    // makes every prompt hash to the same key.
    // The old projection read `.schema`. After a rename that field is undefined for every prompt,
    // canonicalJson drops it, and the key stops depending on the schema at all.
    const dropped = (shape: any) => sha256Canonical({
      type: shape.type, json_schema: { name: shape.json_schema.name, schema: shape.json_schema.schema }
    });
    const a = { type: "json_schema", json_schema: { name: "n", jsonSchema: { a: 1 } } };
    const b = { type: "json_schema", json_schema: { name: "n", jsonSchema: { b: 2 } } };
    expect(dropped(a)).toBe(dropped(b));
    expect(() => projectResponseFormat(a)).toThrow();
  });
});

describe("aiPrompt validation", () => {
  const base = { systemPrompt: "You are a teacher.", mainPrompt: "Evaluate this." };
  const check = (aiPrompt: unknown) => () => validateAiPrompt(aiPrompt, "prompt.json", "aiPrompt");

  it("accepts a full, well-formed prompt", () => {
    expect(check({ ...base, categories: ["user", "form"], keyIndicatorsPrompt: "k",
      discussionPrompt: "d", categorizationDescription: "c" })()).toEqual({
      ...base, categories: ["user", "form"], keyIndicatorsPrompt: "k", discussionPrompt: "d",
      categorizationDescription: "c"
    });
  });

  it("accepts a prompt with only the required fields", () => {
    expect(check(base)()).toEqual(base);
  });

  it("rejects a string where categories should be an array", () => {
    // This is the one that matters: a string passes a loose check and is then spread
    // character-by-character into the Zod enum, producing a valid-looking but wrong schema.
    expect(check({ ...base, categories: "user" })).toThrow(/aiPrompt\.categories must be an array/);
  });

  it("rejects an empty or non-string category", () => {
    expect(check({ ...base, categories: ["user", "  "] })).toThrow(/categories\[1\] must not be empty/);
    expect(check({ ...base, categories: ["user", 7] })).toThrow(/categories\[1\] must be a string/);
  });

  it("rejects duplicate categories", () => {
    expect(check({ ...base, categories: ["user", "user"] })).toThrow(/duplicate entry "user"/);
  });

  it('rejects a literal "unknown" category, which the builder adds itself', () => {
    expect(check({ ...base, categories: ["unknown", "user"] })).toThrow(/must not list "unknown"/);
  });

  it("rejects non-string optional fields instead of casting them", () => {
    expect(check({ ...base, discussionPrompt: 42 })).toThrow(/aiPrompt\.discussionPrompt must be a string/);
    expect(check({ ...base, keyIndicatorsPrompt: {} })).toThrow(/aiPrompt\.keyIndicatorsPrompt must be a string/);
  });

  it("is what the prompt-file validator uses", () => {
    expect(() => validatePromptFile({
      schemaVersion: 1, name: "p", aiPrompt: { ...base, categories: "user" },
      provenance: { source: "s", retrievedAt: "r", aiPromptSha256: "x" }
    }, "prompt.json")).toThrow(/aiPrompt\.categories must be an array/);
  });
});

describe("error rows may carry what a billed failure cost", () => {
  const common = {
    schemaVersion: 2, experiment: "text-baselines", experimentSha256: "abc", runId: "text-default",
    corpus: "synthetic-corpus", docId: "text", modality: "text-only",
    computedModality: "text-only", message: "text-only",
    representation: { kind: "text", variantId: "default", variantVersion: 1,
      sourceContentSha256: "0".repeat(64) }, prompt: { name: "p", sha256: "d" }, requestKey: "key", runMeta: testRunMeta,
    status: "error", error: { type: "unparsed", message: "no parsed response", attempts: 1 }
  };
  const usage = { promptTokens: 700, completionTokens: 1024, source: "api" };
  const cost = { modeledUsd: 0.0007, incurredThisRunUsd: 0.0007 };
  const responseOriginMeta = { date: "2026-08-12T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null };

  it("validates an error row with all three billing fields", () => {
    const row = validateResultRow({ ...common, usage, cost, responseOriginMeta }, "results.jsonl");
    expect(row.status).toBe("error");
    if (row.status === "error") {
      expect(row.usage).toEqual(usage);
      expect(row.cost).toEqual(cost);
      expect(row.responseOriginMeta).toEqual(responseOriginMeta);
    }
  });

  it("validates an error row with none of them", () => {
    const row = validateResultRow(common, "results.jsonl");
    if (row.status === "error") expect(row.usage).toBeUndefined();
  });

  it("rejects a partially billed error row, which a report could not total correctly", () => {
    expect(() => validateResultRow({ ...common, cost }, "results.jsonl"))
      .toThrow(/without usage, cost and responseOriginMeta together/);
    expect(() => validateResultRow({ ...common, usage, responseOriginMeta }, "results.jsonl"))
      .toThrow(/without usage, cost and responseOriginMeta together/);
  });
});
