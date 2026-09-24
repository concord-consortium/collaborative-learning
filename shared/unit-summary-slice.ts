// Filters an authored IUnitSummary (shared/unit-summary-types.ts) down to what a single AI
// consumer may see for a given current problem: everything up to and including the next problem,
// never further ahead (CLUE-678). Every consumer -- AdaChat, the AI Tile, Ideas, and Teacher
// Summary -- goes through this one module so the no-look-ahead rule lives in one place.
//
// v1 limitation: the compatibility check below compares ordinal and title only, not a content
// hash (no v1 consumer has the full assembled-Markdown hash available). That means the check
// catches a problem being moved, renamed, inserted, or removed, but not an author's edit to a
// problem's own content under an unchanged title. The authoring panel's staleness badge, which
// does compare hashes, is the only thing that flags that case, and it depends on the author
// re-running generation.
import { IUnitSummary } from "./unit-summary-types";

export interface ILiveProblem {
  ordinal: string;
  title: string;
  // Compared only when supplied. No v1 consumer supplies it: the running app only loads the
  // current problem's sections, so hashing the full prefix a summary must cover isn't possible
  // client-side without fetching every earlier problem first.
  problemHash?: string;
}

export interface IUnitSummarySlice {
  currentOrdinal: string;
  priorKnowledge: string; // entry N -- cumulative over every earlier problem; "" is valid on problem 1
  currentDigest: string;  // entry N
  nextOrdinal?: string;   // undefined on the unit's last problem
  nextDigest?: string;
}

/**
 * Returns the slice of `summary` usable for `currentOrdinal`, or `undefined` on any doubt:
 * no summary, an unrecognized ordinal, a missing entry, or a mismatch between what the summary
 * describes and the live unit structure (`liveProblems`) anywhere from the first problem through
 * N+1. Never returns a partial slice.
 */
export function unitSummarySlice(
  summary: IUnitSummary | undefined,
  liveProblems: ILiveProblem[],
  currentOrdinal: string
): IUnitSummarySlice | undefined {
  if (!summary) return undefined;
  if (summary.entries.length !== summary.sourceManifest.length) return undefined;

  const currentIndex = liveProblems.findIndex(p => p.ordinal === currentOrdinal);
  if (currentIndex === -1) return undefined;

  // The prefix that must check out: problem 0 through N+1 (or through the unit's last problem,
  // whichever comes first). priorKnowledge(N) is cumulative over every earlier problem, so a
  // mismatch anywhere in that prefix -- not just at N or N+1 -- makes the slice untrustworthy.
  const lastCheckedIndex = Math.min(currentIndex + 1, liveProblems.length - 1);
  for (let i = 0; i <= lastCheckedIndex; i++) {
    const liveProblem = liveProblems[i];
    const manifestEntry = summary.sourceManifest[i];
    const entry = summary.entries[i];
    if (!manifestEntry || !entry) return undefined;
    if (manifestEntry.ordinal !== liveProblem.ordinal) return undefined;
    if (manifestEntry.title !== liveProblem.title) return undefined;
    if (entry.ordinal !== manifestEntry.ordinal) return undefined;
    if (liveProblem.problemHash !== undefined && manifestEntry.problemHash !== liveProblem.problemHash) {
      return undefined;
    }
  }

  // currentIndex is always within 0..lastCheckedIndex, so this entry was just verified above.
  const currentEntry = summary.entries[currentIndex];
  const hasNext = currentIndex + 1 <= lastCheckedIndex;

  return {
    currentOrdinal,
    priorKnowledge: currentEntry.priorKnowledge,
    currentDigest: currentEntry.problemDigest,
    nextOrdinal: hasNext ? liveProblems[currentIndex + 1].ordinal : undefined,
    nextDigest: hasNext ? summary.entries[currentIndex + 1].problemDigest : undefined,
  };
}

/**
 * The prompt text every AI consumer sends for a slice. One place, one wording. Does not
 * include UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION -- each consumer installs that separately, so it is
 * present even on turns where no slice applies.
 */
export function formatUnitSummarySlice(slice: IUnitSummarySlice): string {
  const lines: string[] = [];
  if (slice.priorKnowledge) {
    lines.push(`What the student should already know entering this problem: ${slice.priorKnowledge}`);
  }
  lines.push(`This problem (${slice.currentOrdinal}): ${slice.currentDigest}`);
  if (slice.nextOrdinal !== undefined && slice.nextDigest !== undefined) {
    lines.push(`The next problem (${slice.nextOrdinal}): ${slice.nextDigest}`);
  }
  return lines.join("\n\n");
}
