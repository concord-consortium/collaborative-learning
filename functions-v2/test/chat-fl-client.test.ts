// Tests for the ForeverLearning HTTP client: the request it builds and the stream it reads back.
//
// fetch is injected rather than mocked globally, because the thing worth testing is the request
// we construct and the chunk handling on the way back — both of which a fake fetch states plainly.
import {ContextPacket} from "../../shared/fl-packet/packet";
import {flChat} from "../src/chat/fl-client";

const kConfig = {
  baseUrl: "https://api.example.test",
  apiKey: "key-123",
  solutionId: "concordclue",
};

const kContext = {
  schema_version: "clue.context_packet.v2",
  envelope: {trace: {trace_id: "t1"}},
} as unknown as ContextPacket;

// One SSE event. Built rather than written out so the JSON quoting stays readable; the wire form
// itself is pinned verbatim by the parser's own tests in shared/fl-packet.
const line = (event: unknown) => `data: ${JSON.stringify(event)}`;
const kDisplay = JSON.stringify({ok: 1});

// A real capture ends on a blank line like every other event.
const kStream = [
  line({type: "metadata", sessionId: "sess-1"}),
  line({type: "content", part: "conversation", text: "Compare"}),
  line({type: "content", part: "conversation", text: " them."}),
  line({type: "content", part: "display", text: kDisplay}),
  line({type: "display_complete"}),
  line({type: "done", sessionId: "sess-1", stopReason: "end_turn"}),
].join("\n\n") + "\n\n";

// A fetch that yields the given chunks as a real body would: bytes, in pieces of its choosing.
function fakeFetch(chunks: string[], init?: {ok?: boolean; status?: number}) {
  const calls: Array<{url: string; init: any}> = [];
  const impl = jest.fn(async (url: string, reqInit: any) => {
    calls.push({url, init: reqInit});
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      body: (async function* () {
        const encoder = new TextEncoder();
        for (const chunk of chunks) yield encoder.encode(chunk);
      })(),
    };
  });
  return {impl: impl as unknown as typeof fetch, calls};
}

describe("flChat", () => {
  it("posts the packet to the chat endpoint with the solution and user identified", async () => {
    const {impl, calls} = fakeFetch([kStream]);
    await flChat({...kConfig, fetchImpl: impl}, {
      userId: "user-42", prompt: "Is my program right?", context: kContext,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.example.test/v1/chat");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      "X-Solution-Id": "concordclue",
      "X-User-Id": "user-42",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(calls[0].init.body);
    expect(body.prompt).toBe("Is my program right?");
    expect(body.context.schema_version).toBe("clue.context_packet.v2");
  });

  it("carries the api key without putting it in the body", async () => {
    const {impl, calls} = fakeFetch([kStream]);
    await flChat({...kConfig, fetchImpl: impl}, {
      userId: "user-42", prompt: "hi", context: kContext,
    });
    expect(JSON.stringify(calls[0].init.headers)).toContain("key-123");
    expect(calls[0].init.body).not.toContain("key-123");
  });

  // Absent rather than null on a first turn: the field is what tells FL to continue an existing
  // session, and sending an empty one is a different statement from not sending it.
  it("sends a session id only when continuing a session", async () => {
    const first = fakeFetch([kStream]);
    await flChat({...kConfig, fetchImpl: first.impl}, {
      userId: "u", prompt: "hi", context: kContext,
    });
    expect(JSON.parse(first.calls[0].init.body).session_id).toBeUndefined();

    const second = fakeFetch([kStream]);
    await flChat({...kConfig, fetchImpl: second.impl}, {
      userId: "u", prompt: "hi", context: kContext, sessionId: "sess-1",
    });
    expect(JSON.parse(second.calls[0].init.body).session_id).toBe("sess-1");
  });

  it("collects the streamed reply", async () => {
    const {impl} = fakeFetch([kStream]);
    const stream = await flChat({...kConfig, fetchImpl: impl}, {
      userId: "u", prompt: "hi", context: kContext,
    });
    expect(stream.conversation).toBe("Compare them.");
    expect(stream.display).toBe(kDisplay);
    expect(stream.sessionId).toBe("sess-1");
    expect(stream.stopReason).toBe("end_turn");
    expect(stream.complete).toBe(true);
  });

  // A real body arrives in pieces that have nothing to do with event boundaries.
  it("reads a reply split across arbitrary chunk boundaries", async () => {
    const chunks = [];
    for (let i = 0; i < kStream.length; i += 7) chunks.push(kStream.slice(i, i + 7));
    const {impl} = fakeFetch(chunks);
    const stream = await flChat({...kConfig, fetchImpl: impl}, {
      userId: "u", prompt: "hi", context: kContext,
    });
    expect(stream.conversation).toBe("Compare them.");
    expect(stream.complete).toBe(true);
  });

  // The status has to reach the caller: 401 is an expired or wrong key, and it is byte-identical
  // to three other causes, so the number is the only thing distinguishing it from a 500.
  it("throws with the status when the request is refused", async () => {
    const {impl} = fakeFetch([""], {ok: false, status: 401});
    await expect(flChat({...kConfig, fetchImpl: impl}, {
      userId: "u", prompt: "hi", context: kContext,
    })).rejects.toThrow(/401/);
  });

  it("throws when the response carries no body to read", async () => {
    const impl = jest.fn(async () => ({ok: true, status: 200, body: null})) as unknown as
      typeof fetch;
    await expect(flChat({...kConfig, fetchImpl: impl}, {
      userId: "u", prompt: "hi", context: kContext,
    })).rejects.toThrow(/body/i);
  });

  // A stream that stops early is not a reply. Reporting it as one would write a truncated answer
  // to the student as though it were complete.
  it("returns an incomplete stream rather than pretending it finished", async () => {
    const cut = kStream.slice(0, kStream.indexOf(line({type: "display_complete"})));
    const {impl} = fakeFetch([cut]);
    const stream = await flChat({...kConfig, fetchImpl: impl}, {
      userId: "u", prompt: "hi", context: kContext,
    });
    expect(stream.complete).toBe(false);
    expect(stream.conversation).toBe("Compare them.");
  });
});
