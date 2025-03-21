import { QuestionContentModel, kQuestionTileType } from "./question-content";

describe("QuestionContentModel", () => {
  it("creates a default question content", () => {
    const content = QuestionContentModel.create({
      type: kQuestionTileType
    });
    expect(content.type).toBe(kQuestionTileType);
    expect(content.version).toBe(1);
    expect(content.locked).toBe(false);
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
    const json = content.exportJson();
    expect(JSON.parse(json)).toEqual({
      type: "Question",
      version: 2,
      locked: true
    });
  });
});
