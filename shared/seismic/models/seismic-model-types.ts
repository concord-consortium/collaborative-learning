import * as tf from "@tensorflow/tfjs";

/**
 * Model metadata fetched from metadata.json.
 * See docs/seismic/ml-model-integration-design.md § Model Packaging.
 *
 * The JSON Schema for this interface is generated automatically.
 * Do not edit src/public/schemas/seismic-model/v1.json by hand —
 * run `npm run update:seismic-schema` to regenerate it from this type.
 */
export interface ModelMetadata {
  $schema: string;               // e.g., "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json"
  id: string;                    // e.g., "compact-v1"
  architecture: string;          // maps to a build function in ARCHITECTURES
  class_names: string[];         // e.g., ["Noise", "Earthquake"]
  sampling_rate: number;         // Hz expected by the model
  window_duration: number;       // seconds per classification window
  instrument_types: string[];    // compatible SEED instrument codes
  weightsUrl: string;            // relative URL to weights.json
}

/**
 * A single detected event produced by the runner.
 * Matches the SharedDataSet schema in the design doc.
 */
export interface SeismicEvent {
  windowStart: number;   // epoch ms
  windowEnd: number;     // epoch ms
  eventType: string;     // e.g., "Earthquake"
  confidence: number;    // 0–1
}

export interface ModelRunnerCallbacks {
  onProgress: (windowsProcessed: number, windowsTotal: number) => void;
  onEvents: (events: SeismicEvent[]) => void;
}

/**
 * A function that builds a TF.js LayersModel for a given architecture.
 * The model's input shape and output classes are derived from metadata.
 */
export type ArchitectureBuildFn = (metadata: ModelMetadata) => tf.LayersModel;
