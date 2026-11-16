// This rule is temporary. History entries recorded before the `background` flag existed carry no
// flag, so it recognizes the ones produced by code (DataFlow ticks and recomputes, Simulator
// steps) from their action names and patch paths. Remove it the release after the migration script
// that backfills the flag has run.
import { HistoryEntrySnapshot, HistoryEntryType } from "./history";

interface ILegacyEntryShape {
  action?: string;
  // Optional because an entry snapshot may leave it out.
  records?: ReadonlyArray<{ patches: ReadonlyArray<{ op: string; path: string }> }>;
}

const kBackgroundActionSuffixes = ["/tickAndProcess", "/processAfterProgramChange"];
const kSimulatorStepAction = /^\/content\/tileMap\/[^/]+\/content\/step$/;
const kSetProgramSuffix = "/setProgram";
// A tick-driven setProgram rewrites the running values of program nodes, and may also refresh the
// demo output of nodes.
const kRunningValuesPath =
  /^\/content\/tileMap\/[^/]+\/content\/program\/values\/\d+\/(currentValues|recentValues)(\/|$)/;
const kDemoOutputPath = /^\/content\/tileMap\/[^/]+\/content\/program\/nodes\/[^/]+\/data\/demoOutput(\/|$)/;

export function isLegacyBackgroundEntry(entry: ILegacyEntryShape): boolean {
  const action = entry.action;
  if (!action) return false;
  if (kBackgroundActionSuffixes.some(suffix => action.endsWith(suffix))) return true;
  if (kSimulatorStepAction.test(action)) return true;
  if (action.endsWith(kSetProgramSuffix)) {
    const patches = (entry.records ?? []).flatMap(record => record.patches);
    // demoOutput alone is not enough: at least one running-values patch must be present.
    return patches.some(patch => patch.op === "replace" && kRunningValuesPath.test(patch.path)) &&
      patches.every(patch => patch.op === "replace" &&
        (kRunningValuesPath.test(patch.path) || kDemoOutputPath.test(patch.path)));
  }
  return false;
}

// The rule's answer per entry. Playback reads every entry each time the history grows, and an
// entry in the history doesn't change.
const legacyRuleResults = new WeakMap<object, boolean>();

export function isBackgroundEntry(entry: HistoryEntryType | HistoryEntrySnapshot): boolean {
  if (entry.background !== undefined) return entry.background;
  let result = legacyRuleResults.get(entry);
  if (result === undefined) {
    result = isLegacyBackgroundEntry(entry as ILegacyEntryShape);
    legacyRuleResults.set(entry, result);
  }
  return result;
}
