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
function registeredTileTypes(): string[] {
  const source = fs.readFileSync(path.join(repoRoot, "src", "register-tile-types.ts"), "utf8");
  const body = source.slice(source.indexOf("const gTileRegistration"));
  return [...body.matchAll(/^ {2}"([A-Za-z0-9]+)":\s*loggedLoad\(/gm)].map((match) => match[1]);
}

/** Registered by top-level imports in register-tile-types.ts rather than through gTileRegistration. */
const kStaticallyRegistered = ["Placeholder", "Unknown"];

describe("shared/tile-types.ts", () => {
  it("matches the tile types src/register-tile-types.ts registers", () => {
    const extracted = registeredTileTypes();
    expect(extracted.length).toBeGreaterThan(15);
    expect([...extracted, ...kStaticallyRegistered].sort()).toEqual([...tileTypes].sort());
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
