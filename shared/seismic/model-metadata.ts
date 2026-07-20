import { ModelMetadata } from "./seismic-model-types";

export const SUPPORTED_SCHEMA = "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json";

export const PLACEHOLDER_MODEL_URL = "placeholder:random-weights";

export const PLACEHOLDER_METADATA: ModelMetadata = {
  $schema: SUPPORTED_SCHEMA,
  id: "placeholder-v1",
  architecture: "placeholder",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H", "N", "L"],
  weightsUrl: "",
};

// The model list is configured per-unit under settings["wave-runner"].models.
export interface ModelListEntry {
  label: string;
  metadataUrl: string;
}

/**
 * Fetch and validate model metadata; resolves weightsUrl relative to metadataUrl.
 * PLACEHOLDER_MODEL_URL short-circuits to a fresh copy of PLACEHOLDER_METADATA.
 * Throws on fetch failure or unsupported $schema.
 */
export async function fetchModelMetadata(metadataUrl: string): Promise<ModelMetadata> {
  if (metadataUrl === PLACEHOLDER_MODEL_URL) {
    return { ...PLACEHOLDER_METADATA };
  }

  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch model metadata: ${response.status}`);
  }
  const metadata: ModelMetadata = await response.json();
  if (metadata.$schema !== SUPPORTED_SCHEMA) {
    throw new Error(
      `Unsupported model schema: "${metadata.$schema}". This version of CLUE supports "${SUPPORTED_SCHEMA}".`
    );
  }
  // Resolve weightsUrl relative to the metadata URL
  metadata.weightsUrl = new URL(metadata.weightsUrl, metadataUrl).href;
  return metadata;
}
