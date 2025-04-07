import { updateQuestionContentForNewDocument } from "./question-utils";
import { kQuestionTileType } from "./question-content";

describe("question-utils", () => {
  describe("updateQuestionContentForNewDocument", () => {
    it("locks question tile content when copied to a new document", () => {
      const content = {
        type: kQuestionTileType,
        version: 1,
        locked: false
      };
      const updatedContent = updateQuestionContentForNewDocument(content);
      expect(updatedContent).toEqual({
        type: kQuestionTileType,
        version: 1,
        locked: true
      });
    });

    it("returns unchanged content for non-question tiles", () => {
      const content = {
        type: "Text",
        version: 1,
        text: "Hello"
      };
      const updatedContent = updateQuestionContentForNewDocument(content);
      expect(updatedContent).toBe(content);
    });
  });
});
