// A slice of the unit's authored aiUnitSummary, installed alongside LEFT so the tutor has
// cumulative unit context for the current problem without sending the whole unit's content. The
// filtering and formatting rules live in shared/unit-summary-slice.ts, shared with every other AI
// consumer; this module's job is only to build the live problem list from the loaded unit model.
import { getParent } from "mobx-state-tree";
import { InvestigationModelType } from "../../models/curriculum/investigation";
import { ProblemModelType } from "../../models/curriculum/problem";
import { UnitModelType } from "../../models/curriculum/unit";
import { formatUnitSummarySlice, ILiveProblem, unitSummarySlice } from "../../../shared/unit-summary-slice";

// The same ordinal string Unit.getAllProblemOrdinals() produces --
// "${investigation.ordinal}.${problem.ordinal}". getParent is called twice because a problem's
// direct MST parent is the investigation's `problems` array, not the investigation itself --
// same walk getSectionPath uses (unit.ts).
export function currentProblemOrdinal(problem: ProblemModelType): string {
  const investigation = getParent(getParent(problem)) as InvestigationModelType;
  return `${investigation.ordinal}.${problem.ordinal}`;
}

function liveProblemsFromUnit(unit: UnitModelType): ILiveProblem[] {
  return unit.investigations.reduce<ILiveProblem[]>((acc, investigation) => {
    investigation.problems.forEach(problem => {
      acc.push({ ordinal: `${investigation.ordinal}.${problem.ordinal}`, title: problem.title });
    });
    return acc;
  }, []);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function buildUnitContext(unit: UnitModelType, problem: ProblemModelType): string | undefined {
  const liveProblems = liveProblemsFromUnit(unit);

  // getAllProblemOrdinals() is the canonical order; if this walk disagrees with it, something about the walk
  // itself is wrong, so fail closed rather than risk building a slice against the wrong problem order.
  if (!arraysEqual(liveProblems.map(p => p.ordinal), unit.getAllProblemOrdinals())) return undefined;

  const slice = unitSummarySlice(unit.config?.aiUnitSummary, liveProblems, currentProblemOrdinal(problem));
  return slice && formatUnitSummarySlice(slice);
}
