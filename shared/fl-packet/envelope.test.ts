import { buildEnvelope, parseProtectionClasses, splitListParam } from "./envelope";

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
  // Declaring a per-tile response area we do not have, or a construct tier we cannot apply, has
  // the diagnostic reasoning about a richer interface than exists. Un-overridable is what keeps
  // the declaration honest.
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

  // Each half of the guard, separately. Tested only with both halves empty, `||` could be mutated
  // to `&&` and survive — and the mutant accepts a policy with classes but no refs, or refs but no
  // classes, which is the half-declared protection the guard exists to refuse.
  it("refuses a policy that names classes but no pattern refs", () => {
    expect(() => buildEnvelope({
      ...base, protection: { classes: ["protected_threshold_value"], patternRefs: [] },
    })).toThrow(/answer protection/i);
  });

  it("refuses a policy that names pattern refs but no classes", () => {
    expect(() => buildEnvelope({
      ...base, protection: { classes: [], patternRefs: ["protected:x"] },
    })).toThrow(/answer protection/i);
  });
});

describe("splitListParam", () => {
  it("splits, trims and drops empties", () => {
    expect(splitListParam(" a , b ,, c,")).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for an unset param", () => {
    expect(splitListParam("")).toEqual([]);
  });
});

describe("parseProtectionClasses", () => {
  it("round-trips a valid list", () => {
    expect(parseProtectionClasses("protected_threshold_value, protected_binary_stamp"))
      .toEqual(["protected_threshold_value", "protected_binary_stamp"]);
  });

  // The case that matters: one typo among valid classes used to leave the others standing, so the
  // turn went out declaring less protection than was configured, with nothing to notice it.
  it("refuses one unknown class among valid ones, naming it", () => {
    expect(() => parseProtectionClasses("protected_threshold_value,protected_canonical_topolgy"))
      .toThrow(/protected_canonical_topolgy/);
  });

  it("names every unknown class it found", () => {
    expect(() => parseProtectionClasses("nope,protected_threshold_value,alsonope"))
      .toThrow(/nope.*alsonope|alsonope.*nope/);
  });

  it("returns nothing for an unset param, leaving buildEnvelope to refuse the empty policy", () => {
    expect(parseProtectionClasses("")).toEqual([]);
  });
});
