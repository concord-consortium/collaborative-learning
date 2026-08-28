import { ZodArray, ZodEnum, ZodString } from "zod";
import {
  Agreements, IAiPrompt, RelatedSummary, buildImageMessages, buildMixedMessages, buildSummaryMessages,
  buildZodResponseSchema, defaultAiPrompt
} from "./ai-analysis-messages";

const fullPrompt: IAiPrompt = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate and categorize this.",
  categorizationDescription: "Categorize the document based on its content.",
  categories: ["category1", "category2"],
  keyIndicatorsPrompt: "Key indicators.",
  discussionPrompt: "Discussion."
};

const discussionOnlyPrompt: IAiPrompt = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate this.",
  discussionPrompt: "Discussion."
};

const emptySchemaPrompt: IAiPrompt = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate this."
};

function makeRelatedSummary(summary: string, agreements: Partial<Agreements>): RelatedSummary {
  return { summary, agreements: agreements as Agreements };
}

describe("ai-analysis-messages", () => {
  describe("buildZodResponseSchema", () => {
    it("builds every field from a full prompt", () => {
      expect(buildZodResponseSchema(fullPrompt)).toEqual({
        category: expect.any(ZodEnum),
        discussion: expect.any(ZodString),
        keyIndicators: expect.any(ZodArray)
      });
    });

    it("builds only the discussion field from a discussion-only prompt", () => {
      expect(buildZodResponseSchema(discussionOnlyPrompt)).toEqual({
        discussion: expect.any(ZodString)
      });
    });

    it("builds an empty schema when the prompt has no schema fields", () => {
      expect(buildZodResponseSchema(emptySchemaPrompt)).toEqual({});
    });
  });

  describe("buildImageMessages", () => {
    it("creates a system message and a user message with text and image parts", () => {
      expect(buildImageMessages(fullPrompt, "https://example.com/image.png")).toEqual([
        {
          role: "system",
          content: "You are a master teacher."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Evaluate and categorize this."
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
                detail: "auto"
              }
            }
          ]
        }
      ]);
    });
  });

  describe("buildSummaryMessages", () => {
    it("creates prompt and summary parts when there are no related summaries", () => {
      expect(buildSummaryMessages(fullPrompt, "The student drew a box.", [])).toEqual([
        {
          role: "system",
          content: "You are a master teacher."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Evaluate and categorize this."
            },
            {
              type: "text",
              text: "This is the AI generated summary:\nThe student drew a box."
            }
          ]
        }
      ]);
    });

    it("appends one part per related summary, with its agreement counts", () => {
      const related = [
        makeRelatedSummary("First related summary.", {
          yes: [{ content: "Agreed.", tags: ["form"] }, { content: "Also agreed.", tags: [] }],
          no: [{ content: "Disagreed.", tags: [] }]
        })
      ];

      const messages = buildSummaryMessages(fullPrompt, "The student drew a box.", related);
      const userContent = messages[1].content as any[];

      expect(userContent).toHaveLength(3);
      expect(userContent[2]).toEqual({
        type: "text",
        text: "This is AI generated summary of a similar document:\nFirst related summary." +
          "\n\nOther users agreed with this summary as follows: yes: 2, no: 1"
      });
    });

    it("appends a part for each of two related summaries", () => {
      const related = [
        makeRelatedSummary("First related summary.", { yes: [{ content: "Agreed.", tags: [] }] }),
        makeRelatedSummary("Second related summary.", { notSure: [{ content: "Unsure.", tags: [] }] })
      ];

      const messages = buildSummaryMessages(fullPrompt, "The student drew a box.", related);
      const userContent = messages[1].content as any[];

      expect(userContent).toHaveLength(4);
      expect(userContent[2].text).toContain("First related summary.");
      expect(userContent[2].text).toContain("yes: 1");
      expect(userContent[3].text).toContain("Second related summary.");
      expect(userContent[3].text).toContain("notSure: 1");
    });

    it("omits the agreement sentence when a related summary has no agreements", () => {
      const related = [makeRelatedSummary("First related summary.", {})];

      const messages = buildSummaryMessages(fullPrompt, "The student drew a box.", related);
      const userContent = messages[1].content as any[];

      expect(userContent[2]).toEqual({
        type: "text",
        text: "This is AI generated summary of a similar document:\nFirst related summary."
      });
    });
  });

  describe("buildImageMessages with the new optional arguments", () => {
    it("sends the same message for a bare URL as it did before they existed", () => {
      // The production call site passes two arguments and nothing else. Its message has to be what
      // it always was, or every cached analysis is invalidated for no reason.
      expect(buildImageMessages(fullPrompt, "https://example.com/image.png")).toEqual([
        { role: "system", content: "You are a master teacher." },
        {
          role: "user",
          content: [
            { type: "text", text: "Evaluate and categorize this." },
            { type: "image_url", image_url: { url: "https://example.com/image.png", detail: "auto" } }
          ]
        }
      ]);
    });

    it("applies a request-wide detail to a bare URL", () => {
      const content = buildImageMessages(fullPrompt, "https://example.com/a.png", { detail: "low" })[1]
        .content as any[];
      expect(content[1].image_url).toEqual({ url: "https://example.com/a.png", detail: "low" });
    });

    it("sends one part per image, in the order given", () => {
      const content = buildImageMessages(fullPrompt, [
        { url: "https://example.com/tile-1.png" },
        { url: "https://example.com/tile-2.png", detail: "high" }
      ])[1].content as any[];
      expect(content).toHaveLength(3);
      expect(content[1].image_url).toEqual({ url: "https://example.com/tile-1.png", detail: "auto" });
      expect(content[2].image_url).toEqual({ url: "https://example.com/tile-2.png", detail: "high" });
    });

    it("lets an image's own detail win over the request-wide one", () => {
      const content = buildImageMessages(
        fullPrompt,
        [{ url: "https://example.com/a.png", detail: "high" }, { url: "https://example.com/b.png" }],
        { detail: "low" }
      )[1].content as any[];
      expect(content.slice(1).map((part: any) => part.image_url.detail)).toEqual(["high", "low"]);
    });

    it("sends the same message for a one-element array as for that URL alone", () => {
      expect(buildImageMessages(fullPrompt, [{ url: "https://example.com/a.png" }]))
        .toEqual(buildImageMessages(fullPrompt, "https://example.com/a.png"));
    });
  });

  describe("buildMixedMessages", () => {
    const related = [makeRelatedSummary("A related summary.", { yes: [{ content: "Agreed.", tags: [] }] })];

    it("is a summary message with the image parts appended", () => {
      // Stated as a relationship rather than a copy of the expected parts: a mixed message that
      // worded the text side differently would measure the wording, not the representation.
      const summaryOnly = buildSummaryMessages(fullPrompt, "The student drew a box.", related);
      const mixed = buildMixedMessages(
        fullPrompt, "The student drew a box.", related, "https://example.com/doc.png");

      expect(mixed[0]).toEqual(summaryOnly[0]);
      const textParts = (summaryOnly[1].content as any[]);
      const mixedParts = (mixed[1].content as any[]);
      expect(mixedParts.slice(0, textParts.length)).toEqual(textParts);
      expect(mixedParts.slice(textParts.length)).toEqual([
        { type: "image_url", image_url: { url: "https://example.com/doc.png", detail: "auto" } }
      ]);
    });

    it("drops the summary and the related summaries when there is no text to send", () => {
      // A related summary is context for a summary that is not being sent, so it goes too. The
      // pictures remain, which is the entire reason to ask about such a document.
      const content = buildMixedMessages(fullPrompt, null, related, "https://example.com/doc.png")[1]
        .content as any[];
      expect(content).toEqual([
        { type: "text", text: "Evaluate and categorize this." },
        { type: "image_url", image_url: { url: "https://example.com/doc.png", detail: "auto" } }
      ]);
    });

    it("appends one image part per image, after the text parts", () => {
      const content = buildMixedMessages(fullPrompt, "A summary.", [], [
        { url: "https://example.com/tile-1.png" },
        { url: "https://example.com/tile-2.png" }
      ], { detail: "low" })[1].content as any[];
      expect(content.map((part: any) => part.type))
        .toEqual(["text", "text", "image_url", "image_url"]);
      expect(content.slice(2).map((part: any) => part.image_url.detail)).toEqual(["low", "low"]);
    });

    it("invents no prose about the pictures", () => {
      const content = buildMixedMessages(
        fullPrompt, "A summary.", [], "https://example.com/doc.png")[1].content as any[];
      const texts = content.filter((part: any) => part.type === "text").map((part: any) => part.text);
      expect(texts).toEqual([
        "Evaluate and categorize this.",
        "This is the AI generated summary:\nA summary."
      ]);
    });
  });

  describe("defaultAiPrompt", () => {
    it("still asks for the four design categories", () => {
      expect(defaultAiPrompt.categories).toEqual(["user", "environment", "form", "function"]);
      expect(defaultAiPrompt.systemPrompt)
        .toBe("You are a teaching assistant in an engineering design course.");
    });
  });
});
