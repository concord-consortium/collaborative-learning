// Tests for the ForeverLearning tutor backend behind the TutorProvider seam: the packet it builds,
// the session state it earns, and what it does with a reply that arrives only partly.
//
// The HTTP client is injected rather than mocked globally, so each test states the stream it is
// answering with. Assertions prefer the returned TurnResult; the injected client is inspected only
// where the behavior under test is a request the provider is supposed to make.
import {CollectedStream, emptyStream} from "../../shared/fl-packet/sse";
import {ContextPacket, kMaxPacketBytes} from "../../shared/fl-packet/packet";
import {createFlProvider} from "../src/chat/fl-provider";

const kConfig = {baseUrl: "https://api.example.test", apiKey: "k", solutionId: "concordclue"};
const kCommit = "a".repeat(40);
const kProtection = {
  classes: ["protected_threshold_value" as const],
  patternRefs: ["protected:brain-1"],
};

const program = {
  id: "p1",
  nodes: {
    "n-logic": {id: "n-logic", data: {
      type: "Logic", orderedDisplayName: "Compare 1", logicOperator: "Greater Than",
      tickEntries: {t1: {nodeValue: "0"}},
    }},
  },
  connections: {},
  recentTicks: ["t1"],
};

function aDocument() {
  return {
    content: {
      rowOrder: ["row-1"],
      rowMap: {"row-1": {id: "row-1", tiles: [{tileId: "tile-df-1"}]}},
      tileMap: {"tile-df-1": {id: "tile-df-1", title: "Gripper", content: {
        type: "Dataflow", program,
      }}},
      sharedModelMap: {},
    },
    documentId: "doc-1",
    revision: "r22",
  };
}

function aReply(opts: {conversation?: string; directives?: unknown[]; complete?: boolean} = {}) {
  const display = JSON.stringify({
    schema_version: "clue.response_packet.v2",
    diagnostic_status: "insufficient_evidence",
    student: {
      surface: "student", message: "Compare the readings.",
      one_next_action: "Write down one relaxed reading.", support_level: "probe",
    },
    teacher: {}, skill_assessments: [],
    components: [{
      component_ref: {tile_id: "tile-df-1", type: "Dataflow"},
      directives: opts.directives ?? [], evidence_refs: [],
    }],
    evidence_used: [], answer_protection: {}, do_not_disclose: [],
  });
  return {
    ...emptyStream(),
    conversation: opts.conversation ?? "Compare the readings. What do you notice?",
    display,
    sessionId: "sess-1",
    stopReason: "end_turn",
    complete: opts.complete ?? true,
    displayComplete: true,
  } as CollectedStream;
}

const highlightDirective = {
  directive_id: "d-1", tier: "observe", op: "highlight", basis_revision: "r22",
  target: {kind: "node", tile_id: "tile-df-1", id: "n-logic"},
};

function provider(overrides: {
  reply?: CollectedStream;
  chat?: jest.Mock;
  document?: ReturnType<typeof aDocument> | undefined;
} = {}) {
  const chat = overrides.chat ?? jest.fn(async () => overrides.reply ?? aReply());
  const hasDocument = "document" in overrides ? overrides.document : aDocument();
  return {
    chat,
    provider: createFlProvider({
      config: kConfig,
      catalogCommit: kCommit,
      protection: kProtection,
      readDocument: async () => hasDocument,
      resolveUserId: () => "clue:authed/learn_concord_org/users/42",
      newTraceId: () => "trace-new",
      chat: chat as never,
    }),
  };
}

const aMessage = (over: Record<string, unknown> = {}) =>
  ({uid: "user-42", tutorUserId: "clue:authed/learn_concord_org/users/42",
    text: "Is my program right?", ...over});

describe("createFlProvider", () => {
  it("sends the student's text with a packet built from their document", async () => {
    const {chat, provider: p} = provider();
    await p.processTurn({}, aMessage());

    const [, args] = chat.mock.calls[0];
    // The server-derived identity, not the bare platform id — see shared/tutor-user-id.
    expect(args.userId).toBe("clue:authed/learn_concord_org/users/42");
    expect(args.prompt).toBe("Is my program right?");
    const packet = args.context as ContextPacket;
    expect(packet.schema_version).toBe("clue.context_packet.v2");
    expect(packet.workspace_state!.document_id).toBe("doc-1");
    expect(packet.workspace_state!.tiles.map((t) => t.tile_id)).toEqual(["tile-df-1"]);
  });

  // The prose part, not the packet's student.message — the two differ, and where they do the prose
  // carries the next action.
  it("returns the prose reply as the assistant text", async () => {
    const {provider: p} = provider();
    const result = await p.processTurn({}, aMessage());
    expect(result.assistantText).toBe("Compare the readings. What do you notice?");
  });

  it("resolves directives against the packet it sent", async () => {
    const {provider: p} = provider({reply: aReply({directives: [highlightDirective]})});
    const result = await p.processTurn({}, aMessage());
    expect(result.highlights).toEqual([
      {tileId: "tile-df-1", objectId: "n-logic", label: "Compare 1"},
    ]);
  });

  // Optional, not an empty array: a backend with nothing to point at says nothing.
  it("omits highlights entirely when the reply asked for none", async () => {
    const {provider: p} = provider();
    const result = await p.processTurn({}, aMessage());
    expect(result.highlights).toBeUndefined();
  });

  it("earns the session and trace ids on a first turn", async () => {
    const {provider: p} = provider();
    const result = await p.processTurn({}, aMessage());
    expect(result.parentUpdate).toEqual({
      flSessionId: "sess-1", flTraceId: "trace-new", flTurn: 1,
    });
  });

  it("continues an existing session rather than opening another", async () => {
    const {chat, provider: p} = provider();
    const result = await p.processTurn(
      {flSessionId: "sess-1", flTraceId: "trace-old", flTurn: 3}, aMessage());
    expect(chat.mock.calls[0][1].sessionId).toBe("sess-1");
    // Only the turn advances; ids already held are not rewritten.
    expect(result.parentUpdate).toEqual({flTurn: 4});
  });

  // trace_id identifies the conversation and request_id the turn within it, so a reader can put
  // one turn's packet next to the reply it produced.
  it("stamps the turn and a per-turn request id on the envelope", async () => {
    const {chat, provider: p} = provider();
    await p.processTurn({flTraceId: "trace-old", flTurn: 2}, aMessage());
    const packet = chat.mock.calls[0][1].context as ContextPacket;
    expect(packet.envelope.trace).toEqual({
      trace_id: "trace-old", request_id: "trace-old-t3", turn: 3,
    });
  });

  // The envelope is the only section a packet cannot omit. A turn with no document to describe is
  // still a turn, and sending an envelope-only packet says "no workspace" rather than inventing an
  // empty one.
  it("sends an envelope-only packet when there is no document to describe", async () => {
    const {chat, provider: p} = provider({document: undefined});
    const result = await p.processTurn({}, aMessage());
    const packet = chat.mock.calls[0][1].context as ContextPacket;
    expect(packet.workspace_state).toBeUndefined();
    expect(packet.envelope).toBeDefined();
    expect(result.assistantText).toBe("Compare the readings. What do you notice?");
  });

  // The prose and the packet are separate parts of one stream, and one can arrive without the
  // other. Losing the directives is not a reason to lose the reply.
  it("still replies when the display part did not parse", async () => {
    const broken = {...aReply(), display: "{\"schema_version\": \"clue.resp"};
    const {provider: p} = provider({reply: broken});
    const result = await p.processTurn({}, aMessage());
    expect(result.assistantText).toBe("Compare the readings. What do you notice?");
    expect(result.highlights).toBeUndefined();
  });

  it("falls back to the packet's message when no prose arrived", async () => {
    const {provider: p} = provider({reply: aReply({conversation: ""})});
    const result = await p.processTurn({}, aMessage());
    expect(result.assistantText).toBe("Compare the readings.");
  });

  // A turn that produced nothing is a failed turn. The drain's catch turns a throw into
  // status:"error", which is what clears the client's indicator honestly.
  it("throws when the stream produced no reply at all", async () => {
    const silent = {...emptyStream(), complete: true} as CollectedStream;
    const {provider: p} = provider({reply: silent});
    await expect(p.processTurn({}, aMessage())).rejects.toThrow(/no reply/i);
  });

  // Session state is earned by a successful turn, exactly as the OpenAI path earns its
  // conversation id: a turn that throws returns no TurnResult, so the drain commits no
  // parentUpdate and the next turn starts from the state before this one.
  it("surfaces a failed call and returns no turn result to persist", async () => {
    const chat = jest.fn(async () => {
      throw new Error("ForeverLearning chat request failed with status 503");
    });
    const {provider: p} = provider({chat});
    await expect(p.processTurn({}, aMessage())).rejects.toThrow(/503/);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  // status, lockedAt and error belong to the drain; a provider that writes them corrupts the lock.
  it("returns no drain-owned parent fields", async () => {
    const {provider: p} = provider();
    const result = await p.processTurn({}, aMessage());
    for (const field of ["status", "lockedAt", "error"]) {
      expect(result.parentUpdate).not.toHaveProperty(field);
    }
  });
});

// Every FL turn needs a workspace even when the client did not resend one — see FlDocument.raw.
describe("createFlProvider document reuse", () => {
  function providerWith(document: ReturnType<typeof aDocument> & {raw?: string}) {
    const chat = jest.fn(async () => aReply());
    return {
      chat,
      provider: createFlProvider({
        config: kConfig,
        catalogCommit: kCommit,
        protection: kProtection,
        readDocument: async () => document,
        resolveUserId: () => "clue:qa/r/users/42",
        newTraceId: () => "trace-new",
        chat: chat as never,
      }),
    };
  }

  it("persists the document it used so a later turn can reuse it", async () => {
    const raw = JSON.stringify({rowOrder: []});
    const {provider: p} = providerWith({...aDocument(), raw});
    const result = await p.processTurn({}, aMessage());
    expect(result.parentUpdate.flContent).toBe(raw);
  });

  // Rewriting an unchanged document would put the whole workspace back on the parent doc every
  // turn, for a value that did not move.
  it("does not rewrite a document the parent already holds", async () => {
    const raw = JSON.stringify({rowOrder: []});
    const {provider: p} = providerWith({...aDocument(), raw});
    const result = await p.processTurn({flContent: raw, flTurn: 1}, aMessage());
    expect(result.parentUpdate).not.toHaveProperty("flContent");
  });

  it("persists nothing when there was no document to describe", async () => {
    const chat = jest.fn(async () => aReply());
    const p = createFlProvider({
      config: kConfig, catalogCommit: kCommit, protection: kProtection,
      readDocument: async () => undefined, newTraceId: () => "t", chat: chat as never,
      resolveUserId: () => "clue:qa/r/users/42",
    });
    const result = await p.processTurn({}, aMessage());
    expect(result.parentUpdate).not.toHaveProperty("flContent");
  });
});

// ForeverLearning keys cross-session memory on X-User-Id, so this identity decides whose tutoring
// history a turn reads and writes. It is derived by the caller from the trigger path and the
// rules-pinned uid — never taken from the message, which the rules only type-check.
describe("createFlProvider user identity", () => {
  it("refuses the turn when the caller cannot derive an identity", async () => {
    const chat = jest.fn(async () => aReply());
    const p = createFlProvider({
      config: kConfig, catalogCommit: kCommit, protection: kProtection,
      readDocument: async () => undefined, newTraceId: () => "t", chat: chat as never,
      resolveUserId: () => "",
    });
    await expect(p.processTurn({}, aMessage())).rejects.toThrow(/derive a tutor user id/i);
    expect(chat).not.toHaveBeenCalled();
  });

  // The defect this design exists to make impossible: a student writing a classmate's identity
  // onto their own message and reading that classmate's tutoring memory. The rules pin uid but
  // cannot pin an arbitrary string, so the provider must not read one.
  it("ignores any identity asserted on the message itself", async () => {
    const {chat, provider: p} = provider();
    await p.processTurn({}, aMessage({
      canonicalUserId: "https://learn.concord.org/users/999",
      tutorUserId: "clue:authed/learn_concord_org/users/999",
      uid: "999",
    }));
    expect(chat.mock.calls[0][1].userId).toBe("clue:authed/learn_concord_org/users/42");
  });
});

// flChat reports a stream that never received `done` as complete:false. Writing that partial prose
// as the assistant's reply would present a truncated answer as a finished one — and worse, advance
// flTurn and persist flSessionId, so the next turn continues from a turn that did not happen.
describe("createFlProvider incomplete streams", () => {
  it("refuses a stream that never finished, however much prose arrived", async () => {
    const cut = {...aReply(), complete: false};
    const {provider: p} = provider({reply: cut});
    await expect(p.processTurn({}, aMessage())).rejects.toThrow(/incomplete|did not finish/i);
  });
});

// A failed turn leaves the drain's cursor unadvanced, so every later trigger re-processes the same
// message first — and that message's rightContent is immutable. An over-cap packet therefore
// rebuilds identically forever: if ForeverLearning ever rejects one, the conversation is wedged,
// and the student cannot free it by shrinking their document because the stale message payload
// still wins over the copy held on the parent. Sending something that fits is what keeps a turn
// recoverable.
describe("createFlProvider over-cap packets", () => {
  function hugeDocument() {
    // Wide rather than tall: the default case sample keeps 50 rows, so a tall table truncates to
    // something small. Large cell values survive sampling and are what actually pushes a real
    // workspace over the cap.
    const values = Array.from({length: 60}, (_, i) => `${i}`.padEnd(2000, "x"));
    return {
      content: {
        rowOrder: ["row-1"],
        rowMap: {"row-1": {id: "row-1", tiles: [{tileId: "t-tbl"}]}},
        tileMap: {"t-tbl": {id: "t-tbl", content: {type: "Table"}}},
        sharedModelMap: {
          "sm-data": {
            sharedModel: {
              type: "SharedDataSet", id: "sm-data",
              dataSet: {id: "ds", name: "Big",
                attributes: [{id: "a", name: "a", values}],
                cases: values.map((_, i) => ({__id__: `c${i}`}))},
            },
            tiles: ["t-tbl"],
          },
        },
      },
      documentId: "doc-big", revision: "r1",
    };
  }

  it("sends a packet that fits, rather than one known to exceed the cap", async () => {
    const chat: jest.Mock = jest.fn(async () => aReply());
    const p = createFlProvider({
      config: kConfig, catalogCommit: kCommit, protection: kProtection,
      readDocument: async () => hugeDocument(), newTraceId: () => "t", chat: chat as never,
      resolveUserId: () => "clue:class/c/users/1",
    });
    await p.processTurn({}, aMessage());
    const sent = JSON.stringify(chat.mock.calls[0][1].context);
    expect(new TextEncoder().encode(sent).length).toBeLessThanOrEqual(kMaxPacketBytes);
  });

  // Degraded, not silently emptied: the reader must be able to tell a workspace we could not fit
  // from one the student never had.
  it("declares what it had to drop to fit", async () => {
    const chat: jest.Mock = jest.fn(async () => aReply());
    const p = createFlProvider({
      config: kConfig, catalogCommit: kCommit, protection: kProtection,
      readDocument: async () => hugeDocument(), newTraceId: () => "t", chat: chat as never,
      resolveUserId: () => "clue:class/c/users/1",
    });
    await p.processTurn({}, aMessage());
    const ctx = chat.mock.calls[0][1].context as ContextPacket;
    expect(ctx.workspace_state?.omitted).toEqual(
      expect.arrayContaining([expect.objectContaining({kind: "workspace_over_cap"})]));
    expect(ctx.workspace_state?.document_id).toBe("doc-big");
  });
});
