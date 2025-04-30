import { updateQuestionContentForCopy } from "./question-utils";
import { kQuestionTileType } from "./question-types";

describe("question-utils", () => {
  describe("updateQuestionContentForCopy", () => {
    it("locks question tile content when copied across documents", () => {
      const content = {
        type: kQuestionTileType,
        version: 1,
        locked: false,
        questionId: "123456"
      };
      const updatedContent = updateQuestionContentForCopy(content, true);
      expect(updatedContent).toEqual({
        type: kQuestionTileType,
        version: 1,
        locked: true,
        questionId: "123456"
      });
    });

    it("unlocks question tile content when copied within same document", () => {
      const content = {
        type: kQuestionTileType,
        version: 1,
        locked: true,
        questionId: "123456"
      };
      const updatedContent = updateQuestionContentForCopy(content, false);
      expect(updatedContent).toEqual({
        type: kQuestionTileType,
        version: 1,
        locked: false,
        questionId: expect.stringMatching(/^.{6}$/)
      });
      // Ensure the new questionId is different from the original
      expect(updatedContent.questionId).not.toBe(content.questionId);
    });

    it("returns unchanged content for non-question tiles", () => {
      const content = {
        type: "Text",
        version: 1,
        text: "Hello"
      };
      const updatedContent = updateQuestionContentForCopy(content, false);
      expect(updatedContent).toBe(content);
    });
  });
});
