// Replays real concordclue streams through the reader and the parser.
//
// The captures are ForeverLearning's output and are not vendored here, so this is opt-in: point
// FL_CAPTURE_DIR at a directory of .sse files and it runs; leave it unset and it skips.
//
//   FL_CAPTURE_DIR=~/Documents/ForeverLearning/artifacts npx jest shared/fl-packet
//
// Everything else in this directory is tested against fixtures we wrote, which means it is tested
// against our own understanding of the format. This is the only check that can catch a place where
// that understanding is wrong. A skip here is not a pass.
import * as fs from "fs";
import * as path from "path";

import { parseResponsePacket } from "./response";
import { collectSseText } from "./sse";

const captureDir = process.env.FL_CAPTURE_DIR;
const captures = captureDir && fs.existsSync(captureDir)
  ? fs.readdirSync(captureDir).filter(f => f.endsWith(".sse")).sort()
  : [];

// it.skip rather than describe.skip: a skipped describe never registers its tests, so the run
// would report "all passed" with no sign the replay did not happen.
const itIfCaptures = captures.length ? it : it.skip;

describe("captured concordclue streams", () => {
  const read = (file: string) => fs.readFileSync(path.join(captureDir!, file), "utf8");

  itIfCaptures("reads every captured stream to completion", () => {
    for (const file of captures) {
      const stream = collectSseText(read(file));
      expect({ file, complete: stream.complete }).toEqual({ file, complete: true });
      expect({ file, stopReason: stream.stopReason })
        .toEqual({ file, stopReason: expect.any(String) });
    }
  });

  itIfCaptures("reassembles a parseable response packet from every display part", () => {
    for (const file of captures) {
      const stream = collectSseText(read(file));
      // Not every capture carries a display part — an init handshake has only metadata.
      if (!stream.displayComplete) continue;
      const packet = parseResponsePacket(stream.display);
      expect({ file, parsed: !!packet }).toEqual({ file, parsed: true });
      expect({ file, schema: packet!.schema_version })
        .toEqual({ file, schema: "clue.response_packet.v2" });
    }
  });

  // Written first as "the prose part equals student.message", which is what nine of the eleven
  // captures do — and what the other two disprove. There the prose folds in one_next_action and a
  // closing question, and in one it rewrites the tail of student.message rather than appending.
  //
  // So the invariant is the weaker, true one: the prose is never shorter than the packet's
  // message, because it is the fuller form of the same reply. This is the test that stopped the
  // provider from writing student.message as the answer and silently dropping the next action.
  itIfCaptures("confirms the prose part is never less than the packet's student message", () => {
    for (const file of captures) {
      const stream = collectSseText(read(file));
      if (!stream.displayComplete || !stream.conversation) continue;
      const packet = parseResponsePacket(stream.display);
      const message = packet!.student.message;
      expect({ file, atLeast: stream.conversation.length >= message.length })
        .toEqual({ file, atLeast: true });
      expect({ file, empty: stream.conversation.length === 0 })
        .toEqual({ file, empty: false });
    }
  });
});
