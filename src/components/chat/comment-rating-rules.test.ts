import * as fs from "fs";
import * as path from "path";
import { kRatingValues } from "../../../shared/shared";

// firestore.rules can't import kRatingValues, so the rating enum is spelled out twice there —
// once in the document comment block, once in the curriculum one. Adding a value to the shared
// list and missing either block is a silent break: every write of the new value fails with
// permission-denied while the whole Jest suite stays green.
//
// The file is read from disk rather than imported because it isn't JavaScript. That makes this a
// textual check: it verifies the two enums agree with the shared list, not that the surrounding
// rule logic is correct — the emulator suite in firebase-test/ covers that.
const rulesPath = path.join(__dirname, "../../../firestore.rules");

// Matches the enum pin in both blocks: `newRatings[userId] in ['yes', 'no', 'notSure']`.
const ratingEnumRegex = /newRatings\[userId\] in \[([^\]]*)\]/g;

function parseRatingEnums(): string[][] {
  const rules = fs.readFileSync(rulesPath, "utf8");
  return [...rules.matchAll(ratingEnumRegex)]
    .map(match => match[1].split(",").map(entry => entry.trim().replace(/^['"]|['"]$/g, "")));
}

describe("firestore.rules comment rating enum", () => {
  // One assertion over the whole match set, not a loop over it. A loop passes vacuously if the
  // pins are ever reworded out of the regex's reach, and pairing it with a separate count
  // assertion guards that only by convention. Comparing the match set against both expected
  // lists at once fails on a missing pin, an extra pin, content drift, and an empty match set
  // alike.
  it("pins exactly the shared vocabulary in both comment blocks", () => {
    expect(parseRatingEnums()).toEqual([[...kRatingValues], [...kRatingValues]]);
  });
});
