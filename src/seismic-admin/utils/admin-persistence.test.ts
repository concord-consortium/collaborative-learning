import { loadFilters, saveFilters } from "./admin-persistence";

describe("admin-persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips filters", () => {
    saveFilters({ startDate: "2026-01-30", endDate: "2026-02-02", selected: ["AK_K204_HNZ"] });
    expect(loadFilters()).toEqual({
      startDate: "2026-01-30", endDate: "2026-02-02", selected: ["AK_K204_HNZ"],
    });
  });

  it("distinguishes an empty selection from an absent one", () => {
    saveFilters({ startDate: "2026-01-30", endDate: "2026-02-02", selected: [] });
    expect(loadFilters().selected).toEqual([]);
  });

  it("returns {} when nothing is stored", () => {
    expect(loadFilters()).toEqual({});
  });

  it("returns {} on malformed JSON", () => {
    window.localStorage.setItem("seismic-admin-filters", "{not json");
    expect(loadFilters()).toEqual({});
  });

  it("drops fields of the wrong type", () => {
    window.localStorage.setItem("seismic-admin-filters", JSON.stringify({ startDate: 5, selected: [1, 2] }));
    expect(loadFilters()).toEqual({ startDate: undefined, endDate: undefined, selected: undefined });
  });
});
