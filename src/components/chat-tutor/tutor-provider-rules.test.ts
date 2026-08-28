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
    .map(match => match[1].split(",").map(entry => entry.trim().replace(/^'|'$/g, "")));
}

describe("firestore.rules chat tutor provider enum", () => {
  // Asserting the count first is what keeps this test from passing vacuously: if the pins
  // are reworded out of the regex's reach, an empty match set would otherwise satisfy an
  // every() check and report success while guarding nothing.
  it("pins the provider in exactly the two chatTutor message blocks", () => {
    expect(parseProviderEnums()).toHaveLength(2);
  });

  it("lists exactly the shared provider vocabulary in both blocks", () => {
    for (const providers of parseProviderEnums()) {
      expect(providers).toEqual([...kTutorProviders]);
    }
  });
});
