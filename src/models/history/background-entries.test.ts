import { isBackgroundEntry, isLegacyBackgroundEntry } from "./background-entries";
import { HistoryEntrySnapshot } from "./history";

const kSetProgram = "/content/tileMap/t1/content/setProgram";
const kValues = "/content/tileMap/t1/content/program/values";
const valuesReplaces = [
  { op: "replace", path: `${kValues}/3489/recentValues/nodeValue` },
  { op: "replace", path: `${kValues}/3490/currentValues/nodeValue` }
];
const demoPath = "/content/tileMap/t1/content/program/nodes/3489/data/demoOutput/tilt";
const demoReplace = { op: "replace", path: demoPath };
const rec = (patches: Array<{ op: string; path: string }>) => ({ patches });

const kLegacyBackgroundRuleCases = [
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
  { name: "values and demoOutput setProgram", expected: true,
    entry: { action: kSetProgram, records: [rec([valuesReplaces[0], demoReplace])] } },
  { name: "demoOutput-only setProgram", expected: false,
    entry: { action: kSetProgram, records: [rec([demoReplace])] } },
  { name: "setProgram adding demoOutput", expected: false,
    entry: { action: kSetProgram, records: [rec([valuesReplaces[0], { op: "add", path: demoPath }])] } },
  { name: "setProgram with no patches", expected: false,
    entry: { action: kSetProgram, records: [] } },
  { name: "text edit", expected: false,
    entry: { action: "/content/tileMap/x1/content/setText", records: [rec(valuesReplaces)] } }
];

describe("isLegacyBackgroundEntry", () => {
  it.each(kLegacyBackgroundRuleCases)("$name", ({ entry, expected }) => {
    expect(isLegacyBackgroundEntry(entry)).toBe(expected);
  });
});

describe("isBackgroundEntry", () => {
  const tick = kLegacyBackgroundRuleCases[0].entry;

  it("applies the legacy rule when no flag is stored", () => {
    expect(isBackgroundEntry({ id: "e1", ...tick } as any)).toBe(true);
  });

  it("treats a setProgram snapshot without records as a user entry", () => {
    const snapshot: HistoryEntrySnapshot = { id: "e1", action: "/content/tileMap/t1/content/setProgram" };
    expect(isBackgroundEntry(snapshot)).toBe(false);
  });

  it("returns the stored flag even against the rule", () => {
    expect(isBackgroundEntry({ id: "e1", ...tick, background: false } as any)).toBe(false);
    expect(isBackgroundEntry({ id: "e1", action: "/content/tileMap/x1/content/setText", records: [],
      background: true } as any)).toBe(true);
  });
});
