import * as fs from "fs";
import * as path from "path";
import { kSpikerbitFirmwareVersion } from "./spikerbit-device";

// Guards against the committed firmware artifacts drifting out of sync:
//  - the MakeCode source's VERSION vs kSpikerbitFirmwareVersion (pure source), and
//  - the compiled .hex vs that version (a stale hex — the easy mistake, since the hex
//    must be hand-exported from MakeCode whenever the source changes).
// The files are read from disk (not imported) so the .hex isn't the Jest fileMock stub.
//
// LIMITATION: this only checks that the version *string* is embedded in the hex. It does
// NOT verify the hex was actually compiled from spikerbit-clue.ts — a hex built from
// different logic but carrying the right version banner would still pass. Reviewing the
// committed hex's behavior still relies on the manual bench test. A reproducible in-repo
// build (pxt CLI / Docker) is the real fix; see the design spec's future-work section.

const firmwareDir = path.join(__dirname, "../../plugins/dataflow/firmware");
const sourcePath = path.join(firmwareDir, "spikerbit-clue.ts");
const hexPath = path.join(firmwareDir, "spikerbit-clue.hex");

// Extract N from `const VERSION = "CLUE-SPIKERBIT vN"` in the MakeCode source.
function versionFromSource(): number {
  const src = fs.readFileSync(sourcePath, "utf8");
  const match = /VERSION = "CLUE-SPIKERBIT v(\d+)"/.exec(src);
  if (!match) throw new Error("Could not find VERSION in spikerbit-clue.ts");
  return Number(match[1]);
}

// Decode the Intel HEX data records (type 00) and return the program bytes as a
// latin1 string, so embedded ASCII string literals (like the version banner) can be
// searched. MakeCode stores string literals as plain ASCII in the compiled image.
function decodeHexData(): string {
  const hex = fs.readFileSync(hexPath, "utf8");
  const bytes: number[] = [];
  for (const line of hex.split(/\r?\n/)) {
    if (!line.startsWith(":")) continue;
    const len = parseInt(line.slice(1, 3), 16);
    const recordType = line.slice(7, 9);
    if (recordType !== "00") continue;
    const data = line.slice(9, 9 + len * 2);
    for (let i = 0; i < data.length; i += 2) {
      bytes.push(parseInt(data.slice(i, i + 2), 16));
    }
  }
  return Buffer.from(bytes).toString("latin1");
}

describe("Spiker:bit firmware consistency", () => {
  it("VERSION in the MakeCode source matches kSpikerbitFirmwareVersion", () => {
    expect(versionFromSource()).toBe(kSpikerbitFirmwareVersion);
  });

  it("the committed hex embeds the current firmware version string", () => {
    // Fails if the .hex wasn't re-exported after the source/version changed.
    expect(decodeHexData()).toContain(`CLUE-SPIKERBIT v${kSpikerbitFirmwareVersion}`);
  });
});
