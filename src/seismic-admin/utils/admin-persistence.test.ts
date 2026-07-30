import { loadFilters, saveFilters } from "./admin-persistence";

describe("admin-persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips filters", () => {
    saveFilters({
      startDate: "2026-01-30", endDate: "2026-02-02",
      selectedStations: ["AK_K204_HNZ"], selectedModels: ["https://x/m.json"],
    });
    expect(loadFilters()).toEqual({
      startDate: "2026-01-30", endDate: "2026-02-02",
      selectedStations: ["AK_K204_HNZ"], selectedModels: ["https://x/m.json"],
    });
  });

  it("distinguishes an empty selection from an absent one", () => {
    saveFilters({ startDate: "2026-01-30", endDate: "2026-02-02", selectedStations: [] });
    expect(loadFilters().selectedStations).toEqual([]);
  });

  it("returns {} when nothing is stored", () => {
    expect(loadFilters()).toEqual({});
  });

  it("returns {} on malformed JSON", () => {
    window.localStorage.setItem("seismic-admin-filters", "{not json");
    expect(loadFilters()).toEqual({});
  });

  it("drops fields of the wrong type", () => {
    window.localStorage.setItem("seismic-admin-filters",
      JSON.stringify({ startDate: 5, selectedStations: [1, 2], selectedModels: "bogus" }));
    expect(loadFilters()).toEqual({
      startDate: undefined, endDate: undefined, selectedStations: undefined, selectedModels: undefined,
    });
  });
});
