import * as tf from "@tensorflow/tfjs";
import { ArchitectureBuildFn, ModelMetadata } from "./seismic-model-types";

const ARCHITECTURES: Record<string, ArchitectureBuildFn> = {
  placeholder: buildPlaceholderModel,
};

export function getArchitecture(name: string): ArchitectureBuildFn | undefined {
  return ARCHITECTURES[name];
}

export function buildPlaceholderModel(metadata: ModelMetadata): tf.LayersModel {
  const samplesPerWindow = metadata.sampling_rate * metadata.window_duration;
  const numClasses = metadata.class_names.length;

  const input = tf.input({ shape: [samplesPerWindow, 1] });
  const flat = tf.layers.flatten().apply(input);
  const output = tf.layers.dense({ units: numClasses, activation: "softmax" }).apply(flat);

  return tf.model({ inputs: input, outputs: output as tf.SymbolicTensor });
}
