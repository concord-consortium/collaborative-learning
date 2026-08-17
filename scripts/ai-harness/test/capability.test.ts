import { classifyDocument, drawingTileHasText, kMaxQuestionDepth, textTileHasContent } from "../src/capability.js";

function doc(rows: { tileId: string }[][], tileMap: Record<string, any>) {
  const rowOrder: string[] = [];
  const rowMap: Record<string, any> = {};
  rows.forEach((tiles, index) => {
    const rowId = `row-${index + 1}`;
    rowOrder.push(rowId);
    rowMap[rowId] = { id: rowId, isSectionHeader: false, tiles };
  });
  return { rowOrder, rowMap, tileMap };
}

function textTile(text: string, format = "markdown") {
  return { content: { type: "Text", format, text } };
}

function questionTile(rows: string[][], questionId = "q1") {
  const rowOrder: string[] = [];
  const rowMap: Record<string, any> = {};
  rows.forEach((tileIds, index) => {
    const rowId = `q-row-${index + 1}`;
    rowOrder.push(rowId);
    rowMap[rowId] = { id: rowId, tiles: tileIds.map((tileId) => ({ tileId })) };
  });
  return { content: { type: "Question", questionId, rowOrder, rowMap } };
}

describe("instance-level checks", () => {
  it("counts a Text tile only when it has content after trimming", () => {
    expect(textTileHasContent({ type: "Text", format: "markdown", text: "hello" })).toBe(true);
    expect(textTileHasContent({ type: "Text", format: "markdown", text: "   \n  " })).toBe(false);
    expect(textTileHasContent({ type: "Text", format: "markdown" })).toBe(false);
  });

  it("reads slate content through the markdown converter before deciding", () => {
    const empty = JSON.stringify({ object: "value", document: { children: [{ type: "paragraph", children: [{ text: "" }] }] } });
    const filled = JSON.stringify({ object: "value", document: { children: [{ type: "paragraph", children: [{ text: "hi" }] }] } });
    expect(textTileHasContent({ type: "Text", format: "slate", text: empty })).toBe(false);
    expect(textTileHasContent({ type: "Text", format: "slate", text: filled })).toBe(true);
  });

  it("counts a Drawing tile only when it has text objects that say something", () => {
    expect(drawingTileHasText({ objects: [{ type: "rectangle" }] })).toBe(false);
    expect(drawingTileHasText({ objects: [{ type: "text", text: "  " }] })).toBe(false);
    expect(drawingTileHasText({ objects: [{ type: "text", text: "hinge" }] })).toBe(true);
    expect(drawingTileHasText({})).toBe(false);
  });

  it("classifies an empty Text tile as an empty document, not a text-only one", () => {
    const result = classifyDocument(doc([[{ tileId: "t1" }]], { t1: textTile("   ") }));
    expect(result.computedModality).toBe("empty");
  });
});

describe("document modality", () => {
  it("is text-only when there is student text and nothing visual", () => {
    expect(classifyDocument(doc([[{ tileId: "t1" }]], { t1: textTile("hi") })).computedModality).toBe("text-only");
  });

  it("is visual-only when there is something visual and no student text", () => {
    const content = doc([[{ tileId: "t1" }]], { t1: { content: { type: "Image" } } });
    expect(classifyDocument(content).computedModality).toBe("visual-only");
  });

  it("is mixed when both are present", () => {
    const content = doc([[{ tileId: "t1" }, { tileId: "t2" }]],
      { t1: textTile("hi"), t2: { content: { type: "Drawing", objects: [] } } });
    expect(classifyDocument(content).computedModality).toBe("mixed");
  });

  it("is empty when there is neither", () => {
    expect(classifyDocument({}).computedModality).toBe("empty");
    const content = doc([[{ tileId: "t1" }]], { t1: { content: { type: "Placeholder" } } });
    expect(classifyDocument(content).computedModality).toBe("empty");
  });

  it("skips section header rows", () => {
    const content = {
      rowOrder: ["header", "row-1"],
      rowMap: { header: { isSectionHeader: true, sectionId: "s1" }, "row-1": { tiles: [{ tileId: "t1" }] } },
      tileMap: { t1: textTile("hi") }
    };
    expect(classifyDocument(content).computedModality).toBe("text-only");
  });
});

describe("Question traversal", () => {
  it("does not count the authored prompt as student text", () => {
    const content = doc([[{ tileId: "q" }]], {
      q: questionTile([["prompt"]]),
      prompt: textTile("What problem does your design solve?")
    });
    const result = classifyDocument(content);
    expect(result.computedModality).toBe("empty");
    expect(result.tiles.find((tile) => tile.tileId === "prompt")).toMatchObject({
      role: "prompt", hasStudentText: false, requiresVisualRepresentation: false
    });
  });

  it("classifies response tiles individually by their own types", () => {
    const content = doc([[{ tileId: "q" }]], {
      q: questionTile([["prompt"], ["response-text", "response-image"]]),
      prompt: textTile("Describe your design."),
      "response-text": textTile("It latches shut."),
      "response-image": { content: { type: "Image" } }
    });
    const result = classifyDocument(content);
    expect(result.computedModality).toBe("mixed");
    expect(result.tiles.find((tile) => tile.tileId === "response-text")).toMatchObject({
      role: "student", hasStudentText: true
    });
    expect(result.tiles.find((tile) => tile.tileId === "response-image")).toMatchObject({
      role: "student", requiresVisualRepresentation: true
    });
  });

  it("does not let an authored prompt make the document visual", () => {
    const content = doc([[{ tileId: "q" }]], {
      q: questionTile([["prompt-image"], ["response"]]),
      "prompt-image": { content: { type: "Image" } },
      response: textTile("Because it is stiff.")
    });
    expect(classifyDocument(content).computedModality).toBe("text-only");
  });

  it("skips a missing tile reference and records a warning", () => {
    const content = doc([[{ tileId: "q" }]], {
      q: questionTile([["prompt"], ["gone"]]),
      prompt: textTile("Describe your design.")
    });
    const result = classifyDocument(content);
    expect(result.warnings).toEqual([expect.stringContaining('tile reference "gone"')]);
    expect(result.tiles.map((tile) => tile.tileId)).toEqual(["q", "prompt"]);
  });

  it("counts a tile referenced twice only once", () => {
    const content = doc([[{ tileId: "q" }, { tileId: "shared" }]], {
      q: questionTile([["prompt"], ["shared"]]),
      prompt: textTile("Describe your design."),
      shared: textTile("It latches shut.")
    });
    const result = classifyDocument(content);
    expect(result.tiles.filter((tile) => tile.tileId === "shared")).toHaveLength(1);
  });

  it("recurses into nested Questions", () => {
    const content = doc([[{ tileId: "outer" }]], {
      outer: questionTile([["outer-prompt"], ["inner"]], "outer"),
      "outer-prompt": textTile("Outer prompt"),
      inner: questionTile([["inner-prompt"], ["inner-response"]], "inner"),
      "inner-prompt": textTile("Inner prompt"),
      "inner-response": textTile("Inner response")
    });
    const result = classifyDocument(content);
    expect(result.computedModality).toBe("text-only");
    expect(result.tiles.find((tile) => tile.tileId === "inner-response")).toMatchObject({ hasStudentText: true });
    expect(result.tiles.find((tile) => tile.tileId === "inner-prompt")).toMatchObject({ hasStudentText: false });
  });

  it("keeps a Question nested inside a prompt authored all the way down", () => {
    // The whole subtree is curriculum content. Recomputing role from row position let the nested
    // question's own later rows count as student work and flipped the document's modality.
    const content = doc([[{ tileId: "outer" }]], {
      outer: questionTile([["inner"], ["response"]], "outer"),
      inner: questionTile([["inner-prompt"], ["inner-image"]], "inner"),
      "inner-prompt": textTile("Look at this diagram:"),
      "inner-image": { content: { type: "Image" } },
      response: textTile("   ")
    });

    const result = classifyDocument(content);
    expect(result.tiles.find((tile) => tile.tileId === "inner-image")).toMatchObject({
      role: "prompt", hasStudentText: false, requiresVisualRepresentation: false
    });
    // The student wrote nothing and the image is the author's, so there is no student work here.
    expect(result.computedModality).toBe("empty");
  });

  it("still classifies a Question nested in a response by its own rows", () => {
    const content = doc([[{ tileId: "outer" }]], {
      outer: questionTile([["outer-prompt"], ["inner"]], "outer"),
      "outer-prompt": textTile("Outer prompt"),
      inner: questionTile([["inner-prompt"], ["inner-image"]], "inner"),
      "inner-prompt": textTile("Inner prompt"),
      "inner-image": { content: { type: "Image" } }
    });

    const result = classifyDocument(content);
    expect(result.tiles.find((tile) => tile.tileId === "inner-prompt")).toMatchObject({ role: "prompt" });
    expect(result.tiles.find((tile) => tile.tileId === "inner-image")).toMatchObject({
      role: "student", requiresVisualRepresentation: true
    });
    expect(result.computedModality).toBe("visual-only");
  });

  it("stops recursing at the depth cap instead of looping forever", () => {
    const tileMap: Record<string, any> = {};
    const depth = kMaxQuestionDepth + 4;
    for (let level = 0; level < depth; level += 1) {
      tileMap[`q${level}`] = questionTile([[`p${level}`], [`q${level + 1}`]], `q${level}`);
      tileMap[`p${level}`] = textTile(`prompt ${level}`);
    }
    tileMap[`q${depth}`] = textTile("the deepest response");
    const result = classifyDocument(doc([[{ tileId: "q0" }]], tileMap));
    expect(result.warnings.some((warning) => warning.includes("nesting depth cap"))).toBe(true);
    expect(result.tiles.some((tile) => tile.tileId === `q${depth}`)).toBe(false);
  });

  it("survives a Question tile that references itself", () => {
    const content = doc([[{ tileId: "q" }]], { q: questionTile([["prompt"], ["q"]]), prompt: textTile("Prompt") });
    expect(() => classifyDocument(content)).not.toThrow();
  });
});
