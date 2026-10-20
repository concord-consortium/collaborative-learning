import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";

// Parser for the "keyValue" protocol: consumes complete "key:value\r\n" lines from
// `buffer`, updating every channel with the matching id, and returns the unconsumed
// remainder. Unparseable complete lines are discarded to recover from corrupted serial data.
// Shared by the Web Serial and WebUSB paths. The `[ \t]*` before the line ending tolerates
// trailing whitespace: a board running older firmware pads each line with spaces (e.g.
// "emg:57            \r\n") — which detectSpikerbitVersion must also parse — while the
// current v3 Spiker:bit firmware disables padding (setWriteLinePadding(0)) and the Arduino
// never padded; all parse correctly.
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
