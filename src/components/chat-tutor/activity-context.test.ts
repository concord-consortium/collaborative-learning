import { UnitModel } from "../../models/curriculum/unit";
import { ProblemModel } from "../../models/curriculum/problem";
import { buildActivityContext } from "./activity-context";
import { readActivityContext, kMaxActivityBytes } from "../../../shared/fl-packet/activity-context";
import { utf8ByteLength } from "../../../shared/utf8-byte-length";
import { applySnapshot } from "mobx-state-tree";
import { createEditor } from "@concord-consortium/slate-editor";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import "../../models/tiles/text/text-registration";
import "../../models/tiles/question/question-registration";

createEditor();

const text = (id: string, value: string, display?: string) => ({
  id, display, content: { type: "Text", text: value }
});
function section(type: string, prompt: string) {
  return { type, content: {
    rowOrder: ["r"], rowMap: { r: { id: "r", tiles: [{ tileId: "t" }, { tileId: "secret" }] } },
    tileMap: { t: text("t", prompt), secret: text("secret", "Teacher answer: 42", "teacher") }
  } };
}
function unit() {
  const u = UnitModel.create({ code: "vibe", title: "VIBE", investigations: [{
    ordinal: 1, title: "One", problems: [
      { ordinal: 2, title: "Two", sections: [section("intro", "Explore the number."),
        section("lab", "Build a model.")] },
      { ordinal: 3, title: "Three", sections: [section("reflect", "Describe what you observed.")] }
    ]
  }] } as any);
  u.investigations.forEach(i => i.problems.forEach(p => p.addSections(p.sectionsFromSnapshot as any)));
  return u;
}

describe("current student task", () => {
  it("follows the selected section, excluding teacher tiles and other sections", () => {
    const u = unit();
    const p = u.investigations[0].problems[0];
    expect(buildActivityContext(u, p, "lab")).toEqual({
      task_prompt: "Build a model.",
      source: { system: "CLUE", lesson_id: "1.2", unit: "vibe", section: "lab" }
    });
    expect(buildActivityContext(u, p, "intro")?.task_prompt).toBe("Explore the number.");
  });

  it("uses the renderer's first-section fallback after a lesson change or reload", () => {
    const u = unit();
    const p = u.investigations[0].problems[1];
    expect(buildActivityContext(u, p, "lab")).toEqual(buildActivityContext(u, p));
    expect(buildActivityContext(u, p)?.source?.lesson_id).toBe("1.3");
    expect(buildActivityContext(u, p)?.task_prompt).toBe("Describe what you observed.");
  });

  it("sends task-only for a detached problem, and nothing for an unloaded or empty task", () => {
    const u = unit();
    const p = ProblemModel.create({ ordinal: 2, title: "Detached", sections: [section("intro", "Task")] } as any);
    p.addSections(p.sectionsFromSnapshot as any);
    expect(buildActivityContext(u, p)).toEqual({ task_prompt: "Task" });
    expect(buildActivityContext(u, ProblemModel.create({ ordinal: 3, title: "Loading" }))).toBeUndefined();
    const empty = ProblemModel.create({ ordinal: 2, title: "Empty", sections: [section("intro", " ")] } as any);
    empty.addSections(empty.sectionsFromSnapshot as any);
    expect(buildActivityContext(u, empty)).toBeUndefined();
  });

  it("reads HTML and nested question text without exposing hidden containers or children", () => {
    const u = unit();
    const p = u.investigations[0].problems[0];
    const c = p.sections[0].content!;
    (c.tileMap.get("t")!.content as TextContentModelType).setHtml("<p>First &amp; second</p>");
    expect(buildActivityContext(u, p)?.task_prompt).toBe("First & second");
    applySnapshot(c, {
      rowOrder: ["r"], rowMap: { r: { id: "r", tiles: [{ tileId: "q" }, { tileId: "hidden" }] } },
      tileMap: {
        q: { id: "q", content: { type: "Question", rowOrder: ["qr"],
          rowMap: { qr: { id: "qr", tiles: [{ tileId: "prompt" }, { tileId: "answer" }] } } } },
        hidden: { id: "hidden", display: "teacher", content: { type: "Question", rowOrder: ["hr"],
          rowMap: { hr: { id: "hr", tiles: [{ tileId: "secret" }] } } } },
        prompt: text("prompt", "Explain the result."),
        answer: text("answer", "The answer", "teacher"), secret: text("secret", "Teacher notes")
      }
    } as any);
    expect(buildActivityContext(u, p)?.task_prompt).toBe("Explain the result.");
  });

  it("converts valid Slate and omits malformed Slate without forwarding serialized content", () => {
    const u = unit();
    const p = u.investigations[0].problems[0];
    const t = p.sections[0].content!.tileMap.get("t")!.content as TextContentModelType;
    applySnapshot(t, { type: "Text", format: "slate", text: JSON.stringify({ document: {
      children: [{ type: "paragraph", children: [{ text: "Compare the two runs." }] }]
    } }) });
    expect(buildActivityContext(u, p)?.task_prompt).toBe("Compare the two runs.");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    applySnapshot(t, { type: "Text", format: "slate", text: "malformed" });
    expect(buildActivityContext(u, p)).toBeUndefined();
    warn.mockRestore();
  });

  it("omits a whole oversized task without silently truncating instructions", () => {
    const u = unit();
    const p = ProblemModel.create({ ordinal: 2, title: "Long", sections: [section("intro", "x".repeat(8001))] } as any);
    p.addSections(p.sectionsFromSnapshot as any);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(buildActivityContext(u, p)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each(["html", "slate"])("preserves displayed highlight phrases in %s without leaking unused entries", format => {
    const u = unit();
    const p = u.investigations[0].problems[0];
    const content = p.sections[0].content!.tileMap.get("t")!.content as TextContentModelType;
    const before = "The ", phrase = "goal is to develop strategies", after = " for figuring things out.";
    const html = `${before}<span data-slate-type="highlight" data-slate-highlight-id="goal"></span>${after}`;
    const slate = JSON.stringify({ document: { children: [{ type: "paragraph", children: [
      { text: before }, { type: "highlight", highlightId: "goal", children: [{ text: "" }] }, { text: after }
    ] }] } });
    applySnapshot(content, { type: "Text", format, text: format === "html" ? html : slate,
      highlightedText: [{ id: "goal", text: phrase }, { id: "unused", text: "Do not forward unused metadata" }] });
    expect(buildActivityContext(u, p)?.task_prompt).toBe(before + phrase + after);
    expect(content.joinText).toBe(format === "html" ? html : slate);
  });
});

describe("activity message boundary", () => {
  it("bounds serialized UTF-8 bytes as well as text length, without changing valid text", () => {
    const activity = { task_prompt: "界".repeat(4000) };
    expect(utf8ByteLength(JSON.stringify(activity))).toBeLessThan(kMaxActivityBytes);
    expect(readActivityContext(activity)).toEqual(activity);
    expect(readActivityContext({ task_prompt: "界".repeat(5000) })).toBeUndefined();
    expect(readActivityContext({ task_prompt: "\"".repeat(7000) })).toBeUndefined();
  });
  it.each([
    { task_prompt: " " }, { task_prompt: "task", canonical_pattern_id: "bypass" },
    { task_prompt: "task", source: { system: "CLUE" } },
    { task_prompt: "task", source: { system: "CLUE", lesson_id: "1.2", extra: true } },
    { task_prompt: "task", learning_goal: "" }
  ])("rejects malformed context or protection overrides: %j", value => {
    expect(readActivityContext(value)).toBeUndefined();
  });
});
