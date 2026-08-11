import { ZodArray, ZodEnum, ZodString } from "zod";
import {
  Agreements, IAiPrompt, RelatedSummary, buildImageMessages, buildSummaryMessages, buildZodResponseSchema,
  defaultAiPrompt
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

  describe("defaultAiPrompt", () => {
    it("still asks for the four design categories", () => {
      expect(defaultAiPrompt.categories).toEqual(["user", "environment", "form", "function"]);
      expect(defaultAiPrompt.systemPrompt)
        .toBe("You are a teaching assistant in an engineering design course.");
    });
  });
});
