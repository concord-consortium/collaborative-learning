import { updateQuestionContentForCopy, getQuestionAnswersAsJSON, getQuestionPrompt } from "./question-utils";
import { kQuestionTileType } from "./question-types";
import { DocumentContentModel, DocumentContentModelType } from "../../document/document-content";
import { QuestionContentModel } from "./question-content";
import { defaultTextContent, TextContentModelType } from "../text/text-content";
import { registerTileTypes } from "../../../register-tile-types";

registerTileTypes(["Question", "Text"]);

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

  describe("getQuestionAnswersAsJSON", () => {
    function makeMockTile(id: string, type: string, content: any) {
      return { id, isFixedPosition: false, content: { ...content, type } };
    }

    function makeMockTextTile(id: string, plainText: string) {
      return {
        id,
        isFixedPosition: false,
        content: {
          type: "Text",
          asPlainText: () => plainText
        }
      };
    }

    function makeMockDocument(questionTiles: any[], answerTiles: any[] = []) {
      const tileMap = new Map();
      questionTiles.forEach(tile => tileMap.set(tile.id, tile));
      answerTiles.forEach(tile => tileMap.set(tile.id, tile));
      return {
        getTilesOfType: (type: string) => type === kQuestionTileType ? questionTiles.map(t => t.id) : [],
        getTile: (id: string) => tileMap.get(id)
      } as unknown as DocumentContentModelType;
    }

    it("returns answers for a single matching Question tile, including plainText for Text tiles", () => {
      const answerTiles = [
        makeMockTextTile("a1", "Hello world"),
        makeMockTile("a2", "Drawing", {})
      ];
      const questionTile = makeMockTile("q1", kQuestionTileType, {
        questionId: "QX",
        tileIds: ["a1", "a2"]
      });
      const doc = makeMockDocument([questionTile], answerTiles);
      const result = getQuestionAnswersAsJSON(doc, "QX");
      expect(result).toEqual([
        { tileId: "q1", answerTiles: [
          { tileId: "a1", type: "Text", plainText: "Hello world" },
          { tileId: "a2", type: "Drawing" }
        ] }
      ]);
    });

    it("returns answers for multiple matching Question tiles", () => {
      const answerTiles = [
        makeMockTextTile("a1", "foo"),
        makeMockTile("a2", "Drawing", {}),
        makeMockTile("a3", "Table", {})
      ];
      const questionTiles = [
        makeMockTile("q1", kQuestionTileType, {
          questionId: "QX",
          tileIds: ["a1", "a2"]
        }),
        makeMockTile("q2", kQuestionTileType, {
          questionId: "QY",
          tileIds: ["a3"]
        }),
        makeMockTile("q3", kQuestionTileType, {
          questionId: "QX",
          tileIds: ["a2"]
        })
      ];
      const doc = makeMockDocument(questionTiles, answerTiles);
      const result = getQuestionAnswersAsJSON(doc, "QX");
      expect(result).toEqual([
        { tileId: "q1", answerTiles: [
          { tileId: "a1", type: "Text", plainText: "foo" },
          { tileId: "a2", type: "Drawing" }
        ] },
        { tileId: "q3", answerTiles: [
          { tileId: "a2", type: "Drawing" }
        ] }
      ]);
    });

    it("returns an empty answerTiles array for a Question tile with no answers", () => {
      const questionTile = makeMockTile("q1", kQuestionTileType, {
        questionId: "QZ",
        tileIds: []
      });
      const doc = makeMockDocument([questionTile]);
      const result = getQuestionAnswersAsJSON(doc, "QZ");
      expect(result).toEqual([
        { tileId: "q1", answerTiles: [] }
      ]);
    });

    it("returns an empty array if no Question tiles match the questionId", () => {
      const questionTile = makeMockTile("q1", kQuestionTileType, {
        questionId: "QA",
        tileIds: ["a1"]
      });
      const doc = makeMockDocument([questionTile]);
      const result = getQuestionAnswersAsJSON(doc, "QZ");
      expect(result).toEqual([]);
    });

    it("ignores answer tiles with isFixedPosition true", () => {
      const answerTiles = [
        { id: "a1", isFixedPosition: true, content: { type: "Text", asPlainText: () => "should not appear" } },
        makeMockTile("a2", "Drawing", {})
      ];
      const questionTile = makeMockTile("q1", kQuestionTileType, {
        questionId: "QX",
        tileIds: ["a1", "a2"]
      });
      const doc = makeMockDocument([questionTile], answerTiles);
      const result = getQuestionAnswersAsJSON(doc, "QX");
      expect(result).toEqual([
        { tileId: "q1", answerTiles: [
          { tileId: "a2", type: "Drawing" }
        ] }
      ]);
    });
  });

  describe("getQuestionPrompt", () => {
    // Builds a real document with a Question that has a fixed-position prompt Text tile (text =
    // promptText) plus one non-fixed answer Text tile; returns the document and question content.
    function makeQuestionWithPrompt(promptText: string) {
      const documentContent = DocumentContentModel.create({});
      const questionContent = QuestionContentModel.create({ type: kQuestionTileType });
      documentContent.addTileContentInNewRow(questionContent);
      documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent });
      const promptTile = documentContent.getTile(questionContent.tileIds[0])!;
      promptTile.setFixedPosition(true);
      (promptTile.content as TextContentModelType).setText(promptText);
      documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent }); // answer
      return { documentContent, questionContent };
    }

    it("returns the fixed-position prompt tile's authored text", () => {
      const { documentContent, questionContent } = makeQuestionWithPrompt("What is 2+2?");
      expect(getQuestionPrompt(documentContent, questionContent)).toBe("What is 2+2?");
    });

    it("treats a blank prompt as absent (undefined) so the report falls back to the id", () => {
      const { documentContent, questionContent } = makeQuestionWithPrompt("   ");
      expect(getQuestionPrompt(documentContent, questionContent)).toBeUndefined();
    });
  });
});
