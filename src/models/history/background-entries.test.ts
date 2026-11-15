import { isBackgroundEntry, isLegacyBackgroundEntry, kLegacyBackgroundRuleCases } from "./background-entries";
import { HistoryEntrySnapshot } from "./history";

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
