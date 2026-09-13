import "../../models/tiles/text/text-registration";
import { DocumentContentModel } from "../../models/document/document-content";
import { hashString } from "../../../shared/hash-string";
import { decideContext, serializeRight, summarizeRight } from "./right-context";

describe("summarizeRight", () => {
  it("summarizes a live content node to markdown with a stable hash", () => {
    const content = DocumentContentModel.create({
      tiles: [{ id: "text-1", content: { type: "Text", format: "html", text: ["Intro content"] } }]
    } as any);
    const summary = summarizeRight(content);
    expect(summary.markdown).toContain("Intro content");
    expect(summary.hash).toBe(hashString(summary.markdown));
  });
});

describe("hashString", () => {
  it("is deterministic and distinguishes different strings", () => {
    expect(hashString("workspace summary")).toBe(hashString("workspace summary"));
    expect(hashString("workspace summary")).not.toBe(hashString("workspace summary!"));
  });
});

describe("decideContext", () => {
  it("attaches RIGHT on the first send (no hash sent yet)", () => {
    const decision = decideContext({
      leftAlreadyInstalled: false,
      currentRightHash: "abc",
      lastSentRightHash: undefined
    });
    expect(decision.attachRight).toBe(true);
  });

  it("omits RIGHT when the hash is unchanged since the last send", () => {
    const decision = decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "abc",
      lastSentRightHash: "abc"
    });
    expect(decision.attachRight).toBe(false);
  });

  it("re-attaches RIGHT when the summary hash changed", () => {
    const decision = decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "def",
      lastSentRightHash: "abc"
    });
    expect(decision.attachRight).toBe(true);
  });

  it("attaches LEFT while the parent's problemInstalled flag is unset", () => {
    // Covers both the not-yet-created-parent first send and the recovery
    // resend after the server refused to set the flag on an empty LEFT.
    expect(decideContext({
      leftAlreadyInstalled: false,
      currentRightHash: "abc",
      lastSentRightHash: "abc"
    }).attachLeft).toBe(true);
  });

  it("omits LEFT once the parent's problemInstalled flag is set", () => {
    expect(decideContext({
      leftAlreadyInstalled: true,
      currentRightHash: "abc",
      lastSentRightHash: undefined
    }).attachLeft).toBe(false);
  });
});

describe("serializeRight", () => {
  // The ForeverLearning backend projects the document server-side, so what travels is the
  // document itself rather than a summary of it. Same content node, a different reading of it.
  it("serializes a live content node to the snapshot the summarizer reads", () => {
    const content = DocumentContentModel.create({
      tiles: [{ id: "text-1", content: { type: "Text", format: "html", text: ["Intro content"] } }]
    } as any);
    const serialized = serializeRight(content);
    const parsed = JSON.parse(serialized.json);
    // The four keys normalize() walks. Sending anything a snapshot does not have would be
    // sending something the server cannot read back.
    expect(parsed).toHaveProperty("rowMap");
    expect(parsed).toHaveProperty("rowOrder");
    expect(parsed).toHaveProperty("tileMap");
    expect(JSON.stringify(parsed.tileMap)).toContain("Intro content");
  });

  it("hashes what it sends, so the change gate keys on the payload itself", () => {
    const content = DocumentContentModel.create({
      tiles: [{ id: "text-1", content: { type: "Text", format: "html", text: ["Intro"] } }]
    } as any);
    const serialized = serializeRight(content);
    expect(serialized.hash).toBe(hashString(serialized.json));
  });

  it("gives different content different hashes", () => {
    const one = DocumentContentModel.create({
      tiles: [{ id: "t", content: { type: "Text", format: "html", text: ["one"] } }]
    } as any);
    const two = DocumentContentModel.create({
      tiles: [{ id: "t", content: { type: "Text", format: "html", text: ["two"] } }]
    } as any);
    expect(serializeRight(one).hash).not.toBe(serializeRight(two).hash);
  });
});
