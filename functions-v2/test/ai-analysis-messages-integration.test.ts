// This file stays in functions-v2 (rather than next to shared/ai-analysis-messages.ts, where the
// builder-behavior tests live) because it checks the cross-package seam: that the shared module still
// re-exports through ai-categorize-document.ts and still runs against functions-v2's own installed
// openai and zod, which is what the deployed function resolves.
import {ZodArray, ZodEnum, ZodString} from "zod";
import {
  IAiPrompt,
  buildImageMessages,
  buildMixedMessages,
  buildSummaryMessages,
  buildZodResponseSchema,
  categorizationResponseFormat,
  defaultAiPrompt,
} from "../../shared/ai-analysis-messages";
import * as categorizeDocumentModule from "../lib/src/ai-categorize-document";
import {CategorizeDeps, DocumentMetadata, categorizeRepresentations} from "../lib/src/ai-categorize-document";

const fullPrompt: IAiPrompt = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate and categorize this.",
  categorizationDescription: "Categorize the document based on its content.",
  categories: ["category1", "category2"],
  keyIndicatorsPrompt: "Key indicators.",
  discussionPrompt: "Discussion.",
};

const emptySchemaPrompt: IAiPrompt = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate this.",
};

describe("shared/ai-analysis-messages in functions-v2", () => {
  describe("running against functions-v2's installed openai and zod", () => {
    test("the builders and categorizationResponseFormat produce a usable request", () => {
      // jest.config.js gives every importer, ../shared included, one copy of zod, so this proves the
      // builders run against the copies the deployed function resolves. It cannot detect version
      // drift; that is the lockstep test's job (scripts/ai-harness/test/versions.test.ts).
      const responseSchema = buildZodResponseSchema(fullPrompt);
      expect(responseSchema).toEqual({
        category: expect.any(ZodEnum),
        discussion: expect.any(ZodString),
        keyIndicators: expect.any(ZodArray),
      });

      const responseFormat = categorizationResponseFormat(responseSchema);
      expect(responseFormat.type).toBe("json_schema");
      expect(responseFormat.json_schema.name).toBe("categorization-response");
      expect((responseFormat as any).$brand).toBe("auto-parseable-response-format");
      expect(typeof responseFormat.$parseRaw).toBe("function");

      const jsonSchema = responseFormat.json_schema.schema as any;
      expect(Object.keys(jsonSchema.properties).sort())
        .toEqual(["category", "discussion", "keyIndicators"]);
      expect(jsonSchema.properties.category.enum)
        .toEqual(["unknown", "category1", "category2"]);

      expect(buildImageMessages(fullPrompt, "https://example.com/image.png")).toHaveLength(2);
      expect(buildSummaryMessages(fullPrompt, "A summary.", [])).toHaveLength(2);
    });
  });

  describe("re-exports from ai-categorize-document", () => {
    test("exposes the same builder functions the shared module defines", () => {
      expect(categorizeDocumentModule.buildZodResponseSchema).toBe(buildZodResponseSchema);
      expect(categorizeDocumentModule.buildImageMessages).toBe(buildImageMessages);
      expect(categorizeDocumentModule.buildSummaryMessages).toBe(buildSummaryMessages);
      expect(categorizeDocumentModule.buildMixedMessages).toBe(buildMixedMessages);
      expect(categorizeDocumentModule.categorizationResponseFormat).toBe(categorizationResponseFormat);
      expect(categorizeDocumentModule.defaultAiPrompt).toBe(defaultAiPrompt);
    });
  });

  // The rule this guards: production builds its OpenAI messages only through
  // shared/ai-analysis-messages. Nothing here mocks a module or touches Firestore or the network —
  // it runs the real function with a fake OpenAI client and reads back the messages it was given,
  // so a message built inline in functions-v2 would show up as a mismatch here.
  describe("every request shape comes from the shared builders", () => {
    const summary = "A summary of the student's work.";
    const imageUrl = "https://example.com/image.png";
    const documentMetadata: DocumentMetadata = {
      root: "demo", space: "AI", key: "testdoc1", context_id: "class1",
      unit: "vibe", investigation: "1", problem: "1.1", offeringId: "1234",
    };

    // A CategorizeDeps whose OpenAI client records the request instead of sending it. Everything
    // that would reach Firestore or the network has a default, so a test overrides only what it
    // cares about.
    function recordingDeps(overrides: Partial<CategorizeDeps> = {}) {
      const sent: Record<string, any>[] = [];
      const deps: CategorizeDeps = {
        readDocumentMetadata: jest.fn().mockResolvedValue(documentMetadata),
        getEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        findRelatedSummaries: jest.fn().mockResolvedValue([]),
        createOpenAI: () => ({
          chat: {
            completions: {
              parse: async (request: Record<string, any>) => {
                sent.push(request);
                return {choices: [{message: {parsed: {discussion: "ok"}}}], usage: {}};
              },
            },
          },
        }) as any,
        ...overrides,
      };
      return {deps, sent};
    }

    test("a mixed request is exactly buildMixedMessages", async () => {
      const {deps, sent} = recordingDeps();

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.messageShape).toBe("mixed");
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, summary, [], imageUrl));
      expect(sent[0].model).toBe("gpt-4o-mini");
    });

    test("a summary-only request is exactly buildSummaryMessages", async () => {
      const {deps, sent} = recordingDeps();

      const result = await categorizeRepresentations(
        {summary, imageUrl: null}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.messageShape).toBe("summary-only");
      expect(sent[0].messages).toEqual(buildSummaryMessages(fullPrompt, summary, []));
    });

    test("an image-only request is both builders at once", async () => {
      const {deps, sent} = recordingDeps();

      const result = await categorizeRepresentations(
        {summary: null, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.messageShape).toBe("image-only");
      // The mixed builder with a null summary produces the image-only message. Pinning both here
      // is what lets the one code path stand in for two.
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, null, [], imageUrl));
      expect(sent[0].messages).toEqual(buildImageMessages(fullPrompt, imageUrl));
    });

    test("related summaries are looked up only when a summary is being sent", async () => {
      const {deps} = recordingDeps();

      const result = await categorizeRepresentations(
        {summary: null, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.findRelatedSummaries).not.toHaveBeenCalled();
      // An image-only run pays for no embedding and reads no metadata, so it also reports nothing
      // for the caller to write a summary record from.
      expect(deps.getEmbeddings).not.toHaveBeenCalled();
      expect(deps.readDocumentMetadata).not.toHaveBeenCalled();
      expect(result.summaryEmbedding).toBeUndefined();
      expect(result.documentMetadata).toBeUndefined();
    });

    test("the summary is embedded once, and the vector is both searched with and reported", async () => {
      const embedding = [0.4, 0.5, 0.6];
      const {deps} = recordingDeps({getEmbeddings: jest.fn().mockResolvedValue(embedding)});

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.getEmbeddings).toHaveBeenCalledTimes(1);
      expect(deps.getEmbeddings).toHaveBeenCalledWith(summary, "key");
      expect(deps.findRelatedSummaries).toHaveBeenCalledWith(documentMetadata, embedding);
      expect(result.summaryEmbedding).toBe(embedding);
      expect(result.documentMetadata).toEqual(documentMetadata);
    });

    test("no embedding means no lookup and no vector to store, and the run still completes", async () => {
      // getEmbeddings resolves undefined on any OpenAI error. A query vector of undefined throws
      // from findNearest, and a stored one would persist as a zero-dimension vector.
      const {deps, sent} = recordingDeps({getEmbeddings: jest.fn().mockResolvedValue(undefined)});

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.findRelatedSummaries).not.toHaveBeenCalled();
      expect(result.summaryEmbedding).toBeUndefined();
      expect(result.completion).toBeDefined();
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, summary, [], imageUrl));
    });

    test("an empty embedding is treated as no embedding", async () => {
      const {deps} = recordingDeps({getEmbeddings: jest.fn().mockResolvedValue([])});

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.findRelatedSummaries).not.toHaveBeenCalled();
      expect(result.summaryEmbedding).toBeUndefined();
      expect(result.completion).toBeDefined();
    });

    test("a document with no usable metadata is neither looked up nor embedded", async () => {
      const {deps, sent} = recordingDeps({readDocumentMetadata: jest.fn().mockResolvedValue(undefined)});

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.getEmbeddings).not.toHaveBeenCalled();
      expect(deps.findRelatedSummaries).not.toHaveBeenCalled();
      expect(result.documentMetadata).toBeUndefined();
      expect(result.summaryEmbedding).toBeUndefined();
      expect(result.completion).toBeDefined();
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, summary, [], imageUrl));
    });

    test("a failed metadata read does not cost the evaluation", async () => {
      const {deps, sent} = recordingDeps({
        readDocumentMetadata: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
      });

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.completion).toBeDefined();
      expect(result.documentMetadata).toBeUndefined();
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, summary, [], imageUrl));
    });

    test("a failed lookup still reports the metadata and vector for the summary record", async () => {
      // The record is worth writing even when the search that shares its vector fails: the two are
      // separate jobs that happen to want the same embedding.
      const {deps} = recordingDeps({
        findRelatedSummaries: jest.fn().mockRejectedValue(new Error("vector search unavailable")),
      });

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.documentMetadata).toEqual(documentMetadata);
      expect(result.summaryEmbedding).toEqual([0.1, 0.2, 0.3]);
    });

    test("a failed related-summaries lookup does not cost the evaluation", async () => {
      // The vector search can fail on its own — an index that is not ready, Firestore unavailable —
      // and related summaries are enrichment, so the request goes out without them.
      const {deps, sent} = recordingDeps({
        findRelatedSummaries: jest.fn().mockRejectedValue(new Error("vector search unavailable")),
      });

      const result = await categorizeRepresentations(
        {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(result.completion).toBeDefined();
      expect(sent[0].messages).toEqual(buildMixedMessages(fullPrompt, summary, [], imageUrl));
    });

    test("it refuses to ask the model about nothing", async () => {
      const {deps, sent} = recordingDeps();

      await expect(categorizeRepresentations(
        {summary: null, imageUrl: null}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps))
        .rejects.toThrow("no representation to send");
      expect(sent).toHaveLength(0);
    });
  });

  describe("caller behavior is preserved", () => {
    // categorizeUrl throws when the prompt yields an empty schema, catches its own error,
    // and resolves to undefined. Nothing is sent to OpenAI, so this needs no network.
    test("categorizeUrl gives up on a prompt with no schema fields", async () => {
      const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
      try {
        const result = await categorizeDocumentModule.categorizeUrl(
          "https://example.com/image.png", "not-a-real-key", emptySchemaPrompt);
        expect(result).toBeUndefined();
        expect(consoleLog).toHaveBeenCalledWith("OpenAI error", expect.any(Error));
      } finally {
        consoleLog.mockRestore();
      }
    });
  });
});
