import { defaultCatalog, loadCatalog, stationsFromUnitConfig } from "./load-catalog";
import { reprocessUrlParams } from "../../utilities/url-params";

const stations = [{ network: "AK", station: "K204", channel: "HNZ", location: "--", label: "Anchorage" }];

// Point the global urlParams (shared with CurriculumConfig and getContent) at a new search string.
const setSearch = (search: string) => {
  window.history.replaceState({}, "", `/${search}`);
  reprocessUrlParams();
};

describe("stationsFromUnitConfig", () => {
  it("extracts wave-runner stations from config.settings", () => {
    const json = { config: { settings: { "wave-runner": { stations } } } };
    expect(stationsFromUnitConfig(json)).toEqual(stations);
  });

  it("supports deprecated top-level settings", () => {
    const json = { settings: { "wave-runner": { stations } } };
    expect(stationsFromUnitConfig(json)).toEqual(stations);
  });

  it("returns undefined when the unit declares no stations", () => {
    expect(stationsFromUnitConfig({})).toBeUndefined();
    expect(stationsFromUnitConfig({ config: { settings: {} } })).toBeUndefined();
  });
});

describe("defaultCatalog", () => {
  it("reads the wave-runner stations from the base app config", () => {
    const base = defaultCatalog();
    expect(base.length).toBeGreaterThan(0);
    expect(base.map(s => s.station)).toContain("RC01");
  });
});

describe("loadCatalog", () => {
  afterEach(() => {
    delete (global as any).fetch;
    setSearch("");
  });

  it("returns the base catalog when there is no unit param", async () => {
    setSearch("");
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });

  it("falls back to the base catalog when the unit declares no stations", async () => {
    setSearch("?unit=seismic");
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ config: { settings: {} } }) }));
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });

  it("fetches the unit URL and returns its stations", async () => {
    setSearch("?unit=https%3A%2F%2Fexample.org%2Funits%2Fqa%2Fcontent.json");
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ config: { settings: { "wave-runner": { stations } } } }),
    }));
    const result = await loadCatalog();
    expect(result).toEqual(stations);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("https://example.org/units/qa/content.json");
  });

  it("resolves a bare unit code against the curriculum site and branch", async () => {
    setSearch("?unit=seismic&curriculumBranch=my-branch");
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ config: { settings: { "wave-runner": { stations } } } }),
    }));
    await loadCatalog();
    expect((global.fetch as jest.Mock).mock.calls[0][0])
      .toBe("https://models-resources.concord.org/clue-curriculum/branch/my-branch/seismic/content.json");
  });

  it("falls back to the base catalog on fetch failure", async () => {
    setSearch("?unit=https%3A%2F%2Fexample.org%2Fcontent.json");
    (global as any).fetch = jest.fn(async () => { throw new Error("network"); });
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });
});
