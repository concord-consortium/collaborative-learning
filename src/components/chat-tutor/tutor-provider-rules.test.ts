import * as fs from "fs";
import * as path from "path";
import { kTutorProviders } from "../../../shared/chat-tutor-providers";

// firestore.rules can't import kTutorProviders, so the provider enum is spelled out twice
// there — once in the authed chatMessageCreate block, once in the demo one. Adding a
// provider to the shared list and missing either block is a silent break: every message
// write under the new provider fails with permission-denied while the whole Jest suite
// stays green, and demo/qa is where a new provider is exercised first.
//
// The file is read from disk rather than imported because it isn't JavaScript. That makes
// this a textual check: it verifies the two enums agree with the shared list, not that the
// surrounding rule logic is correct — the emulator suite in firebase-test/ covers that.
const rulesPath = path.join(__dirname, "../../../firestore.rules");

// Matches the enum pin in both blocks: `data.provider in ['openai', 'foreverlearning']`.
const providerEnumRegex = /data\.provider in \[([^\]]*)\]/g;

function parseProviderEnums(): string[][] {
  const rules = fs.readFileSync(rulesPath, "utf8");
  return [...rules.matchAll(providerEnumRegex)]
    .map(match => match[1].split(",").map(entry => entry.trim().replace(/^['"]|['"]$/g, "")));
}

describe("firestore.rules chat tutor provider enum", () => {
  // One assertion over the whole match set, not a loop over it. A loop passes vacuously if the
  // pins are ever reworded out of the regex's reach, and pairing it with a separate count
  // assertion guards that only by convention — skip or rename the count and the loop silently
  // becomes decoration. Comparing the match set against both expected lists at once fails on a
  // missing pin, an extra pin, content drift, and an empty match set alike.
  it("pins exactly the shared vocabulary in both chatTutor message blocks", () => {
    expect(parseProviderEnums()).toEqual([[...kTutorProviders], [...kTutorProviders]]);
  });
});
