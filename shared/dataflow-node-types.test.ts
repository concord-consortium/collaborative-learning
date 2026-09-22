import { displayNameForType, NodeTypes } from "./dataflow-node-types";

// Three callers now share this one lookup — the AI summarizer's graph identifiers, the
// ForeverLearning packet's legacy name fallback, and the name a new block gets when a student adds
// it. They agree only because they read the same table, so the table's contract is pinned here
// rather than re-derived in each caller's tests.
describe("displayNameForType", () => {
  it.each([
    ["Generator", "Waves"],
    ["Logic", "Compare"],
    ["Control", "Hold"],
    ["Demo Output", "Demo Device"],
    ["Live Output", "Live Device"],
  ])("translates the renamed type %s to %s", (type, displayName) => {
    expect(displayNameForType(type)).toBe(displayName);
  });

  it.each(["Sensor", "Number", "Math", "Transform"])(
    "returns %s unchanged for a type whose display name never changed", type => {
      expect(displayNameForType(type)).toBe(type);
    });

  // The Timer block is commented out of the table but still registered in rete-manager, so an old
  // program can contain one. Naming it "Timer" is the point of the fallback: a block a student can
  // see on screen must not reach the AI as an empty string or as "undefined".
  it("falls back to the internal string for the hidden Timer block", () => {
    expect(NodeTypes.some(nt => nt.name === "Timer")).toBe(false);
    expect(displayNameForType("Timer")).toBe("Timer");
  });

  it("falls back to the internal string for a type the palette no longer offers", () => {
    expect(displayNameForType("SomeRetiredBlock")).toBe("SomeRetiredBlock");
  });

  it("passes an empty type through rather than inventing a name", () => {
    expect(displayNameForType("")).toBe("");
  });

  // The summarizer's graph identifier is `displayName:title`, so two types sharing a display name
  // could put two different blocks under one identifier — and that identifier is every edge's
  // endpoint. Today the names are distinct by luck rather than by construction; this fails the
  // moment a rename would break the graph.
  it("gives every block type a distinct display name", () => {
    const displayNames = NodeTypes.map(nt => nt.displayName);
    expect(new Set(displayNames).size).toBe(displayNames.length);
  });
});
