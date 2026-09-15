// The control plane of a clue.context_packet.v2. Every other section of the packet is optional;
// this one is not, and it is where the claims we make about ourselves live.
//
// Field names are snake_case because they go on the wire as-is.

export const kProtectionClasses = [
  "protected_threshold_value", "protected_canonical_topology", "protected_binary_stamp",
] as const;
export type ProtectionClass = typeof kProtectionClasses[number];

export type Audience = "student" | "teacher" | "app";
export type DirectiveTier = "observe" | "focus_annotate" | "construct";
export type ComponentType = "Dataflow" | "Simulator" | "Table" | "Text" | "Other";

// Opaque refs only. The values they protect are resolved on ForeverLearning's side and never
// travel in the packet, which is what lets the binding live in a public repo while the secrets
// do not.
export interface ProtectionPolicy {
  classes: ProtectionClass[];
  patternRefs: string[];
  valueRefs?: string[];
}

export interface Envelope {
  trace: { trace_id: string; request_id: string; turn: number };
  privacy: { contains_pii: false; deidentified: true; raw_payload_retention: "none" };
  surface_policy: { audiences: Audience[] };
  client_capabilities: {
    directive_tiers: DirectiveTier[];
    display_text_component_types: ComponentType[];
  };
  answer_protection: {
    classes: ProtectionClass[];
    protected_pattern_refs: string[];
    protected_value_refs?: string[];
  };
  catalog_version: { commit: string; projection: "clue-catalog-proj-v1" };
}

export interface BuildEnvelopeOptions {
  traceId: string;
  requestId: string;
  turn: number;
  protection: ProtectionPolicy;
  catalogCommit: string;
  audiences?: Audience[];
}

// What CLUE can actually act on. These are deliberately not parameters: a capability declaration
// is a fact about the client, and over-declaring one has the diagnostic proposing actions we can
// only discard — a per-tile response area that does not exist, or a construct tier with nothing
// behind it.
//
// `observe` covers highlight and focus, both of which we can do. `focus_annotate` admits `annotate`
// as well as `set_plot`, and our annotations are two-ended arrows that are also unit-configurable,
// so declaring the tier would invite directives we cannot render. `construct` has no mechanism at
// all. Widen these only alongside the code that honors them.
const kDirectiveTiers: DirectiveTier[] = ["observe"];
// Empty because the tutor is a document sidebar: no tile has a response area to render into.
const kDisplayTextComponentTypes: ComponentType[] = [];

const kCatalogCommit = /^[0-9a-f]{40}$/;

export function buildEnvelope(opts: BuildEnvelopeOptions): Envelope {
  if (!kCatalogCommit.test(opts.catalogCommit)) {
    throw new Error(
      `catalog commit must be a 40-character hex sha, got "${opts.catalogCommit}"`);
  }
  // The schema requires at least one of each, and its own note says a missing, empty or
  // unresolvable policy invalidates the run before the provider is invoked. A packet that cannot
  // be answered is not worth the round trip.
  if (!opts.protection.classes.length || !opts.protection.patternRefs.length) {
    throw new Error("answer protection needs at least one class and one pattern ref");
  }
  return {
    trace: { trace_id: opts.traceId, request_id: opts.requestId, turn: opts.turn },
    privacy: { contains_pii: false, deidentified: true, raw_payload_retention: "none" },
    surface_policy: { audiences: opts.audiences ?? ["student"] },
    client_capabilities: {
      directive_tiers: kDirectiveTiers,
      display_text_component_types: kDisplayTextComponentTypes,
    },
    answer_protection: {
      classes: opts.protection.classes,
      protected_pattern_refs: opts.protection.patternRefs,
      ...(opts.protection.valueRefs?.length
        ? { protected_value_refs: opts.protection.valueRefs } : {}),
    },
    catalog_version: { commit: opts.catalogCommit, projection: "clue-catalog-proj-v1" },
  };
}

/**
 * Splits a comma-separated Cloud Functions param. Empty entries are dropped rather than passed
 * along as "", which buildEnvelope would take for a real ref.
 */
export function splitListParam(value: string): string[] {
  return value.split(",").map(entry => entry.trim()).filter(Boolean);
}

/**
 * Parses a comma-separated protection-class param, refusing any name that is not a real class.
 *
 * Refusing rather than dropping, because dropping fails open on the case that actually happens:
 * one typo among several valid classes leaves the others standing, buildEnvelope sees a non-empty
 * policy, and the turn goes out quietly declaring less protection than the configuration asked
 * for. Only a wholly mistyped param would have failed loudly — the case least likely to occur.
 */
export function parseProtectionClasses(value: string): ProtectionClass[] {
  const known = new Set<string>(kProtectionClasses);
  const entries = splitListParam(value);
  const unknown = entries.filter(entry => !known.has(entry));
  if (unknown.length > 0) {
    throw new Error(
      `unknown answer-protection ${unknown.length > 1 ? "classes" : "class"}: ${unknown.join(", ")}`);
  }
  return entries as ProtectionClass[];
}
