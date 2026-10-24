// Line handling for the "CC Device Protocol": newline-terminated text lines, each optionally
// ending in "*hh" where hh is the XOR checksum of everything before the "*".
export const kCcDeviceProtocolName = "CCDeviceProtocol";
export const kCcDeviceProtocolVersion = 1;

export type CcDeviceLine =
  | { kind: "reading"; name: string; value: number }
  | { kind: "ok"; seq?: number }
  | { kind: "err"; seq?: number; reason: string }
  | { kind: "hello"; fields: Record<string, string> }
  | { kind: "unknown" };

export interface CcDeviceHello { protocol: string; version: number; device: string; firmware: number }

const kNamePattern = /^[a-z0-9_/]+$/;
const kValuePattern = /^-?\d+(\.\d+)?$/;
const kChecksumPattern = /^[0-9A-Fa-f]{2}$/;
const kSeqPattern = /^#(\d+)$/;

// XOR of every char code, as two uppercase hex digits.
export function ccChecksum(body: string): string {
  let sum = 0;
  /* eslint-disable no-bitwise */
  for (let i = 0; i < body.length; i++) {
    sum ^= body.charCodeAt(i);
  }
  return (sum & 0xff).toString(16).toUpperCase().padStart(2, "0");
  /* eslint-enable no-bitwise */
}

export function withChecksum(body: string): string {
  return `${body}*${ccChecksum(body)}`;
}

function parseSeq(token: string | undefined): number | undefined {
  const match = token === undefined ? null : kSeqPattern.exec(token);
  return match ? Number(match[1]) : undefined;
}

// Parses one complete line, without its line ending. Returns null when a checksum is
// present and wrong (or malformed).
export function parseCcDeviceLine(line: string): CcDeviceLine | null {
  let body = line;
  const starIndex = line.lastIndexOf("*");
  if (starIndex !== -1) {
    body = line.substring(0, starIndex);
    const checksum = line.substring(starIndex + 1);
    if (!kChecksumPattern.test(checksum) || checksum.toUpperCase() !== ccChecksum(body)) {
      return null;
    }
  }

  const tokens = body.split(" ");
  const [first, ...rest] = tokens;

  if (tokens.length === 1) {
    const colon = first.indexOf(":");
    if (colon !== -1) {
      const name = first.substring(0, colon);
      const valueText = first.substring(colon + 1);
      if (kNamePattern.test(name) && kValuePattern.test(valueText)) {
        return { kind: "reading", name, value: Number(valueText) };
      }
    }
    if (first === "ok") return { kind: "ok" };
    return { kind: "unknown" };
  }

  if (first === "ok") {
    const seq = parseSeq(rest[0]);
    if (rest.length === 1 && seq !== undefined) return { kind: "ok", seq };
  } else if (first === "err") {
    const seq = parseSeq(rest[0]);
    if (seq !== undefined) {
      return { kind: "err", seq, reason: rest.slice(1).join(" ") };
    }
    return { kind: "err", reason: rest.join(" ") };
  } else if (first === "hello") {
    const fields: Record<string, string> = {};
    for (const token of rest) {
      const colon = token.indexOf(":");
      if (colon > 0) fields[token.substring(0, colon)] = token.substring(colon + 1);
    }
    return { kind: "hello", fields };
  }
  return { kind: "unknown" };
}

// Splits complete lines (ending in "\n", and without the "\r" of a "\r\n" ending) off the front
// of `buffer`. Any other "\r" stays in the line, so a line corrupted by one fails its checksum.
// A partial line, including one that ends in a lone "\r" or inside "*hh", stays in `remaining`.
export function splitLines(buffer: string): { lines: string[]; remaining: string } {
  const lines: string[] = [];
  let start = 0;
  let end = buffer.indexOf("\n", start);
  while (end !== -1) {
    lines.push(buffer.substring(start, end).replace(/\r$/, ""));
    start = end + 1;
    end = buffer.indexOf("\n", start);
  }
  return { lines, remaining: buffer.substring(start) };
}

// Returns null if any field is missing or not a number where one is expected.
export function parseHello(fields: Record<string, string>): CcDeviceHello | null {
  const { protocol, version, device, firmware } = fields;
  if (protocol === undefined || version === undefined || device === undefined || firmware === undefined) {
    return null;
  }
  const versionNumber = Number(version);
  const firmwareNumber = Number(firmware);
  if (!kValuePattern.test(version) || !kValuePattern.test(firmware)
      || !Number.isFinite(versionNumber) || !Number.isFinite(firmwareNumber)) {
    return null;
  }
  return { protocol, version: versionNumber, device, firmware: firmwareNumber };
}
