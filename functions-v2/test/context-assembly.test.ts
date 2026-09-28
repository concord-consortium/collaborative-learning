import {
  assembleTurnContext, buildRightEnvelope, effectiveGenericText, isEmptyLeft,
} from "../src/chat/context-assembly";
import {UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION} from "../../shared/unit-summary-types";

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

describe("effectiveGenericText", () => {
  it("returns the built-in text when no overrides ride the message", () => {
    expect(effectiveGenericText(genericText, {text: "hi"})).toBe(genericText);
  });

  it("replaces the built-in text with a non-empty promptReplace, trimmed", () => {
    expect(effectiveGenericText(genericText, {promptReplace: "  You are a tutor.  "}))
      .toBe("You are a tutor.");
  });

  it("appends a non-empty promptAppend after the generic text", () => {
    expect(effectiveGenericText(genericText, {promptAppend: "Focus on energy transfer."}))
      .toBe(`${genericText}\n\nFocus on energy transfer.`);
  });

  it("applies replace and append together", () => {
    expect(effectiveGenericText(genericText, {promptReplace: "You are a tutor.", promptAppend: "Be brief."}))
      .toBe("You are a tutor.\n\nBe brief.");
  });

  it("ignores whitespace-only and non-string values", () => {
    expect(effectiveGenericText(genericText, {promptReplace: "   \n", promptAppend: ""})).toBe(genericText);
    expect(effectiveGenericText(genericText, {promptReplace: 42, promptAppend: {text: "x"}})).toBe(genericText);
    expect(effectiveGenericText(genericText, {promptReplace: null})).toBe(genericText);
  });
});

describe("assembleTurnContext", () => {
  it("first turn installs generic prompt + instruction + LEFT and marks the flag", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: left},
    });
    expect(turn.installItems).toHaveLength(3);
    expect(turn.installItems[0]).toBe(genericText);
    expect(turn.installItems[1]).toBe(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(turn.installItems[2]).toContain(left);
    expect(turn.markProblemInstalled).toBe(true);
    expect(turn.input).toEqual([{role: "user", content: "hi"}]);
  });

  it("an empty LEFT installs the generic prompt and the instruction, and leaves the flag unset", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: JSON.stringify({sections: []})},
    });
    expect(turn.installItems).toEqual([genericText, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION]);
    expect(turn.markProblemInstalled).toBe(false);
  });

  it("installs the replaced/appended generic text when overrides ride the first message, and the " +
    "instruction still installs as its own item", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: left, promptReplace: "You are a tutor.", promptAppend: "Be brief."},
    });
    expect(turn.installItems[0]).toBe("You are a tutor.\n\nBe brief.");
    expect(turn.installItems[1]).toBe(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(turn.markProblemInstalled).toBe(true);
  });

  it("an empty LEFT with a replacement installs the replaced text and the instruction, flag unset", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: JSON.stringify({sections: []}), promptReplace: "You are a tutor."},
    });
    expect(turn.installItems).toEqual(["You are a tutor.", UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION]);
    expect(turn.markProblemInstalled).toBe(false);
  });

  it("with no unitContext, the instruction installs but no THE UNIT item does", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: left},
    });
    expect(turn.installItems).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(turn.installItems.some((item) => item.startsWith("THE UNIT"))).toBe(false);
  });

  it("with unitContext present, both the instruction and THE UNIT install", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: false, parentSeq: undefined,
      message: {text: "hi", leftContext: left, unitContext: "prior knowledge and digests"},
    });
    expect(turn.installItems).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    const unitItem = turn.installItems.find((item) => item.startsWith("THE UNIT"));
    expect(unitItem).toContain("prior knowledge and digests");
  });

  it("later turns skip the install entirely, including the instruction", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: true, parentSeq: 3,
      message: {text: "hi", leftContext: left},
    });
    expect(turn.installItems).toEqual([]);
    expect(turn.markProblemInstalled).toBe(false);
  });

  it("later turns ignore prompt overrides riding the message", () => {
    const turn = assembleTurnContext({
      genericText, problemInstalled: true, parentSeq: 3,
      message: {text: "hi", promptReplace: "You are a tutor."},
    });
    expect(turn.installItems).toEqual([]);
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
