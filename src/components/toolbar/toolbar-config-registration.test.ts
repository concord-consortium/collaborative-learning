// uPlot needs a canvas/matchMedia that jsdom doesn't provide; timeline/wave-runner pull it in
// transitively via shared-seismogram. Mirrors the mock used in timeline-tile.test.tsx.
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import appConfig from "../../clue/app-config.json";
import { kAllTileTypeIds, registerTileTypes } from "../../register-tile-types";
import { JSONValue } from "../../models/stores/settings";
import { isValidButtonDescription } from "./tile-toolbar";
import { getRegisteredTileTypes, getToolbarButtonInfo } from "./toolbar-button-manager";

// Trigger every production toolbar registration as an import side effect, the same way the
// app does at startup (see register-tile-types.ts). Sourced from the registry itself (not a
// hand-maintained list) so a newly added/removed tile type can't silently fall out of coverage.
// This must NOT include test-only registrations (e.g. the "test" tile type registered in
// tile-toolbar.test.tsx).
beforeAll(() => registerTileTypes(kAllTileTypeIds));

const settings = appConfig.config.settings as Record<string, { tools?: JSONValue[] }>;

describe("toolbar config/registration drift guard (CLUE-573)", () => {
  it("every configured tool resolves to a registered button", () => {
    const failures: string[] = [];
    for (const [group, groupSettings] of Object.entries(settings)) {
      const tools = groupSettings?.tools;
      if (!tools) continue;
      for (const entry of tools) {
        if (!isValidButtonDescription(entry)) {
          failures.push(`settings.${group}.tools contains a malformed entry: ` +
            `${JSON.stringify(entry)} (tile-toolbar's isValidButtonDescription would reject ` +
            `this at runtime and render nothing for it)`);
          continue;
        }
        if (entry === "|") continue;
        const name = Array.isArray(entry) ? entry[0] : entry;
        if (!getToolbarButtonInfo(group, name)) {
          failures.push(`settings.${group}.tools contains "${name}", ` +
            `but no button named "${name}" is registered for tile type "${group}"`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every tile type registering toolbar buttons has a default tools config", () => {
    const registeredTileTypes = getRegisteredTileTypes();
    const failures: string[] = [];
    for (const tileType of registeredTileTypes) {
      const tools = settings[tileType]?.tools;
      if (!Array.isArray(tools) || tools.length === 0) {
        failures.push(`tile type "${tileType}" registers toolbar buttons, ` +
          `but settings.${tileType}.tools is missing or empty in app-config.json ` +
          `(the toolbar would not render at all)`);
      }
    }
    expect(failures).toEqual([]);
  });
});
