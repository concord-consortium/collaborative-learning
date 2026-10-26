import * as fs from "fs";
import * as path from "path";
import { decompress } from "lzma";
import {
  kCcDeviceProtocolName, kCcDeviceProtocolVersion, parseCcDeviceLine, parseHello, withChecksum
} from "./cc-device-protocol";
import { kSpikerbitFirmwareVersion } from "./spikerbit-device";

// Guards against the committed firmware artifacts drifting out of sync:
//  - the MakeCode source's HELLO line vs the protocol's name and version and
//    kSpikerbitFirmwareVersion,
//  - the compiled .hex vs that HELLO line, and
//  - the source MakeCode embedded in the .hex vs spikerbit-clue.ts, which fails when the
//    source changed but the hex wasn't rebuilt with `npm run build:firmware`.
// The files are read from disk (not imported) so the .hex isn't the Jest fileMock stub.
//
// These tests can't tell whether the compiled program in the hex matches its embedded
// source. The `CI Firmware` workflow covers that by rebuilding the hex and comparing.

const firmwareDir = path.join(__dirname, "../../plugins/dataflow/firmware");
const sourcePath = path.join(firmwareDir, "spikerbit-clue.ts");
const hexPath = path.join(firmwareDir, "spikerbit-clue.hex");

// MakeCode appends the project's files to the hex so the editor can reopen it: this magic,
// a uint16 metadata length, a uint32 payload length and padding (16 bytes in all), then JSON
// metadata, then the LZMA-compressed project.
const kSourceEmbedMagic = new Uint8Array([0x41, 0x14, 0x0E, 0x2F, 0xB8, 0x2F, 0xA2, 0xBB]);

// The `hello` line, from `const HELLO = "..."` in the MakeCode source.
function helloFromSource(): string {
  const match = /const HELLO = "([^"]+)"/.exec(fs.readFileSync(sourcePath, "utf8"));
  if (!match) throw new Error("Could not find HELLO in spikerbit-clue.ts");
  return match[1];
}


// Concatenate the data bytes of the Intel HEX records of the given types, in file order.
// Type 00 is ordinary data. A universal hex also uses 0D for the second board's data and
// 0E for data outside the program, which is where MakeCode puts the embedded source.
function hexRecordBytes(hex: string, recordTypes: string[]): Buffer {
  const bytes: number[] = [];
  for (const line of hex.split(/\r?\n/)) {
    if (!line.startsWith(":")) continue;
    const len = parseInt(line.slice(1, 3), 16);
    if (!recordTypes.includes(line.slice(7, 9))) continue;
    const data = line.slice(9, 9 + len * 2);
    for (let i = 0; i < data.length; i += 2) {
      bytes.push(parseInt(data.slice(i, i + 2), 16));
    }
  }
  return Buffer.from(bytes);
}

// The program bytes as a latin1 string, so embedded ASCII string literals (like the HELLO
// line) can be searched. MakeCode stores string literals as plain ASCII in the image.
function decodeHexData(): string {
  return hexRecordBytes(fs.readFileSync(hexPath, "utf8"), ["00"]).toString("latin1");
}

// The project files MakeCode embedded in the hex, as a map of file name to contents. The
// decompressed payload is a project header of `headerSize` characters followed by that map
// as JSON.
function embeddedProjectFiles(hex: string): Record<string, string> {
  const bin = hexRecordBytes(hex, ["00", "0D", "0E"]);
  const start = bin.indexOf(kSourceEmbedMagic);
  if (start < 0) throw new Error("The hex has no embedded MakeCode source");
  const metaLength = bin.readUInt16LE(start + 8);
  const payloadLength = bin.readUInt32LE(start + 10);
  const metaStart = start + 16;
  const meta = JSON.parse(bin.subarray(metaStart, metaStart + metaLength).toString("utf8"));
  const payloadStart = metaStart + metaLength;
  const project = decompress(bin.subarray(payloadStart, payloadStart + payloadLength));
  const text = typeof project === "string" ? project : Buffer.from(project).toString("utf8");
  return JSON.parse(text.slice(meta.headerSize));
}

describe("Spiker:bit firmware consistency", () => {
  it("the source's HELLO names this protocol, its version, the Spiker:bit and kSpikerbitFirmwareVersion", () => {
    const line = parseCcDeviceLine(withChecksum(helloFromSource()));
    expect(line?.kind).toBe("hello");
    const hello = line?.kind === "hello" ? parseHello(line.fields) : null;
    expect(hello).toEqual({
      protocol: kCcDeviceProtocolName,
      version: kCcDeviceProtocolVersion,
      device: "spikerbit",
      firmware: kSpikerbitFirmwareVersion
    });
  });

  it("the committed hex embeds the current HELLO line", () => {
    // Fails if the .hex wasn't rebuilt after the source/version changed.
    expect(decodeHexData()).toContain(helloFromSource());
  });

  it("the firmware source contains no v1–v3 banner text", () => {
    expect(fs.readFileSync(sourcePath, "utf8")).not.toContain("CLUE-SPIKERBIT v");
  });

  it("the committed hex embeds spikerbit-clue.ts as its main.ts", () => {
    const files = embeddedProjectFiles(fs.readFileSync(hexPath, "utf8"));
    expect(files["main.ts"]).toBe(fs.readFileSync(sourcePath, "utf8"));
  });

  it("fails clearly on a hex with no embedded MakeCode source", () => {
    expect(() => embeddedProjectFiles(":00000001FF\n")).toThrow("The hex has no embedded MakeCode source");
  });
});
