import { isTutorHighlight } from "../chat-tutor-highlight";
import { ContextPacket } from "./packet";
import { parseResponsePacket, replyText, responseHighlights } from "./response";
import { emptyStream } from "./sse";

// The structure is ForeverLearning's; the wording is ours, so nothing they wrote is committed here.
function aResponse(directives: unknown[]) {
  return JSON.stringify({
    schema_version: "clue.response_packet.v2",
    diagnostic_status: "misconception",
    student: {
      surface: "student", message: "Compare the two readings you recorded.",
      one_next_action: "Write down the value your sensor shows when relaxed.",
      support_level: "probe",
    },
    teacher: { tip: "t", diagnosis_summary: "d", hypotheses: [], recommended_move: "m" },
    skill_assessments: [],
    components: [
      { component_ref: { tile_id: "tile-df-1", type: "Dataflow" },
        directives, evidence_refs: [] },
    ],
    evidence_used: [],
    answer_protection: { no_canonical_solution: true, no_protected_values: true,
                         no_binary_stamp: true, no_context_leak: true,
                         surface_separation_held: true },
    do_not_disclose: [],
  });
}

const nodeDirective = (id: string, tileId = "tile-df-1") => ({
  directive_id: `d-${id}`, tier: "observe", op: "highlight", basis_revision: "r22",
  target: { kind: "node", tile_id: tileId, id },
});

// Only what responseHighlights reads: the tiles we said existed and the nodes inside them.
const sentPacket = {
  schema_version: "clue.context_packet.v2",
  envelope: {} as any,
  workspace_state: {
    document_id: "doc-1", revision: "r22",
    tiles: [
      { tile_id: "tile-df-1", type: "Dataflow", title: "Gripper Program", content: {
        program_id: "p1", edges: [], rendering: "",
        nodes: [
          { id: "n-sensor", type: "Sensor", orderedDisplayName: "Sensor 1" },
          { id: "n-logic", type: "Logic", orderedDisplayName: "Compare 1" },
        ],
      } },
      { tile_id: "tile-tx-1", type: "Text", content: { text: "notes" } },
    ],
  },
} as unknown as ContextPacket;

describe("parseResponsePacket", () => {
  it("parses a packet and reads the student's message", () => {
    const packet = parseResponsePacket(aResponse([]))!;
    expect(packet.student.message).toBe("Compare the two readings you recorded.");
    expect(packet.diagnostic_status).toBe("misconception");
  });

  // The display stream can be cut off mid-JSON, and a half-packet must not read as a reply.
  it("returns undefined for JSON it cannot parse", () => {
    expect(parseResponsePacket('{"schema_version": "clue.response')).toBeUndefined();
  });

  it("returns undefined for valid JSON that is not a response packet", () => {
    expect(parseResponsePacket('{"hello": "world"}')).toBeUndefined();
    expect(parseResponsePacket("[]")).toBeUndefined();
  });

  // A packet with nothing to say to the student cannot become a turn, and treating it as one
  // would write an empty reply the client renders as a finished answer.
  it("returns undefined for a packet carrying no student message", () => {
    const noMessage = JSON.parse(aResponse([]));
    noMessage.student.message = "";
    expect(parseResponsePacket(JSON.stringify(noMessage))).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(parseResponsePacket("")).toBeUndefined();
  });
});

describe("responseHighlights", () => {
  // The directive carries no label — op_highlight is additionalProperties:false with no field for
  // one — but CLUE renders a button, and a button with no words on it is worse than no button.
  // The name comes from the node as we described it in the packet we sent.
  it("labels a node highlight with the name we sent for that node", () => {
    const packet = parseResponsePacket(aResponse([nodeDirective("n-logic")]))!;
    expect(responseHighlights(packet, sentPacket)).toEqual([
      { tileId: "tile-df-1", objectId: "n-logic", label: "Compare 1" },
    ]);
  });

  it("treats a focus directive as pointing at the same thing", () => {
    const focus = { ...nodeDirective("n-sensor"), op: "focus" };
    expect(responseHighlights(parseResponsePacket(aResponse([focus]))!, sentPacket)).toEqual([
      { tileId: "tile-df-1", objectId: "n-sensor", label: "Sensor 1" },
    ]);
  });

  // Fail closed. An id we cannot match against what we sent is either a tile that has since gone
  // or a node the diagnostic invented; both produce a button that resolves to nothing, and a
  // button that cannot resolve is worse than no button.
  it("drops a directive naming a tile we did not send", () => {
    const packet = parseResponsePacket(aResponse([nodeDirective("n-logic", "tile-gone")]))!;
    expect(responseHighlights(packet, sentPacket)).toEqual([]);
  });

  it("drops a directive naming a node that tile does not contain", () => {
    const packet = parseResponsePacket(aResponse([nodeDirective("n-invented")]))!;
    expect(responseHighlights(packet, sentPacket)).toEqual([]);
  });

  it("drops a directive aimed at a tile with no nodes to address", () => {
    const packet = parseResponsePacket(aResponse([nodeDirective("n-logic", "tile-tx-1")]))!;
    expect(responseHighlights(packet, sentPacket)).toEqual([]);
  });

  // A wire is not a thing CLUE can highlight: highlights address discrete objects with an id, and
  // a wire is the relationship between two of them.
  it("drops a wire target", () => {
    const wire = { directive_id: "d-w", tier: "observe", op: "highlight", basis_revision: "r22",
                   target: { kind: "wire", tile_id: "tile-df-1", from: "n-sensor",
                             to: "n-logic" } };
    expect(responseHighlights(parseResponsePacket(aResponse([wire]))!, sentPacket)).toEqual([]);
  });

  it("drops a whole-tile target, which has no object to point at", () => {
    const tile = { directive_id: "d-t", tier: "observe", op: "highlight", basis_revision: "r22",
                   target: { kind: "tile", tile_id: "tile-df-1" } };
    expect(responseHighlights(parseResponsePacket(aResponse([tile]))!, sentPacket)).toEqual([]);
  });

  // An op outside the tier we declared. We said observe and nothing else, so anything that would
  // change the student's document is not ours to act on even if it arrives.
  it("ignores an op we never declared we could perform", () => {
    const setOption = { directive_id: "d-s", tier: "construct", op: "set_option",
                        basis_revision: "r22",
                        target: { kind: "node", tile_id: "tile-df-1", id: "n-logic" } };
    expect(responseHighlights(parseResponsePacket(aResponse([setOption]))!, sentPacket))
      .toEqual([]);
  });

  it("keeps one highlight per target when a directive repeats it", () => {
    const packet = parseResponsePacket(
      aResponse([nodeDirective("n-logic"), nodeDirective("n-logic")]))!;
    expect(responseHighlights(packet, sentPacket)).toHaveLength(1);
  });

  it("produces only highlights both sides of the wire consider valid", () => {
    const packet = parseResponsePacket(
      aResponse([nodeDirective("n-logic"), nodeDirective("n-sensor")]))!;
    const highlights = responseHighlights(packet, sentPacket);
    expect(highlights).toHaveLength(2);
    for (const h of highlights) expect(isTutorHighlight(h)).toBe(true);
  });

  it("returns nothing when the reply carries no components at all", () => {
    const bare = JSON.parse(aResponse([]));
    delete bare.components;
    expect(responseHighlights(parseResponsePacket(JSON.stringify(bare))!, sentPacket)).toEqual([]);
  });
});

describe("replyText", () => {
  const packet = parseResponsePacket(aResponse([]))!;

  // The prose part and student.message are not two encodings of one reply. Across the captured
  // streams they agree most of the time, and where they differ the prose is the fuller form,
  // carrying one_next_action — the single observable next step the whole packet is built around.
  // Preferring student.message would drop it without a trace.
  it("prefers the prose part, which is the fuller reply", () => {
    const stream = { ...emptyStream(), conversation: "Compare the two readings. What changed?" };
    expect(replyText(stream, packet)).toBe("Compare the two readings. What changed?");
  });

  // A stream whose prose part never arrived still has a reply in the packet, and a partial answer
  // beats an empty one.
  it("falls back to the packet's student message when no prose arrived", () => {
    expect(replyText(emptyStream(), packet)).toBe("Compare the two readings you recorded.");
  });

  it("returns undefined when there is nothing to say", () => {
    expect(replyText(emptyStream(), undefined)).toBeUndefined();
  });

  it("ignores prose that is only whitespace", () => {
    const stream = { ...emptyStream(), conversation: "   \n " };
    expect(replyText(stream, packet)).toBe("Compare the two readings you recorded.");
  });
});

// Fail closed on anything that is not the exact contract this parser implements.
describe("parseResponsePacket version and emptiness", () => {
  it("refuses a schema version this parser does not implement", () => {
    const v3 = JSON.parse(aResponse([]));
    v3.schema_version = "clue.response_packet.v3";
    // Accepting it would mean reading v3 components and directives as though they were v2 — the
    // fields may well still be there and mean something different.
    expect(parseResponsePacket(JSON.stringify(v3))).toBeUndefined();
  });

  it("refuses a student message that is only whitespace", () => {
    const blank = JSON.parse(aResponse([]));
    blank.student.message = "   \n ";
    // It has a length, so a length check passes it, and replyText would then return it as the
    // reply — a blank assistant turn that looks like a finished one.
    expect(parseResponsePacket(JSON.stringify(blank))).toBeUndefined();
  });
});

// The display part is whatever arrived on the wire, so its shape is not guaranteed by anything.
// Iterating a non-array throws out of processTurn, the drain records status:"error", and the
// student gets no reply even though the prose arrived complete — breaking the one contract this
// module states: losing the directives is not a reason to lose the reply.
describe("responseHighlights survives a malformed display part", () => {
  function withComponents(components: unknown) {
    const packet = JSON.parse(aResponse([]));
    packet.components = components;
    return parseResponsePacket(JSON.stringify(packet))!;
  }

  it("ignores components that are not an array", () => {
    expect(responseHighlights(withComponents({}), sentPacket)).toEqual([]);
  });

  it("ignores directives that are not an array", () => {
    const packet = withComponents([{ component_ref: {}, directives: {}, evidence_refs: [] }]);
    expect(responseHighlights(packet, sentPacket)).toEqual([]);
  });

  it("skips a directive that is not an object", () => {
    const packet = withComponents([
      { component_ref: {}, directives: [null, "x", 7, nodeDirective("n-logic")], evidence_refs: [] },
    ]);
    // the one well-formed directive still resolves
    expect(responseHighlights(packet, sentPacket)).toEqual([
      { tileId: "tile-df-1", objectId: "n-logic", label: "Compare 1" },
    ]);
  });
});

// op_highlight may carry a caption (1-60 characters) naming the block in the words the prose just
// used. See ResponseDirective.label for why only highlight can.
const captioned = (id: string, label: string) => ({ ...nodeDirective(id), label });

describe("responseHighlights captions", () => {
  it("prefers the caption ForeverLearning sent over the name we synthesized", () => {
    const packet = parseResponsePacket(aResponse([captioned("n-logic", "the comparison block")]))!;
    expect(responseHighlights(packet, sentPacket))
      .toEqual([{ tileId: "tile-df-1", objectId: "n-logic", label: "the comparison block" }]);
  });

  it("falls back to the name we sent when the directive carries no caption", () => {
    const packet = parseResponsePacket(aResponse([nodeDirective("n-logic")]))!;
    expect(responseHighlights(packet, sentPacket)[0].label).toBe("Compare 1");
  });

  it("still drops a captioned highlight whose node we never sent", () => {
    const packet = parseResponsePacket(aResponse([captioned("n-invented", "the timer block")]))!;
    expect(responseHighlights(packet, sentPacket)).toEqual([]);
  });

  it("falls back to our name when the caption is blank", () => {
    const packet = parseResponsePacket(aResponse([captioned("n-logic", "   ")]))!;
    expect(responseHighlights(packet, sentPacket)[0].label).toBe("Compare 1");
  });
});
