import { updateQuestionContentForCopy } from "./question-utils";
import { kQuestionTileType } from "./question-content";

describe("question-utils", () => {
  describe("updateQuestionContentForCopy", () => {
    it("locks question tile content when copied across documents", () => {
      const content = {
        type: kQuestionTileType,
        version: 1,
        locked: false
      };
      const updatedContent = updateQuestionContentForCopy(content, true);
      expect(updatedContent).toEqual({
        type: kQuestionTileType,
        version: 1,
        locked: true
      });
    });

    it("unlocks question tile content when copied within same document", () => {
      const content = {
        type: kQuestionTileType,
        version: 1,
        locked: true
      };
      const updatedContent = updateQuestionContentForCopy(content, false);
      expect(updatedContent).toEqual({
        type: kQuestionTileType,
        version: 1,
        locked: false
      });
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
