import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";

// Consumes complete "key:value\r\n" lines from `buffer`, updating the matching
// channel's value, and returns the unconsumed remainder. Unparseable complete
// lines are discarded to recover from corrupted serial data. Extracted from
// SerialDevice.handleArduinoStreamObj so the Spiker:bit WebUSB path can reuse it.
// The `[ \t]*` before the line ending tolerates trailing whitespace: the micro:bit
// firmware pads each line with spaces (e.g. "emg:57            \r\n"), while the
// Arduino sends no padding — both parse correctly.
export function parseArduinoSerialData(buffer: string, channels: NodeChannelInfo[]): string {
  const pattern = /([a-z0-9]+):([0-9.]+)[ \t]*[\r][\n]/;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = pattern.exec(buffer);
    if (match) {
      const [fullMatch, channel, numStr] = match;
      buffer = buffer.substring(match.index + fullMatch.length);
      const targetChannel = channels.find((c: NodeChannelInfo) => c.channelId === channel);
      if (targetChannel) {
        targetChannel.value = Math.round(Number(numStr));
      }
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
