import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import {
  CcDeviceHello, kCcDeviceProtocolName, kCcDeviceProtocolVersion, parseCcDeviceLine, parseHello
} from "./cc-device-protocol";

// Parser for the "keyValue" protocol: consumes complete "key:value\r\n" lines from
// `buffer`, updating every channel with the matching id, and returns the unconsumed
// remainder. Unparseable complete lines are discarded to recover from corrupted serial data.
// Used for the Arduino over Web Serial. The `[ \t]*` before the line ending tolerates
// trailing whitespace: Spiker:bit firmware v1 and v2 pad each line with spaces (e.g.
// "emg:57            \r\n") — which detectSpikerbitVersion must also parse — while v3
// disables padding (setWriteLinePadding(0)) and the Arduino never padded; all parse correctly.
export function parseKeyValueData(buffer: string, channels: NodeChannelInfo[]): string {
  const pattern = /([a-z0-9]+):([0-9.]+)[ \t]*[\r][\n]/;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = pattern.exec(buffer);
    if (match) {
      const [fullMatch, channel, numStr] = match;
      buffer = buffer.substring(match.index + fullMatch.length);
      channels.filter((c: NodeChannelInfo) => c.channelId === channel).forEach(targetChannel => {
        targetChannel.value = Math.round(Number(numStr));
        // Stamp arrival time so the rete-manager freshness check can flip a channel to
        // `missing` when its device stops sending it (e.g. a Spiker:bit never emits fsr/a1).
        targetChannel.lastMessageReceivedAt = Date.now();
      });
    } else {
      const lineEndIndex = buffer.indexOf("\r\n");
      if (lineEndIndex !== -1) {
        buffer = buffer.substring(lineEndIndex + 2);
      } else {
        break;
      }
    }
  }
  return buffer;
}

// Detects our fixed program's version banner/reply ("CLUE-SPIKERBIT v<N>\r\n").
// Returns the version and the buffer with the match (and any preceding bytes)
// removed, so streamed emg: data after the reply is preserved for parsing.
export function detectSpikerbitVersion(buffer: string): { version: number | null; remaining: string } {
  // `[ \t]*` tolerates the micro:bit's trailing line padding before \r\n.
  const match = /CLUE-SPIKERBIT v(\d+)[ \t]*\r\n/.exec(buffer);
  if (!match) {
    return { version: null, remaining: buffer };
  }
  return { version: Number(match[1]), remaining: buffer.substring(match.index + match[0].length) };
}

export type FirmwareReply =
  | { kind: "legacy"; firmware: number }
  | { kind: "ccDevice"; hello: CcDeviceHello };

// Scans `buffer` for a complete CC Device Protocol hello line or a legacy version banner, skipping
// stale readings and lines with a bad checksum. Returns the reply and the buffer after its line,
// or a null reply and the unchanged buffer when neither is complete yet.
export function detectFirmwareReply(buffer: string): { reply: FirmwareReply | null; remaining: string } {
  let start = 0;
  let end = buffer.indexOf("\n", start);
  while (end !== -1) {
    const line = buffer.substring(start, end).replace(/\r$/, "");
    const parsed = parseCcDeviceLine(line);
    if (parsed?.kind === "hello") {
      const hello = parseHello(parsed.fields);
      if (hello) return { reply: { kind: "ccDevice", hello }, remaining: buffer.substring(end + 1) };
    }
    const legacy = detectSpikerbitVersion(`${line}\r\n`);
    if (legacy.version != null) {
      return { reply: { kind: "legacy", firmware: legacy.version }, remaining: buffer.substring(end + 1) };
    }
    start = end + 1;
    end = buffer.indexOf("\n", start);
  }
  return { reply: null, remaining: buffer };
}

// Whether a board should be flashed with the expected firmware: no recognized reply, a legacy
// banner, a protocol or protocol version other than kCcDeviceProtocolName and
// kCcDeviceProtocolVersion, another device (firmware numbers are per device), or older firmware.
export function shouldFlash(reply: FirmwareReply | null, expectedDevice: string, expectedFirmware: number): boolean {
  if (reply?.kind !== "ccDevice") return true;
  const { protocol, version, device, firmware } = reply.hello;
  if (protocol !== kCcDeviceProtocolName || version !== kCcDeviceProtocolVersion) return true;
  if (device !== expectedDevice) return true;
  return firmware < expectedFirmware;
}
