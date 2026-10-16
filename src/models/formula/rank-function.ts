import { DateTime } from "luxon";
import {
  evaluateNode, getRootScope, isValueTruthy, UNDEF_RESULT
} from "@concord-consortium/codap-formulas/models/formula/functions/function-utils";
import {
  IFormulaMathjsFunction
} from "@concord-consortium/codap-formulas/models/formula/formula-types";
import {
  registerMathjsFunction
} from "@concord-consortium/codap-formulas/models/formula/functions/math";

/**
 * A comparable number for a cell value: numbers as themselves, ISO date strings as epoch millis.
 * A CLUE cell holds a number, a string or nothing, so those are the only cases to cover.
 */
function sortKey(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const str = String(value ?? "").trim();
  if (!str) return undefined;
  const num = Number(str);
  if (Number.isFinite(num)) return num;
  const date = DateTime.fromISO(str);
  return date.isValid ? date.toMillis() : undefined;
}

/**
 * An argument as one value per case. An argument that names no attribute -- a constant filter such
 * as `rank(v, true)` -- evaluates to a single value rather than a column, and has to apply to every
 * case rather than only the first.
 */
const asColumn = (value: unknown, caseCount: number) =>
  Array.isArray(value) ? value : new Array(caseCount).fill(value);

/**
 * rank(expression, filterExpression)
 *
 * The 1-based position of this case's value among the column's values in ascending order. Ties take
 * consecutive ranks in case order. Cases whose value is empty or unparseable, or that fail the
 * filter, get no rank and do not consume one.
 *
 * A semi-aggregate: the arguments are evaluated over the whole column, but a value is returned per
 * case. `linRegrResidual` in the formula library works the same way.
 */
const rankFunction: IFormulaMathjsFunction = {
  numOfRequiredArguments: 1,
  isAggregate: true,
  isSemiAggregate: [true, true],
  evaluateRaw: (args, mathjs, currentScope) => {
    const scope = getRootScope(currentScope);
    const [valueArg, filterArg] = args;
    const cacheKey = `rank(${args.toString()})-${scope.getCaseAggregateGroupId()}`;
    let ranks = scope.getCached<Map<number, number>>(cacheKey);
    if (!ranks) {
      const caseCount = scope.getNumberOfCases();
      const values = asColumn(evaluateNode(valueArg, scope), caseCount);
      const filters = filterArg ? asColumn(evaluateNode(filterArg, scope), caseCount) : undefined;
      const ordered = values
        .map((value, index) => ({ index, key: sortKey(value) }))
        .filter(({ index, key }) => key != null && (!filters || isValueTruthy(filters[index])))
        .sort((a, b) => a.key! - b.key!);
      ranks = new Map(ordered.map(({ index }, i) => [index, i + 1]));
      scope.setCached(cacheKey, ranks);
    }
    return ranks.get(scope.getCasePointer()) ?? UNDEF_RESULT;
  }
};

/** Makes `rank` available to formulas, and to the formula editor's autocompletion. */
export function registerRankFunction() {
  registerMathjsFunction("rank", rankFunction);
}
