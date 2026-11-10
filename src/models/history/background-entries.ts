// This rule is temporary. History entries recorded before the `background` flag existed carry no
// flag, so it recognizes the ones produced by code (DataFlow ticks and recomputes, Simulator
// steps) from their action names and patch paths. It is removed the release after the migration
// script that backfills the flag has run.
import { HistoryEntrySnapshot, HistoryEntryType } from "./history";

interface ILegacyEntryShape {
  action?: string;
  records: ReadonlyArray<{ patches: ReadonlyArray<{ op: string; path: string }> }>;
}

const kBackgroundActionSuffixes = ["/tickAndProcess", "/processAfterProgramChange"];
const kSimulatorStepAction = /^\/content\/tileMap\/[^/]+\/content\/step$/;
const kSetProgramSuffix = "/setProgram";
// A tick-driven setProgram rewrites only the running values of program nodes.
const kRunningValuesPath =
  /^\/content\/tileMap\/[^/]+\/content\/program\/values\/\d+\/(currentValues|recentValues)(\/|$)/;

export function isLegacyBackgroundEntry(entry: ILegacyEntryShape): boolean {
  const action = entry.action;
  if (!action) return false;
  if (kBackgroundActionSuffixes.some(suffix => action.endsWith(suffix))) return true;
  if (kSimulatorStepAction.test(action)) return true;
  if (action.endsWith(kSetProgramSuffix)) {
    const patches = entry.records.flatMap(record => record.patches);
    return patches.length > 0 &&
      patches.every(patch => patch.op === "replace" && kRunningValuesPath.test(patch.path));
  }
  return false;
}

export function isBackgroundEntry(entry: HistoryEntryType | HistoryEntrySnapshot): boolean {
  return entry.background ?? isLegacyBackgroundEntry(entry as ILegacyEntryShape);
}

const kSetProgram = "/content/tileMap/t1/content/setProgram";
const kValues = "/content/tileMap/t1/content/program/values";
const valuesReplaces = [
  { op: "replace", path: `${kValues}/3489/recentValues/nodeValue` },
  { op: "replace", path: `${kValues}/3490/currentValues/nodeValue` }
];
const rec = (patches: Array<{ op: string; path: string }>) => ({ patches });

export const kLegacyBackgroundRuleCases: Array<{ name: string; entry: ILegacyEntryShape; expected: boolean }> = [
  { name: "DataFlow tick", expected: true,
    entry: { action: "/content/tileMap/t1/content/program/tickAndProcess", records: [rec(valuesReplaces)] } },
  { name: "DataFlow recompute", expected: true,
    entry: { action: "/content/tileMap/t1/content/program/processAfterProgramChange", records: [] } },
  { name: "Simulator step", expected: true,
    entry: { action: "/content/tileMap/s1/content/step", records: [] } },
  { name: "values-only setProgram", expected: true,
    entry: { action: kSetProgram, records: [rec(valuesReplaces)] } },
  { name: "setProgram with a node move", expected: false,
    entry: { action: kSetProgram, records: [rec([
      valuesReplaces[0],
      { op: "replace", path: "/content/tileMap/t1/content/program/nodes/3489/position/0" }
    ])] } },
  { name: "setProgram adding a node", expected: false,
    entry: { action: kSetProgram, records: [rec([{ op: "add", path: `${kValues}/3491` }])] } },
  { name: "setProgram with no patches", expected: false,
    entry: { action: kSetProgram, records: [] } },
  { name: "text edit", expected: false,
    entry: { action: "/content/tileMap/x1/content/setText", records: [rec(valuesReplaces)] } }
];
