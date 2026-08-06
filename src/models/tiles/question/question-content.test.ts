import { QuestionContentModel } from "./question-content";
import { getQuestionPrompt } from "./question-utils";
import { kQuestionTileType } from "./question-types";
import { DocumentContentModel } from "../../document/document-content";
import { defaultTextContent, TextContentModelType } from "../text/text-content";

import { registerTileTypes } from "../../../register-tile-types";
registerTileTypes(["Question", "Text"]);

// Builds a real document with a Question that has a fixed-position prompt Text tile (text = promptText)
// plus one non-fixed answer Text tile, and returns the question content.
function makeQuestionWithPrompt(promptText: string) {
  const documentContent = DocumentContentModel.create({});
  const questionContent = QuestionContentModel.create({ type: kQuestionTileType });
  documentContent.addTileContentInNewRow(questionContent);
  documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent });
  const promptTile = documentContent.allTiles[1];
  promptTile.setFixedPosition(true);
  (promptTile.content as TextContentModelType).setText(promptText);
  documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent }); // answer tile
  return { documentContent, questionContent };
}

describe("QuestionContentModel", () => {
  it("creates a default question content", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType
    });
    expect(content.type).toBe(kQuestionTileType);
    expect(content.version).toBe(1);
    expect(content.locked).toBe(false);
  });

  describe("getQuestionPrompt", () => {
    it("returns the fixed-position prompt tile's authored text", () => {
      const { documentContent, questionContent } = makeQuestionWithPrompt("What is 2+2?");
      expect(getQuestionPrompt(documentContent, questionContent)).toBe("What is 2+2?");
    });

    it("treats a blank prompt as absent (undefined) so the report falls back to the id", () => {
      const { documentContent, questionContent } = makeQuestionWithPrompt("   ");
      expect(getQuestionPrompt(documentContent, questionContent)).toBeUndefined();
    });
  });

  it("allows setting the locked property", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType
    });
    content.setLocked(true);
    expect(content.locked).toBe(true);
  });

  it("exports content as JSON", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType,
      version: 2,
      locked: true
    });
    const json = content.exportJson({ appendComma: false }, new Map());
    expect(JSON.parse(json)).toEqual({
      type: "Question",
      version: 2,
      locked: true,
      questionId: expect.stringMatching(/^.{6}$/),
      tiles: []
    });
  });

  it("exports rows as JSON", () => {
    // Create a document content model first
    const documentContent = DocumentContentModel.create({});
    documentContent.addTile("text", { title: "Text 1" });

    // Create the question content and tile
    const questionContent = QuestionContentModel.create({
      type: kQuestionTileType,
      version: 2
    });
    documentContent.addTileContentInNewRow(questionContent);
    documentContent.allTiles[1].setTitle("Question 1");

    // Add tiles to question content's rows
    documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent });
    documentContent.allTiles[2].setTitle("Text 2");

    documentContent.addTileContentInNewRow(defaultTextContent(), { rowList: questionContent });
    documentContent.allTiles[3].setTitle("Text 3");

    const json = documentContent.exportAsJson();
    expect(JSON.parse(json)).toEqual({
      tiles: [
        {
          title: "Text 1",
          content: {
            type: "Text",
            format: "html",
            text: ["<p></p>"]
          }
        },
        {
          title: "Question 1",
          content: {
            type: "Question",
            version: 2,
            locked: false,
            questionId: expect.stringMatching(/^.{6}$/),
            tiles: [
              {
                title: "Text 2",
                content: {
                  type: "Text",
                  format: "html",
                  text: ["<p></p>"]
                }
              },
              {
                title: "Text 3",
                content: {
                  type: "Text",
                  format: "html",
                  text: ["<p></p>"]
                }
              }
            ]
          }
        }
      ]
    });
  });
});
