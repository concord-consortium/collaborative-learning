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
import {CategorizeDeps, categorizeRepresentations} from "../lib/src/ai-categorize-document";

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

    // A CategorizeDeps whose OpenAI client records the request instead of sending it.
    function recordingDeps(overrides: Partial<CategorizeDeps> = {}) {
      const sent: Record<string, any>[] = [];
      const deps: CategorizeDeps = {
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

      await categorizeRepresentations(
        {summary: null, imageUrl}, "key", "demo/AI/documents/testdoc1", fullPrompt, deps);

      expect(deps.findRelatedSummaries).not.toHaveBeenCalled();
    });

    test("a failed related-summaries lookup does not cost the evaluation", async () => {
      // getEmbeddings resolves undefined on error and FieldValue.vector(undefined) then throws
      // from inside the lookup, so the whole call can fail, not just the embeddings part.
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
