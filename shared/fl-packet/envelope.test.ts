import { buildEnvelope } from "./envelope";

const base = {
  traceId: "clue-trace-1",
  requestId: "clue-trace-1-t2",
  turn: 2,
  protection: {
    classes: ["protected_threshold_value" as const],
    patternRefs: ["protected:brain-1-5-a"],
  },
  catalogCommit: "95b684b01a0616f826a43fcc55cb6d4c40cbd391",
};

describe("buildEnvelope", () => {
  // The capabilities are a fact about CLUE, not a caller's choice, so they are not parameters.
  // Every packet we sent before this declared a per-tile response area we do not have and a
  // construct tier we cannot apply, which had the diagnostic reasoning about a richer interface
  // than exists. Making them un-overridable is what stops that recurring.
  it("declares only the directive tiers CLUE can act on", () => {
    expect(buildEnvelope(base).client_capabilities.directive_tiers).toEqual(["observe"]);
  });

  it("declares no display_text component types, because CLUE has no per-tile response area", () => {
    expect(buildEnvelope(base).client_capabilities.display_text_component_types).toEqual([]);
  });

  // The schema pins all three to const values; sending anything else is a 400 we can catch here.
  it("asserts the privacy constants the schema requires", () => {
    expect(buildEnvelope(base).privacy).toEqual({
      contains_pii: false, deidentified: true, raw_payload_retention: "none",
    });
  });

  it("carries the trace fields through", () => {
    const env = buildEnvelope(base);
    expect(env.trace).toEqual({
      trace_id: "clue-trace-1", request_id: "clue-trace-1-t2", turn: 2,
    });
  });

  it("defaults the audience to student alone", () => {
    expect(buildEnvelope(base).surface_policy.audiences).toEqual(["student"]);
  });

  // catalog_version.commit is pinned to ^[0-9a-f]{40}$. An invalid one is a 400 from their
  // runtime; failing here names the problem where it was introduced.
  it("rejects a catalog commit that is not a 40-character hex sha", () => {
    expect(() => buildEnvelope({ ...base, catalogCommit: "not-a-sha" })).toThrow(/40-character hex/);
    expect(() => buildEnvelope({ ...base, catalogCommit: "ABCDEF" + "0".repeat(34) }))
      .toThrow(/40-character hex/);
  });

  // protected_pattern_refs is minItems 1, and the schema says an unresolvable or empty policy
  // invalidates the run before the provider is invoked — so an empty one is never worth sending.
  it("rejects an empty protection policy", () => {
    expect(() => buildEnvelope({ ...base, protection: { classes: [], patternRefs: [] } }))
      .toThrow(/protection/i);
  });
});
