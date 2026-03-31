import * as tf from "@tensorflow/tfjs";
import { ArchitectureBuildFn, ModelMetadata } from "./seismic-model-types";

const ARCHITECTURES: Record<string, ArchitectureBuildFn> = {
  compact: buildCompactModel,
  standard: buildStandardModel,
  placeholder: buildPlaceholderModel,
};

export function getArchitecture(name: string): ArchitectureBuildFn | undefined {
  return ARCHITECTURES[name];
}

/**
 * Compact seismic CNN: conv1→bn1→pool1 → conv2→bn2→pool2 → conv3→bn3→globalPool → fc.
 * Mirrors PyTorch CompactSeismicCNN from tiny-cnn-seismicML.
 * ~12K params for 2-class. Output is raw logits (no softmax).
 */
export function buildCompactModel(metadata: ModelMetadata): tf.LayersModel {
  const samplesPerWindow = metadata.sampling_rate * metadata.window_duration;
  const numClasses = metadata.class_names.length;

  const model = tf.sequential({ name: "CompactSeismicCNN" });

  // Conv1: 1→16, k7, s2
  model.add(tf.layers.conv1d({
    filters: 16, kernelSize: 7, strides: 2, padding: "same",
    inputShape: [samplesPerWindow, 1], name: "conv1",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn1" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool1" }));

  // Conv2: 16→32, k5, s1
  model.add(tf.layers.conv1d({
    filters: 32, kernelSize: 5, strides: 1, padding: "same", name: "conv2",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn2" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool2" }));

  // Conv3: 32→64, k3, s1
  model.add(tf.layers.conv1d({
    filters: 64, kernelSize: 3, strides: 1, padding: "same", name: "conv3",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn3" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.globalAveragePooling1d({ name: "global_pool" }));

  model.add(tf.layers.dense({ units: numClasses, name: "fc" }));

  return model;
}

/**
 * Standard (larger) seismic CNN: 4 conv blocks, up to 128 channels, two FC layers.
 * Mirrors PyTorch SeismicCNN from tiny-cnn-seismicML. ~94K params for 2-class.
 * Output is raw logits (no softmax).
 */
export function buildStandardModel(metadata: ModelMetadata): tf.LayersModel {
  const samplesPerWindow = metadata.sampling_rate * metadata.window_duration;
  const numClasses = metadata.class_names.length;

  const model = tf.sequential({ name: "StandardSeismicCNN" });

  // Conv1: 1→32, k7, s2
  model.add(tf.layers.conv1d({
    filters: 32, kernelSize: 7, strides: 2, padding: "same",
    inputShape: [samplesPerWindow, 1], name: "conv1",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn1" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool1" }));

  // Conv2: 32→64, k5, s1
  model.add(tf.layers.conv1d({
    filters: 64, kernelSize: 5, strides: 1, padding: "same", name: "conv2",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn2" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool2" }));

  // Conv3: 64→128, k3, s1
  model.add(tf.layers.conv1d({
    filters: 128, kernelSize: 3, strides: 1, padding: "same", name: "conv3",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn3" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool3" }));

  // Conv4: 128→128, k3, s1
  model.add(tf.layers.conv1d({
    filters: 128, kernelSize: 3, strides: 1, padding: "same", name: "conv4",
  }));
  model.add(tf.layers.batchNormalization({ name: "bn4" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling1d({ poolSize: 2, strides: 2, name: "pool4" }));

  model.add(tf.layers.globalAveragePooling1d({ name: "global_pool" }));

  model.add(tf.layers.dense({ units: 64, activation: "relu", name: "fc1" }));
  model.add(tf.layers.dense({ units: numClasses, name: "fc2" }));

  return model;
}

/**
 * Load weights from a JSON object into a model by matching layer names to JSON keys.
 * Works with both compact and standard architectures.
 * The JSON format matches tiny-cnn-seismicML's export scripts: conv kernels are stored
 * as nested arrays with shape [kernelSize, inChannels, outChannels].
 */
export function loadWeightsFromJson(model: tf.LayersModel, weightsJson: Record<string, number[]>): void {
  const setConvOrDense = (layerName: string) => {
    model.getLayer(layerName).setWeights([
      tf.tensor(weightsJson[`${layerName}/kernel`]),
      tf.tensor1d(weightsJson[`${layerName}/bias`]),
    ]);
  };

  const setBatchNorm = (layerName: string) => {
    model.getLayer(layerName).setWeights([
      tf.tensor1d(weightsJson[`${layerName}/gamma`]),
      tf.tensor1d(weightsJson[`${layerName}/beta`]),
      tf.tensor1d(weightsJson[`${layerName}/moving_mean`]),
      tf.tensor1d(weightsJson[`${layerName}/moving_variance`]),
    ]);
  };

  // Load conv + bn pairs that exist in the weights JSON
  for (const name of ["conv1", "conv2", "conv3", "conv4"]) {
    if (`${name}/kernel` in weightsJson) {
      setConvOrDense(name);
      setBatchNorm(name.replace("conv", "bn"));
    }
  }

  // Load FC layers — compact uses "fc", standard uses "fc1" + "fc2"
  for (const name of ["fc", "fc1", "fc2"]) {
    if (`${name}/kernel` in weightsJson) {
      setConvOrDense(name);
    }
  }
}

export function buildPlaceholderModel(metadata: ModelMetadata): tf.LayersModel {
  const samplesPerWindow = metadata.sampling_rate * metadata.window_duration;
  const numClasses = metadata.class_names.length;

  const input = tf.input({ shape: [samplesPerWindow, 1] });
  const flat = tf.layers.flatten().apply(input);
  const output = tf.layers.dense({ units: numClasses }).apply(flat);

  return tf.model({ inputs: input, outputs: output as tf.SymbolicTensor });
}
