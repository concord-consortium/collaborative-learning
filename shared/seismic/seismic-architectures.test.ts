import * as tf from "@tensorflow/tfjs";
import {
  getArchitecture, buildPlaceholderModel, buildCompactModel, buildStandardModel, loadWeightsFromJson
} from "./seismic-architectures";
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

/**
 * Generate zero-filled weights matching a model's layer structure.
 * Preserves tensor shapes (nested arrays for conv kernels) to match
 * the format produced by tiny-cnn-seismicML's export scripts.
 */
function generateMockWeights(model: tf.LayersModel): Record<string, any> {
  const weights: Record<string, any> = {};

  function zerosForShape(shape: number[]): any {
    if (shape.length === 1) return Array(shape[0]).fill(0);
    return Array.from({ length: shape[0] }, () => zerosForShape(shape.slice(1)));
  }

  for (const layer of model.layers) {
    const layerWeights = layer.getWeights();
    if (layerWeights.length === 0) continue;

    const name = layer.name;
    if (name.startsWith("conv") || name.startsWith("fc")) {
      weights[`${name}/kernel`] = zerosForShape(layerWeights[0].shape);
      weights[`${name}/bias`] = zerosForShape(layerWeights[1].shape);
    } else if (name.startsWith("bn")) {
      weights[`${name}/gamma`] = Array(layerWeights[0].size).fill(1);
      weights[`${name}/beta`] = Array(layerWeights[1].size).fill(0);
      weights[`${name}/moving_mean`] = Array(layerWeights[2].size).fill(0);
      weights[`${name}/moving_variance`] = Array(layerWeights[3].size).fill(1);
    }
  }
  return weights;
}

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

  it("buildCompactModel returns a model with correct input/output shapes", () => {
    const model = buildCompactModel(mockMetadata);
    const expectedSamples = mockMetadata.sampling_rate * mockMetadata.window_duration;
    expect(model.inputs[0].shape).toEqual([null, expectedSamples, 1]);
    expect(model.outputs[0].shape).toEqual([null, mockMetadata.class_names.length]);
    model.dispose();
  });

  it("buildStandardModel returns a model with correct input/output shapes", () => {
    const model = buildStandardModel(mockMetadata);
    const expectedSamples = mockMetadata.sampling_rate * mockMetadata.window_duration;
    expect(model.inputs[0].shape).toEqual([null, expectedSamples, 1]);
    expect(model.outputs[0].shape).toEqual([null, mockMetadata.class_names.length]);
    model.dispose();
  });

  it("loadWeightsFromJson loads weights into compact model without error", () => {
    const model = buildCompactModel(mockMetadata);
    const mockWeights = generateMockWeights(model);
    expect(() => loadWeightsFromJson(model, mockWeights)).not.toThrow();
    model.dispose();
  });

  it("loadWeightsFromJson loads weights into standard model without error", () => {
    const model = buildStandardModel(mockMetadata);
    const mockWeights = generateMockWeights(model);
    expect(() => loadWeightsFromJson(model, mockWeights)).not.toThrow();
    model.dispose();
  });
});
