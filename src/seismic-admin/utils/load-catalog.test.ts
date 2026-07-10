import { defaultCatalog, loadCatalog, stationsFromUnitConfig, unitContentUrl } from "./load-catalog";

const stations = [{ network: "AK", station: "K204", channel: "HNZ", location: "--", label: "Anchorage" }];

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

describe("unitContentUrl", () => {
  it("uses a full URL as-is", () => {
    expect(unitContentUrl("https://example.org/units/qa/content.json"))
      .toBe("https://example.org/units/qa/content.json");
  });

  it("resolves a bare unit code against the curriculum site (main branch)", () => {
    expect(unitContentUrl("seismic"))
      .toBe("https://models-resources.concord.org/clue-curriculum/branch/main/seismic/content.json");
  });

  it("returns undefined for an empty value", () => {
    expect(unitContentUrl("")).toBeUndefined();
  });
});

describe("loadCatalog", () => {
  afterEach(() => { delete (global as any).fetch; });

  it("returns the base catalog when there is no unit param", async () => {
    expect(await loadCatalog("")).toEqual(defaultCatalog());
  });

  it("falls back to the base catalog when the unit declares no stations", async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ config: { settings: {} } }) }));
    expect(await loadCatalog("?unit=seismic")).toEqual(defaultCatalog());
  });

  it("fetches the unit URL and returns its stations", async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ config: { settings: { "wave-runner": { stations } } } }),
    }));
    const result = await loadCatalog("?unit=https://example.org/units/qa/content.json");
    expect(result).toEqual(stations);
    expect(global.fetch).toHaveBeenCalledWith("https://example.org/units/qa/content.json");
  });

  it("falls back to the base catalog on fetch failure", async () => {
    (global as any).fetch = jest.fn(async () => { throw new Error("network"); });
    expect(await loadCatalog("?unit=https://example.org/content.json")).toEqual(defaultCatalog());
  });
});
