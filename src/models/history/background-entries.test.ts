import { isBackgroundEntry, isLegacyBackgroundEntry, kLegacyBackgroundRuleCases } from "./background-entries";

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

  it("returns the stored flag even against the rule", () => {
    expect(isBackgroundEntry({ id: "e1", ...tick, background: false } as any)).toBe(false);
    expect(isBackgroundEntry({ id: "e1", action: "/content/tileMap/x1/content/setText", records: [],
      background: true } as any)).toBe(true);
  });
});
