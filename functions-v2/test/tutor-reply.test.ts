import {parseTutorReply} from "../src/chat/openai";
import {buildAssistantDoc} from "../src/chat/drain";

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

  // The client decides a reply is silent by testing `userText == null`, which an empty string
  // passes through -- rendering an empty bubble. Whitespace-only is the same case.
  it("coerces a blank userText to null, highlights and all", () => {
    expect(parseTutorReply(JSON.stringify({userText: "", highlights: []})).userText).toBeNull();
    expect(parseTutorReply(JSON.stringify({userText: "  \n", highlights: []})).userText).toBeNull();
    // A blank reply carrying valid highlights is silent too: the buttons label words that the
    // reply never said, so there is nothing for them to point back at.
    const withHighlights = parseTutorReply(JSON.stringify({
      userText: "",
      highlights: [{tileId: "t1", objectId: "n1", label: "the sensor"}],
    }));
    expect(withHighlights.userText).toBeNull();
    // Emptied, not merely unrendered: the client drops the whole turn on a null userText, so
    // anything left here would be written to Firestore and read by nothing.
    expect(withHighlights.highlights).toEqual([]);
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

describe("buildAssistantDoc", () => {
  const owner = {uid: "u1", context_id: "c1"};

  it("carries highlights when there are any", () => {
    const doc = buildAssistantDoc(
      {userText: "look here", highlights: [{tileId: "t1", objectId: "n1", label: "the sensor"}]},
      owner);
    expect(doc.kind).toBe("assistant");
    expect(doc.userText).toBe("look here");
    expect(doc.highlights).toEqual([{tileId: "t1", objectId: "n1", label: "the sensor"}]);
    expect(doc.uid).toBe("u1");
  });

  it("omits the field entirely when there are none", () => {
    const doc = buildAssistantDoc({userText: "hi", highlights: []}, owner);
    expect("highlights" in doc).toBe(false);
  });
});
