import { normalize } from "../ai-summarizer/ai-summarizer";
import { projectSharedModels, ProjectSharedModelsOptions } from "./shared-models";

// The shape a live document holds: each entry pairs one shared model with the tiles referencing
// it. The relationship is many-to-many — a simulator publishes variables that a Dataflow program
// reads — which is why these cannot live inside any one tile.
const sharedModelMap = {
  "sm-vars": {
    sharedModel: {
      type: "SharedVariables", id: "sm-vars",
      variables: [
        { id: "v-emg", name: "emg_key", displayName: "EMG", unit: "mV", value: 37,
          inputs: [], color: "light-gray", icon: "ccicon://emg_key",
          labels: ["input", "sensor:emg-reading", "decimalPlaces:0", "__volatile__"] },
        { id: "v-grip", name: "gripper_key", displayName: "Gripper", unit: "% closed", value: 0,
          inputs: [], color: "light-gray", icon: "ccicon://gripper_key",
          labels: ["output", "live-output:Grabber", "decimalPlaces:0", "__volatile__"] },
        { id: "v-mode", name: "simulation_mode_key", displayName: "Simulation Mode", value: 0,
          inputs: [], color: "light-gray", labels: [] },
      ],
    },
    tiles: ["tile-sim-1", "tile-df-1"],
  },
  "sm-data": {
    sharedModel: {
      type: "SharedDataSet", id: "sm-data", providerId: "tile-df-1",
      dataSet: {
        id: "ds-1", name: "Program 1", sortDirection: "NONE",
        attributes: [
          { id: "ATTRx", name: "time", units: "s", values: ["0", "1", "2", "3"] },
          { id: "ATTRy", name: "emg", units: "mV", values: ["37", "39", "250", "248"] },
        ],
        cases: [{ __id__: "c1" }, { __id__: "c2" }, { __id__: "c3" }, { __id__: "c4" }],
      },
    },
    tiles: ["tile-df-1"],
  },
};

// Extraction is the summarizer's job, so the tests run the real path rather than hand-building a
// normalized model — a projection that agrees with a fixture normalize() would never produce is
// not a projection that works.
function project(opts?: ProjectSharedModelsOptions) {
  const content = { rowOrder: [], rowMap: {}, tileMap: {}, sharedModelMap };
  return projectSharedModels(normalize(content as any).normalizedModel, sharedModelMap, opts);
}

describe("projectSharedModels", () => {
  it("links tiles to the models they reference, many-to-many", () => {
    const { tileModelIds } = project();
    expect(tileModelIds["tile-df-1"].sort()).toEqual(["sm-data", "sm-vars"]);
    expect(tileModelIds["tile-sim-1"]).toEqual(["sm-vars"]);
  });

  // The simulator's live readings are direct evidence for "why won't my gripper close" — but only
  // the reading matters. Color, icon and rendering hints are presentation, and they were most of
  // the raw bulk.
  it("projects variables to the reading and its role, dropping presentation metadata", () => {
    const { shared_models } = project();
    const vars = shared_models.find(m => m.model_id === "sm-vars")!;
    expect(vars.type).toBe("SharedVariables");
    expect((vars.content as any).variables[0]).toEqual({
      id: "v-emg", name: "EMG", value: 37, unit: "mV",
      role: ["input", "sensor:emg-reading"],
    });
    const json = JSON.stringify(vars);
    expect(json).not.toContain("ccicon");
    expect(json).not.toContain("light-gray");
    expect(json).not.toContain("decimalPlaces");
  });

  it("omits a role for a variable that is neither an input nor an output", () => {
    const { shared_models } = project();
    const vars = shared_models.find(m => m.model_id === "sm-vars")!;
    expect((vars.content as any).variables[2]).toEqual({
      id: "v-mode", name: "Simulation Mode", value: 0,
    });
  });

  // A Table tile holds column widths, not rows — the data is here. Values sit on the attributes as
  // parallel arrays, so a row is a zip across them.
  it("projects a dataset to its shape and its rows", () => {
    const { shared_models } = project();
    const data = shared_models.find(m => m.model_id === "sm-data")!;
    expect(data.type).toBe("SharedDataSet");
    expect(data.title).toBe("Program 1");
    expect((data.content as any).attributes).toEqual([
      { id: "ATTRx", name: "time", units: "s" },
      { id: "ATTRy", name: "emg", units: "mV" },
    ]);
    expect((data.content as any).case_count).toBe(4);
    expect((data.content as any).cases).toEqual([
      { time: "0", emg: "37" }, { time: "1", emg: "39" },
      { time: "2", emg: "250" }, { time: "3", emg: "248" },
    ]);
  });

  // A dataset is the one shared model that grows without bound — a recorded Dataflow run writes a
  // row per tick. The count stays truthful so truncation is visible rather than silent.
  it("bounds the rows it sends while reporting the true total", () => {
    const { shared_models } = project({ caseSampleSize: 2 });
    const data = shared_models.find(m => m.model_id === "sm-data")!;
    expect((data.content as any).case_count).toBe(4);
    expect((data.content as any).cases).toHaveLength(2);
    expect((data.content as any).cases_truncated).toBe(true);
  });

  it("does not mark an untruncated dataset as truncated", () => {
    const { shared_models } = project();
    const data = shared_models.find(m => m.model_id === "sm-data")!;
    expect((data.content as any).cases_truncated).toBeUndefined();
  });
});
