import {parseTutorReply} from "../src/chat/openai";

describe("parseTutorReply", () => {
  it("reads userText and highlights", () => {
    const reply = parseTutorReply(JSON.stringify({
      userText: "Try the block that reads the sensor.",
      highlights: [{tileId: "t1", objectId: "n1", label: "the block that reads the sensor"}],
    }));
    expect(reply.userText).toBe("Try the block that reads the sensor.");
    expect(reply.highlights).toEqual([
      {tileId: "t1", objectId: "n1", label: "the block that reads the sensor"},
    ]);
  });

  it("defaults highlights to an empty array when absent", () => {
    expect(parseTutorReply(JSON.stringify({userText: "hi"})).highlights).toEqual([]);
  });

  it("defaults highlights to an empty array when not an array", () => {
    expect(parseTutorReply(JSON.stringify({userText: "hi", highlights: "nope"})).highlights).toEqual([]);
  });

  it("drops entries missing a required field rather than passing them through", () => {
    const reply = parseTutorReply(JSON.stringify({
      userText: "hi",
      highlights: [
        {tileId: "t1", objectId: "n1", label: "ok"},
        {tileId: "t2", objectId: "n2"},
        {tileId: "t3", label: "no object"},
        null,
      ],
    }));
    expect(reply.highlights).toEqual([{tileId: "t1", objectId: "n1", label: "ok"}]);
  });

  it("coerces a missing or non-string userText to null", () => {
    expect(parseTutorReply(JSON.stringify({highlights: []})).userText).toBeNull();
    expect(parseTutorReply(JSON.stringify({userText: 7, highlights: []})).userText).toBeNull();
  });

  it("drops entries with empty strings in required fields", () => {
    const reply = parseTutorReply(JSON.stringify({
      userText: "hi",
      highlights: [
        {tileId: "t1", objectId: "n1", label: "ok"},
        {tileId: "", objectId: "n2", label: "empty tile"},
        {tileId: "t3", objectId: "", label: "empty object"},
        {tileId: "t4", objectId: "n4", label: ""},
      ],
    }));
    expect(reply.highlights).toEqual([{tileId: "t1", objectId: "n1", label: "ok"}]);
  });
});
