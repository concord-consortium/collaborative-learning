import { getArchitecture, buildPlaceholderModel } from "./seismic-architectures";
import { ModelMetadata } from "./seismic-model-types";

const mockMetadata: ModelMetadata = {
  $schema: "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json",
  id: "test-v1",
  architecture: "placeholder",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H"],
  weightsUrl: "./weights.json",
};

describe("seismic-architectures", () => {
  it("getArchitecture returns a build function for 'placeholder'", () => {
    const buildFn = getArchitecture("placeholder");
    expect(buildFn).toBe(buildPlaceholderModel);
  });

  it("getArchitecture returns undefined for unknown architecture", () => {
    expect(getArchitecture("nonexistent")).toBeUndefined();
  });

  it("buildPlaceholderModel returns a model with correct input/output shapes", () => {
    const model = buildPlaceholderModel(mockMetadata);
    const expectedSamples = mockMetadata.sampling_rate * mockMetadata.window_duration;
    expect(model.inputs[0].shape).toEqual([null, expectedSamples, 1]);
    expect(model.outputs[0].shape).toEqual([null, mockMetadata.class_names.length]);
    model.dispose();
  });
});
