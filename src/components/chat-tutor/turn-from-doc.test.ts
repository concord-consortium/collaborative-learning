import { turnFromDoc } from "./turn-from-doc";

describe("turnFromDoc", () => {
  it("maps a user message", () => {
    expect(turnFromDoc("d1", { kind: "user", text: "hello" }, true))
      .toEqual({ id: "d1", sender: "user", text: "hello", pending: true });
  });

  it("maps an assistant message with highlights", () => {
    const turn = turnFromDoc("d2", {
      kind: "assistant",
      userText: "Try this.",
      highlights: [{ tileId: "t1", objectId: "n1", label: "the sensor block" }]
    }, false);
    expect(turn).toEqual({
      id: "d2", sender: "assistant", text: "Try this.",
      highlights: [{ tileId: "t1", objectId: "n1", label: "the sensor block" }]
    });
  });

  it("omits highlights when the field is absent", () => {
    const turn = turnFromDoc("d3", { kind: "assistant", userText: "Try this." }, false);
    expect(turn).toEqual({ id: "d3", sender: "assistant", text: "Try this." });
  });

  it("drops malformed highlight entries", () => {
    const turn = turnFromDoc("d4", {
      kind: "assistant", userText: "hi",
      highlights: [{ tileId: "t1", objectId: "n1", label: "ok" }, { tileId: "t2" }]
    }, false);
    expect(turn?.highlights).toEqual([{ tileId: "t1", objectId: "n1", label: "ok" }]);
  });

  it("returns undefined for a silent assistant reply", () => {
    expect(turnFromDoc("d5", { kind: "assistant", userText: null }, false)).toBeUndefined();
  });

  it("returns undefined for an unknown kind", () => {
    expect(turnFromDoc("d6", { kind: "system" }, false)).toBeUndefined();
  });
});
