import "../../models/tiles/text/text-registration";
import { ProblemModel } from "../../models/curriculum/problem";
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";
import { buildLeftContext, problemSectionsLoaded } from "./left-context";

async function makeProblem() {
  const section = (id: string, text: string) => ({
    type: id,
    content: {
      tiles: [
        { id: `${id}-tile`, content: { type: "Text", format: "html", text: [text] } }
      ]
    } as any
  });
  const problem = ProblemModel.create({
    ordinal: 1,
    title: "test",
    sections: [section("introduction", "Intro content"), section("initialChallenge", "Challenge content")]
  });
  await problem.loadSections("");
  return problem;
}

describe("buildLeftContext", () => {
  it("produces a valid JSON structured wrapper for a multi-section problem", async () => {
    const problem = await makeProblem();
    const payload = buildLeftContext(problem);
    const parsed = JSON.parse(payload);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].type).toBe("introduction");
    expect(parsed.sections[0].content).toBeTruthy();
    expect(parsed.sections[1].type).toBe("initialChallenge");
    expect(JSON.stringify(parsed.sections[1].content)).toContain("Challenge content");
  });

  it("reports whether the problem's sections have loaded", async () => {
    const unloaded = ProblemModel.create({ ordinal: 1, title: "empty" });
    expect(problemSectionsLoaded(unloaded)).toBe(false);
    expect(buildLeftContext(unloaded)).toBe(`{"sections":[]}`);

    const loaded = await makeProblem();
    expect(problemSectionsLoaded(loaded)).toBe(true);
  });
});

describe("documentSummarizer preconditions", () => {
  it("throws when called with undefined content", () => {
    expect(() => documentSummarizer(undefined, {})).toThrow("Failed to parse content in aiSummarizer");
  });
});
