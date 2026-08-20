import fs from "node:fs";
import path from "node:path";
import { tileTypes } from "../../../shared/tile-types.js";
import { getTileCapability, missingCapabilityTypes, tileCapabilities } from "../src/capability.js";
import { repoRoot } from "./helpers.js";

/**
 * The sync tripwire. `src/register-tile-types.ts` cannot be imported here — it drags in client-side
 * loading utilities and does not export its registry — so the registration keys are extracted from
 * the file as text. Registering a new tile type fails this test until shared/tile-types.ts and the
 * capability registry are both updated.
 */
function registrationObjectBody(): string {
  const source = fs.readFileSync(path.join(repoRoot, "src", "register-tile-types.ts"), "utf8");
  const start = source.indexOf("const gTileRegistration");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n};", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Keys registered through the `loggedLoad` helper, which is how every entry is written today. */
function loggedLoadKeys(body: string): string[] {
  return [...body.matchAll(/^ {2}"([A-Za-z0-9]+)":\s*loggedLoad\(/gm)].map((match) => match[1]);
}

/**
 * Every quoted property key in the object, whatever it is assigned. Deliberately permissive about
 * indentation and about the right-hand side: a registration written with a different loader helper,
 * or reindented by a reformat, is invisible to `loggedLoadKeys` — and would also be missing from
 * shared/tile-types.ts, so the two sets would still agree and the tripwire would pass without ever
 * having looked at the new entry. Comparing the two extractions is what makes that impossible.
 */
function quotedKeys(body: string): string[] {
  return [...body.matchAll(/^\s*"([A-Za-z0-9]+)"\s*:/gm)].map((match) => match[1]);
}

/** Registered by top-level imports in register-tile-types.ts rather than through gTileRegistration. */
const kStaticallyRegistered = ["Placeholder", "Unknown"];

describe("shared/tile-types.ts", () => {
  it("matches the tile types src/register-tile-types.ts registers", () => {
    const extracted = loggedLoadKeys(registrationObjectBody());
    expect(extracted.length).toBeGreaterThan(15);
    expect([...extracted, ...kStaticallyRegistered].sort()).toEqual([...tileTypes].sort());
  });

  it("sees every entry in the registration object, however it is written", () => {
    // Guards the extractor itself: if these disagree, the loggedLoad pattern has stopped seeing a
    // registration and the check above would have compared a short list against a short list.
    const body = registrationObjectBody();
    expect(quotedKeys(body).sort()).toEqual(loggedLoadKeys(body).sort());
  });

  it("lists the two statically registered types", () => {
    for (const type of kStaticallyRegistered) expect(tileTypes).toContain(type);
  });

  it("has no duplicates", () => {
    expect(new Set(tileTypes).size).toBe(tileTypes.length);
  });
});

describe("capability registry coverage", () => {
  it("has a record for every registered tile type", () => {
    expect(missingCapabilityTypes()).toEqual([]);
  });

  it.each(tileTypes)("%s has a complete capability record", (tileType) => {
    const capability = tileCapabilities[tileType];
    expect(typeof capability.containsStudentText).toBe("boolean");
    expect(["full", "partial", "stub", "fallback"]).toContain(capability.summaryFidelity);
    expect(typeof capability.requiresVisualRepresentation).toBe("boolean");
  });

  it("treats an unregistered type conservatively, as needing an image", () => {
    const capability = getTileCapability("SomeFutureTile");
    expect(capability).toEqual({
      containsStudentText: false, summaryFidelity: "fallback", requiresVisualRepresentation: true
    });
  });
});
