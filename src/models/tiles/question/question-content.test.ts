import { QuestionContentModel, kQuestionTileType } from "./question-content";

describe("QuestionContentModel", () => {
  it("creates a default question content", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType
    });
    expect(content.type).toBe(kQuestionTileType);
    expect(content.version).toBe(1);
  });

  it("exports content as JSON", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType,
      version: 2
    });
    const json = content.exportJson();
    const expected = {
      type: "Question",
      version: 2
    };
    expect(JSON.parse(json)).toEqual(expected);
  });
});
