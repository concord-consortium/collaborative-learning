import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";

// Consumes complete "key:value\r\n" lines from `buffer`, updating the matching
// channel's value, and returns the unconsumed remainder. Unparseable complete
// lines are discarded to recover from corrupted serial data. Extracted from
// SerialDevice.handleArduinoStreamObj so the Spiker:bit WebUSB path can reuse it.
export function parseArduinoSerialData(buffer: string, channels: NodeChannelInfo[]): string {
  const pattern = /([a-z0-9]+):([0-9.]+)[\r][\n]/;
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
