import {
  assembleTurnContext, buildRightEnvelope, isEmptyLeft,
} from "../src/chat/context-assembly";

const genericText = "generic tutor prompt";
const left = JSON.stringify({sections: [{type: "introduction", content: {tiles: []}}]});

describe("isEmptyLeft", () => {
  it("treats missing, empty, unparseable, and sectionless payloads as empty", () => {
    expect(isEmptyLeft(undefined)).toBe(true);
    expect(isEmptyLeft("")).toBe(true);
    expect(isEmptyLeft("not json")).toBe(true);
    expect(isEmptyLeft(JSON.stringify({sections: []}))).toBe(true);
    expect(isEmptyLeft(left)).toBe(false);
  });
});

describe("assembleTurnContext", () => {
  it("first turn installs generic prompt + LEFT and marks the flag", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: left},
    });
    expect(turn.installItems).toHaveLength(2);
    expect(turn.installItems[0]).toBe(genericText);
    expect(turn.installItems[1]).toContain(left);
    expect(turn.markProblemInstalled).toBe(true);
    expect(turn.input).toEqual([{role: "user", content: "hi"}]);
  });

  it("an empty LEFT installs the generic prompt only and leaves the flag unset", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: JSON.stringify({sections: []})},
    });
    expect(turn.installItems).toEqual([genericText]);
    expect(turn.markProblemInstalled).toBe(false);
  });

  it("later turns skip the install entirely", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: true, parentSeq: 3,
      message: {text: "hi", leftContext: left},
    });
    expect(turn.installItems).toEqual([]);
    expect(turn.markProblemInstalled).toBe(false);
  });

  it("a RIGHT refresh increments seq and rides as a developer message before the user text", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: true, parentSeq: 3,
      message: {text: "what changed?", rightContext: "## workspace md"},
      nowIso: "2026-07-08T00:00:00.000Z",
    });
    expect(turn.seq).toBe(4);
    expect(turn.input).toEqual([
      {role: "developer", content: buildRightEnvelope("## workspace md", 4, "2026-07-08T00:00:00.000Z")},
      {role: "user", content: "what changed?"},
    ]);
  });

  it("a turn with no RIGHT payload sends the user message only and no seq", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: true, parentSeq: 3,
      message: {text: "hi"},
    });
    expect(turn.seq).toBeUndefined();
    expect(turn.input).toEqual([{role: "user", content: "hi"}]);
  });

  it("the envelope names the seq the generic prompt tells the model to trust", () => {
    const envelope = buildRightEnvelope("md", 7, "2026-07-08T00:00:00.000Z");
    expect(envelope).toContain("CURRENT WORKSPACE");
    expect(envelope).toContain("(seq=7,");
    expect(envelope).toContain("supersedes all earlier workspace summaries");
  });
});
