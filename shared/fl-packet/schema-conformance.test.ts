// Validates what we build against ForeverLearning's own JSON Schema.
//
// The schema files are not vendored here — so the check is opt-in: point FL_SCHEMA_DIR at a
// directory holding clue_context_packet_v2.schema.json and it runs; leave it unset and it skips.
//
//   FL_SCHEMA_DIR=~/Documents/ForeverLearning/current npx jest shared/fl-packet
//
// A skip here is not a pass. If these schemas ever become ours to vendor, fold this into the
// ordinary suite and delete the gate.
import * as fs from "fs";
import * as path from "path";
import Ajv2020 from "ajv/dist/2020";

import { buildEnvelope } from "./envelope";

const schemaDir = process.env.FL_SCHEMA_DIR;
const contextSchemaPath = schemaDir
  ? path.join(schemaDir, "clue_context_packet_v2.schema.json") : undefined;
const haveSchema = !!contextSchemaPath && fs.existsSync(contextSchemaPath);

// it.skip rather than describe.skip: a skipped describe never registers its tests, so the run
// would report "all passed" with no sign the conformance check did not happen. These stay visible
// as skips in the summary.
const itIfSchema = haveSchema ? it : it.skip;

describe("clue.context_packet.v2 conformance", () => {
  // Compiled lazily — the describe body runs even when the schema is absent.
  let validate: ReturnType<Ajv2020["compile"]> | undefined;
  const validator = () => {
    if (!validate) {
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      validate = ajv.compile(JSON.parse(fs.readFileSync(contextSchemaPath!, "utf8")));
    }
    return validate;
  };

  const envelope = buildEnvelope({
    traceId: "clue-trace-1",
    requestId: "clue-trace-1-t2",
    turn: 2,
    protection: {
      classes: ["protected_threshold_value", "protected_canonical_topology"],
      patternRefs: ["protected:brain-1-5-a"],
      valueRefs: ["protected:brain-1-5-threshold"],
    },
    catalogCommit: "95b684b01a0616f826a43fcc55cb6d4c40cbd391",
  });

  itIfSchema("accepts a packet carrying only schema_version and our envelope", () => {
    const validateFn = validator();
    const ok = validateFn({ schema_version: "clue.context_packet.v2", envelope });
    expect(validateFn.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  // The envelope is the only non-omittable section, so this pins the claim that we can integrate
  // incrementally: everything below it can arrive later without invalidating a packet.
  itIfSchema("still accepts it with every optional section absent", () => {
    expect(validator()({ schema_version: "clue.context_packet.v2", envelope })).toBe(true);
  });

  itIfSchema("rejects a packet whose envelope we did not build", () => {
    expect(validator()({ schema_version: "clue.context_packet.v2", envelope: {} })).toBe(false);
  });
});
