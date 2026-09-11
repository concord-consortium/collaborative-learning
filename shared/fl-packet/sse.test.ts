import { collectEvent, collectSseText, emptyStream, SseParser } from "./sse";

// Verbatim from a captured concordclue stream. Two content streams are interleaved on one
// connection and told apart by `part`.
const kStream = [
  `data: {"type":"metadata","displayName":"CLUE DataFlow Diagnostic 0.11","sessionId":"9de1f94f"}`,
  ``,
  `data: {"type":"retrieval_status","status":"no_content"}`,
  ``,
  `data: {"type":"content","part":"conversation","text":"You"}`,
  ``,
  `data: {"type":"content","part":"conversation","text":" tested"}`,
  ``,
  `data: {"type":"content","part":"display","text":"{\\"a\\":"}`,
  ``,
  `data: {"type":"content","part":"display","text":"1}"}`,
  ``,
  `data: {"type":"display_complete"}`,
  ``,
  `data: {"type":"done","sessionId":"9de1f94f","displayName":"CLUE DataFlow Diagnostic 0.11",` +
    `"stopReason":"end_turn"}`,
  ``,
// A real capture ends 0a0a: the last event is followed by a blank line like every other.
].join("\n") + "\n";

describe("SseParser", () => {
  it("reads the events of a whole stream", () => {
    const events = new SseParser().push(kStream);
    expect(events.map(e => e.type)).toEqual([
      "metadata", "retrieval_status", "content", "content", "content", "content",
      "display_complete", "done",
    ]);
  });

  // The one thing a streaming reader exists to do. A network read does not arrive in event-sized
  // pieces, and with the response packet streaming as ~2,500 fragments of a single JSON document,
  // one dropped fragment is a packet that will not parse.
  it("reassembles an event split across two chunks", () => {
    const parser = new SseParser();
    const split = Math.floor(kStream.length / 2);
    const first = parser.push(kStream.slice(0, split));
    const second = parser.push(kStream.slice(split));
    expect([...first, ...second].map(e => e.type)).toEqual([
      "metadata", "retrieval_status", "content", "content", "content", "content",
      "display_complete", "done",
    ]);
  });

  it("reassembles a stream arriving one character at a time", () => {
    const parser = new SseParser();
    const events = [];
    for (const ch of kStream) events.push(...parser.push(ch));
    expect(events.map(e => e.type)).toContain("done");
    expect(events).toHaveLength(8);
  });

  it("reads events separated by CRLF", () => {
    const events = new SseParser().push(kStream.replace(/\n/g, "\r\n"));
    expect(events).toHaveLength(8);
    expect(events[0].type).toBe("metadata");
  });

  // FL sends none of these today. Ignoring rather than choking on them is what makes this a reader
  // of the protocol rather than of one server's current habits.
  it("ignores comment, event and id lines", () => {
    const events = new SseParser().push(
      `: keep-alive\nevent: message\nid: 7\ndata: {"type":"done"}\n\n`);
    expect(events.map(e => e.type)).toEqual(["done"]);
  });

  // A well-formed stream ends on a blank line. The alternative to flushing is silently discarding
  // the last event of a stream that ended a byte early — and that event is `done`.
  it("flushes a trailing event that arrived without its separator", () => {
    const parser = new SseParser();
    expect(parser.push(`data: {"type":"done","stopReason":"end_turn"}`)).toEqual([]);
    expect(parser.end().map(e => e.type)).toEqual(["done"]);
  });

  it("drops a malformed event rather than abandoning the stream", () => {
    const events = new SseParser().push(
      `data: {not json\n\ndata: {"type":"done"}\n\n`);
    expect(events.map(e => e.type)).toEqual(["done"]);
  });

  it("drops a data payload that is not an object with a type", () => {
    const events = new SseParser().push(`data: "just a string"\n\ndata: {"no":"type"}\n\n`);
    expect(events).toEqual([]);
  });
});

describe("collectSseText", () => {
  it("reassembles the two interleaved streams separately", () => {
    const state = collectSseText(kStream);
    expect(state.conversation).toBe("You tested");
    expect(state.display).toBe('{"a":1}');
  });

  it("reports the session, the model and why the stream stopped", () => {
    const state = collectSseText(kStream);
    expect(state.sessionId).toBe("9de1f94f");
    expect(state.displayName).toBe("CLUE DataFlow Diagnostic 0.11");
    expect(state.stopReason).toBe("end_turn");
    expect(state.complete).toBe(true);
    expect(state.displayComplete).toBe(true);
  });

  // "ok" does not mean our context was ingested — it means nothing failed, and it is returned with
  // no retrieval configured at all. Passing it through unjudged is the point.
  it("passes the retrieval status through without interpreting it", () => {
    expect(collectSseText(kStream).retrievalStatus).toBe("no_content");
  });

  // A stream cut off mid-flight must be distinguishable from one that finished, or a truncated
  // reply gets written to the student as though it were the whole answer.
  it("reports a stream that ended without done as incomplete", () => {
    const cut = kStream.slice(0, kStream.indexOf(`data: {"type":"display_complete"}`));
    const state = collectSseText(cut);
    expect(state.complete).toBe(false);
    expect(state.displayComplete).toBe(false);
    expect(state.conversation).toBe("You tested");
  });

  it("ignores an event type it has never seen", () => {
    const state = collectSseText(
      `data: {"type":"some_new_thing","payload":1}\n\ndata: {"type":"done"}\n\n`);
    expect(state.complete).toBe(true);
    expect(state.conversation).toBe("");
  });

  it("accumulates into a caller-held state, one event at a time", () => {
    const state = emptyStream();
    collectEvent(state, { type: "content", part: "conversation", text: "a" });
    collectEvent(state, { type: "content", part: "conversation", text: "b" });
    expect(state.conversation).toBe("ab");
    expect(state.complete).toBe(false);
  });
});
