// CLUE-685-adachat-spike (CLUE-685 checklist, Phase 3): a slice of the unit's authored
// aiUnitSummary, installed alongside LEFT so the tutor has cumulative unit context for the
// current problem without sending the whole unit's content. Not CLUE-678 -- see that story's
// plan for the production version of this (conversation-forking on a changed summary, a
// manifest-vs-live-structure check, the firestore.rules field, etc.), which this spike
// deliberately hard-codes around.
import { getParent } from "mobx-state-tree";
import { InvestigationModelType } from "../../models/curriculum/investigation";
import { ProblemModelType } from "../../models/curriculum/problem";
import { UnitModelType } from "../../models/curriculum/unit";

// The same ordinal string Unit.getAllProblemOrdinals() produces --
// "${investigation.ordinal}.${problem.ordinal}". getParent is called twice because a problem's
// direct MST parent is the investigation's `problems` array, not the investigation itself --
// same walk getSectionPath uses (unit.ts).
export function currentProblemOrdinal(problem: ProblemModelType): string {
  const investigation = getParent(getParent(problem)) as InvestigationModelType;
  return `${investigation.ordinal}.${problem.ordinal}`;
}

// priorKnowledge(N) is already cumulative -- everything before problem N -- so problemDigest only
// adds N and N+1 here, not the whole 0..N+1 range: sending every digest as well would duplicate
// what priorKnowledge already carries (see docs/plans/CLUE-685-plan.md's "consumer slice"
// discussion, §2.1). Ordinal matching is exact-string only, never numeric or positional:
// getAllProblemOrdinals() is authored order, not sorted order ("1.10" sorts before "1.2"
// lexicographically), and the plan explicitly forbids comparing ordinal components as numbers.
//
// Returns undefined (send nothing) rather than a broken or empty slice: no aiUnitSummary authored,
// the current problem's ordinal isn't found in the live structure at all (a spike stand-in for the
// real manifest-vs-live check CLUE-678 needs), or the summary has no entry for it.
export function buildUnitContext(unit: UnitModelType, problem: ProblemModelType): string | undefined {
  const summary = unit.config?.aiUnitSummary;
  if (!summary) return undefined;

  const liveOrdinals = unit.getAllProblemOrdinals();
  const ordinal = currentProblemOrdinal(problem);
  const currentIndex = liveOrdinals.indexOf(ordinal);
  if (currentIndex === -1) return undefined;

  const entryByOrdinal = new Map(summary.entries.map((entry) => [entry.ordinal, entry]));
  const currentEntry = entryByOrdinal.get(ordinal);
  if (!currentEntry) return undefined;

  const nextOrdinal = liveOrdinals[currentIndex + 1];
  const nextEntry = nextOrdinal ? entryByOrdinal.get(nextOrdinal) : undefined;

  const priorKnowledge = currentEntry.priorKnowledge || "(nothing recorded)";
  const lines = [
    `What the student should already know entering this problem: ${priorKnowledge}`,
    `This problem (${ordinal}): ${currentEntry.problemDigest}`,
  ];
  if (nextEntry) {
    lines.push(`The next problem (${nextOrdinal}): ${nextEntry.problemDigest}`);
  }
  return lines.join("\n\n");
}
