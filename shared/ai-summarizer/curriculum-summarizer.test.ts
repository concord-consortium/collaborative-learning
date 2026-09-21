import fs from "fs";
import path from "path";
import { normalizeCurriculumDataSets, summarizeCurriculum } from "./ai-summarizer";
import { TABLE_MARKDOWN_ROW_CAP } from "./tile-summarizers/handle-table-tile";

// These fixtures are copied from real curriculum content (see the comments on each JSON file's
// source), not read directly from src/public/, so a change to the demo units elsewhere in the repo
// cannot silently change what this test covers.
function loadFixture(name: string): any {
  const filePath = path.join(__dirname, "curriculum-fixtures", name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarize(fileData: any): string {
  const dataSets = normalizeCurriculumDataSets(fileData.content?.sharedModels);
  return summarizeCurriculum(fileData.content, dataSets, 1, undefined, { imageFilenames: true });
}

describe("curriculum summarizer (real section shapes)", () => {
  it("keeps text content and names an image tile's file instead of dropping it", () => {
    const result = summarize(loadFixture("text-and-image.json"));
    expect(result).toContain("P.I. Monthly magazine is 10 inches high");
    expect(result).toContain("(image: SS_1_1_06_magazine_rack_500w.png)");
    expect(result).toContain("Is Daphne&#x27;s claim correct?");
  });

  describe("tables", () => {
    const fixture = loadFixture("tables.json");

    it("emits an inline-column table's headers and values", () => {
      const result = summarize(fixture);
      expect(result).toContain("| x | y |");
      expect(result).toContain("| acorns | 25 |");
      expect(result).toContain("| leaves | lots |");
    });

    it("emits a shared-dataset table's headers and values", () => {
      const result = summarize(fixture);
      expect(result).toContain('which uses the "Table 1"');
      expect(result).toContain("| x | longish title for an attribute |");
      expect(result).toContain("| 1 | 3 |");
      expect(result).toContain("| 2 | 4 |");
    });

    // `name` is authored, not guaranteed -- the question.json fixture's shared data set omits it.
    it('names an unnamed shared data set by id instead of saying "undefined"', () => {
      const result = summarize(loadFixture("question.json"));
      expect(result).toContain("which uses data set zVuFyoxDoyCDety7");
      expect(result).not.toContain("undefined");
    });

    it("changes its output when a shared dataset's value changes", () => {
      const before = summarize(fixture);

      const changed = JSON.parse(JSON.stringify(fixture));
      const attribute = changed.content.sharedModels[0].sharedModel.dataSet.attributes[0];
      expect(attribute.name).toBe("x");
      attribute.values = ["97", "98"];
      const after = summarize(changed);

      expect(after).not.toEqual(before);
      expect(after).toContain("| 97 | 3 |");
      expect(before).not.toContain("| 97 | 3 |");
    });

    it("caps a large table at TABLE_MARKDOWN_ROW_CAP rows with a count of the rest", () => {
      const rowCount = TABLE_MARKDOWN_ROW_CAP + 5;
      const bigTable = {
        content: {
          tiles: [{
            id: "big-table",
            content: {
              type: "Table",
              columns: [{ name: "n", values: Array.from({ length: rowCount }, (_, i) => `${i}`) }]
            }
          }]
        }
      };
      const result = summarize(bigTable);
      expect(result).toContain(`| ${TABLE_MARKDOWN_ROW_CAP - 1} |`);
      expect(result).not.toContain(`| ${TABLE_MARKDOWN_ROW_CAP} |`);
      expect(result).toContain("...and 5 more rows.");
    });
  });

  it("keeps a question tile's prompt and its inlined child tiles", () => {
    const result = summarize(loadFixture("question.json"));
    expect(result).toContain("# Question Prompt");
    expect(result).toContain("Inside text tile");
    expect(result).toContain("# Question Response");
    // The response row's two inlined child tiles are not dropped.
    expect(result).toContain("This tile's id is `table-2`");
    expect(result).toContain("This tile's id is `sketch-1`");
    expect(result).toContain("This tile contains a drawing");
  });

  it("reports no response tiles for a curriculum question with only a prompt", () => {
    const promptOnly = {
      content: {
        tiles: [{
          id: "question-1",
          content: {
            type: "Question",
            questionId: "q1",
            tiles: [{ id: "text-1", content: { type: "Text", format: "markdown", text: "Prompt only" } }]
          }
        }]
      }
    };
    const result = summarize(promptOnly);
    expect(result).toContain("This question does not contain any response tiles");
    expect(result).toContain("# Question Prompt");
    expect(result).toContain("Prompt only");
  });
});
