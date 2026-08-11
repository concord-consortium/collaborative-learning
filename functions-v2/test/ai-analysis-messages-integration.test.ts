// This file stays in functions-v2 (rather than next to shared/ai-analysis-messages.ts, where the
// builder-behavior tests live) because it checks the cross-package seam: that the shared module still
// re-exports through ai-categorize-document.ts and still runs against functions-v2's own installed
// openai and zod, which is what the deployed function resolves.
import {ZodArray, ZodEnum, ZodString} from "zod";
import {
  IAiPrompt,
  buildImageMessages,
  buildSummaryMessages,
  buildZodResponseSchema,
  categorizationResponseFormat,
  defaultAiPrompt,
} from "../../shared/ai-analysis-messages";
import * as categorizeDocumentModule from "../lib/src/ai-categorize-document";

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
      // jest.config.js maps openai and zod to functions-v2's copies for every importer, including
      // ../shared, so this proves the builders run correctly against the copies the deployed function
      // resolves — one zod, so these instanceof checks cannot detect a version drift between
      // shared/node_modules and functions-v2/node_modules. That is the lockfile-lockstep test's job
      // (scripts/ai-harness/test/versions.test.ts).
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
      expect(categorizeDocumentModule.categorizationResponseFormat).toBe(categorizationResponseFormat);
      expect(categorizeDocumentModule.defaultAiPrompt).toBe(defaultAiPrompt);
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
