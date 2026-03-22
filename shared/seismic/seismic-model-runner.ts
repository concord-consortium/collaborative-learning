import * as tf from "@tensorflow/tfjs";
import { getArchitecture, loadWeightsFromJson } from "./seismic-architectures";
import { ModelMetadata, ModelRunnerCallbacks, SeismicEvent } from "./seismic-model-types";

const BATCH_SIZE = 50;
const DETECTION_THRESHOLD = 0.5;

/**
 * Resample by integer decimation: keep every Nth sample.
 * Throws if the ratio sourceRate/targetRate is not a positive integer.
 */
function resample(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return samples;
  const ratio = sourceRate / targetRate;
  if (ratio <= 0 || !Number.isInteger(ratio)) {
    throw new Error(
      `Resampling requires a positive integer decimation ratio, got ${sourceRate}/${targetRate} = ${ratio}`
    );
  }
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    out[i] = samples[i * ratio];
  }
  return out;
}

export class SeismicModelRunner {
  private model: tf.LayersModel | null = null;
  private metadata: ModelMetadata | null = null;

  get isLoaded(): boolean {
    return this.model !== null;
  }

  async loadModel(metadata: ModelMetadata, fetchFn: typeof fetch = fetch): Promise<void> {
    const buildFn = getArchitecture(metadata.architecture);
    if (!buildFn) {
      throw new Error(`Unknown architecture: "${metadata.architecture}"`);
    }
    const model = buildFn(metadata);

    // Fetch and load pretrained weights
    const response = await fetchFn(metadata.weightsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch weights from ${metadata.weightsUrl}: ${response.status}`);
    }
    const weightsJson = await response.json();
    loadWeightsFromJson(model, weightsJson);

    this.model = model;
    this.metadata = metadata;
  }

  async processChunk(seismogram: any, callbacks: ModelRunnerCallbacks): Promise<SeismicEvent[]> {
    if (!this.model || !this.metadata) {
      throw new Error("Model not loaded");
    }

    const metadata = this.metadata;
    const model = this.model;

    // Extract samples from all segments into a single Float32Array
    let totalLength = 0;
    for (const seg of seismogram.segments) {
      totalLength += seg.y.length;
    }
    let rawSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const seg of seismogram.segments) {
      rawSamples.set(seg.y, offset);
      offset += seg.y.length;
    }

    // Resample if needed
    const samples = resample(rawSamples, seismogram.sampleRate, metadata.sampling_rate);

    const startTimeMs = seismogram.startTime.toMillis();
    const samplesPerWindow = metadata.sampling_rate * metadata.window_duration;
    const numWindows = Math.floor(samples.length / samplesPerWindow);
    const windowDurationMs = metadata.window_duration * 1000;

    const allEvents: SeismicEvent[] = [];

    for (let batchStart = 0; batchStart < numWindows; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, numWindows);
      const batchSize = batchEnd - batchStart;

      // Preprocess each window: subtract mean, divide by std
      const windowData = new Float32Array(batchSize * samplesPerWindow);
      for (let w = 0; w < batchSize; w++) {
        const windowIdx = batchStart + w;
        const windowOffset = windowIdx * samplesPerWindow;

        // Compute mean
        let sum = 0;
        for (let i = 0; i < samplesPerWindow; i++) {
          sum += samples[windowOffset + i];
        }
        const mean = sum / samplesPerWindow;

        // Compute std
        let sumSq = 0;
        for (let i = 0; i < samplesPerWindow; i++) {
          const diff = samples[windowOffset + i] - mean;
          sumSq += diff * diff;
        }
        const std = Math.sqrt(sumSq / samplesPerWindow) || 1;

        // Normalize
        const destOffset = w * samplesPerWindow;
        for (let i = 0; i < samplesPerWindow; i++) {
          windowData[destOffset + i] = (samples[windowOffset + i] - mean) / std;
        }
      }

      // Build tensor, predict, and apply softmax to convert logits to probabilities
      const inputTensor = tf.tensor3d(windowData, [batchSize, samplesPerWindow, 1]);
      const logits = model.predict(inputTensor) as tf.Tensor;
      const probabilities = tf.softmax(logits);
      const predData = await probabilities.data();

      // Dispose tensors immediately
      inputTensor.dispose();
      logits.dispose();
      probabilities.dispose();

      // Extract events from predictions
      const batchEvents: SeismicEvent[] = [];
      const numClasses = metadata.class_names.length;

      for (let w = 0; w < batchSize; w++) {
        const windowIdx = batchStart + w;
        const windowStartMs = startTimeMs + windowIdx * windowDurationMs;
        const windowEndMs = windowStartMs + windowDurationMs;

        for (let c = 0; c < numClasses; c++) {
          const className = metadata.class_names[c];
          if (className === "Noise") continue;

          const confidence = predData[w * numClasses + c];
          if (confidence >= DETECTION_THRESHOLD) {
            batchEvents.push({
              windowStart: windowStartMs,
              windowEnd: windowEndMs,
              eventType: className,
              confidence,
            });
          }
        }
      }

      if (batchEvents.length > 0) {
        callbacks.onEvents(batchEvents);
      }
      allEvents.push(...batchEvents);

      callbacks.onProgress(batchEnd, numWindows);

      await tf.nextFrame();
    }

    return allEvents;
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.metadata = null;
  }
}
