import * as tf from "@tensorflow/tfjs";
import { DateTime } from "luxon";
import { SeismicModelRunner } from "./seismic-model-runner";
import { ModelMetadata, ModelRunnerCallbacks, SeismicEvent } from "./seismic-model-types";

function makeMockSeismogram(
  samples: Float32Array,
  sampleRate: number,
  startTimeMs: number
): any {
  return {
    sampleRate,
    startTime: DateTime.fromMillis(startTimeMs, { zone: "utc" }),
    numPoints: samples.length,
    segments: [{ y: samples }],
  };
}

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

// Mock fetch that returns an empty weights JSON (placeholder has no named layers to load)
const mockFetch = (() => Promise.resolve({
  ok: true, json: () => Promise.resolve({}),
})) as unknown as typeof fetch;

function makeCallbacks() {
  const progressCalls: [number, number][] = [];
  const eventBatches: SeismicEvent[][] = [];
  const callbacks: ModelRunnerCallbacks = {
    onProgress: (processed, total) => progressCalls.push([processed, total]),
    onEvents: (events) => eventBatches.push(events),
  };
  return { callbacks, progressCalls, eventBatches };
}

describe("SeismicModelRunner", () => {
  beforeAll(() => tf.setBackend("cpu"));

  afterEach(() => {
    expect(tf.memory().numTensors).toBeLessThan(20);
  });

  it("loadModel builds model from registry and sets isLoaded", async () => {
    const runner = new SeismicModelRunner();
    expect(runner.isLoaded).toBe(false);
    await runner.loadModel(mockMetadata, mockFetch);
    expect(runner.isLoaded).toBe(true);
    runner.dispose();
  });

  it("loadModel throws for unknown architecture", async () => {
    const runner = new SeismicModelRunner();
    const badMetadata = { ...mockMetadata, architecture: "nonexistent" };
    await expect(runner.loadModel(badMetadata, mockFetch)).rejects.toThrow(
      'Unknown architecture: "nonexistent"'
    );
    runner.dispose();
  });

  it("processChunk processes 2 windows and reports progress and events", async () => {
    const runner = new SeismicModelRunner();
    await runner.loadModel(mockMetadata, mockFetch);

    // 2 windows: 100 Hz * 60s = 6000 samples/window, so 12000 samples total
    const samples = new Float32Array(12000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.01);
    const seis = makeMockSeismogram(samples, 100, 1000000);

    const { callbacks, progressCalls, eventBatches } = makeCallbacks();
    const allEvents = await runner.processChunk(seis, callbacks);

    // Progress should reach [2, 2]
    const lastProgress = progressCalls[progressCalls.length - 1];
    expect(lastProgress).toEqual([2, 2]);

    // All events should have valid structure
    for (const evt of allEvents) {
      expect(evt).toHaveProperty("windowStart");
      expect(evt).toHaveProperty("windowEnd");
      expect(evt).toHaveProperty("eventType");
      expect(evt).toHaveProperty("confidence");
      expect(typeof evt.windowStart).toBe("number");
      expect(typeof evt.windowEnd).toBe("number");
      expect(typeof evt.eventType).toBe("string");
      expect(typeof evt.confidence).toBe("number");
      expect(evt.confidence).toBeGreaterThanOrEqual(0);
      expect(evt.confidence).toBeLessThanOrEqual(1);
      expect(evt.eventType).not.toBe("Noise");
    }

    // Events emitted via callback should match return value
    const callbackEvents = eventBatches.flat();
    expect(callbackEvents).toEqual(allEvents);

    runner.dispose();
  });

  it("processChunk resamples from 200Hz to 100Hz", async () => {
    const runner = new SeismicModelRunner();
    await runner.loadModel(mockMetadata, mockFetch);

    // 12000 samples at 200Hz = 60s of data
    // Decimated to 100Hz = 6000 samples = 1 window
    const samples = new Float32Array(12000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.01);
    const seis = makeMockSeismogram(samples, 200, 1000000);

    const { callbacks, progressCalls } = makeCallbacks();
    await runner.processChunk(seis, callbacks);

    const lastProgress = progressCalls[progressCalls.length - 1];
    expect(lastProgress).toEqual([1, 1]);

    runner.dispose();
  });

  it("processChunk upsamples from 50Hz to 100Hz", async () => {
    const runner = new SeismicModelRunner();
    await runner.loadModel(mockMetadata, mockFetch);

    // 3000 samples at 50Hz = 60s of data
    // Upsampled to 100Hz = 6000 samples = 1 window
    const samples = new Float32Array(3000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.02);
    const seis = makeMockSeismogram(samples, 50, 1000000);

    const { callbacks, progressCalls } = makeCallbacks();
    await runner.processChunk(seis, callbacks);

    const lastProgress = progressCalls[progressCalls.length - 1];
    expect(lastProgress).toEqual([1, 1]);

    runner.dispose();
  });

  it("processChunk throws if model not loaded", async () => {
    const runner = new SeismicModelRunner();
    const samples = new Float32Array(6000);
    const seis = makeMockSeismogram(samples, 100, 1000000);
    const { callbacks } = makeCallbacks();

    await expect(runner.processChunk(seis, callbacks)).rejects.toThrow(
      "Model not loaded"
    );
  });

  it("resample handles single-sample input without producing NaN", async () => {
    const runner = new SeismicModelRunner();
    // Use compact model metadata with a tiny window so 1 resampled sample forms a "window"
    const tinyMetadata: ModelMetadata = {
      ...mockMetadata,
      sampling_rate: 100,
      window_duration: 0.01, // 1 sample per window at 100Hz
    };
    await runner.loadModel(tinyMetadata, mockFetch);

    // 1 sample at 80Hz → targetLength = Math.round(1 * 100/80) = 1
    // Without the fix, resample produces NaN due to 0/0 division
    const samples = new Float32Array([5.0]);
    const seis = makeMockSeismogram(samples, 80, 1000000);

    const { callbacks } = makeCallbacks();
    // With NaN data, the model produces NaN confidences which fail the threshold check.
    // With the fix, the single sample value is preserved and the model runs normally.
    const events = await runner.processChunk(seis, callbacks, 0);

    // threshold=0 so we'd get an event if the data is valid, but 0 events if it's NaN
    expect(events.length).toBe(1);

    runner.dispose();
  });

  it("placeholder architecture skips weights fetch and produces events", async () => {
    const placeholderMetadata: ModelMetadata = {
      ...mockMetadata,
      architecture: "placeholder",
      weightsUrl: "",
    };

    const runner = new SeismicModelRunner();
    // Pass a fetch that would fail — placeholder should never call it
    const failingFetch = (() => { throw new Error("should not fetch"); }) as unknown as typeof fetch;
    await runner.loadModel(placeholderMetadata, failingFetch);
    expect(runner.isLoaded).toBe(true);

    // 2 windows of data
    const samples = new Float32Array(12000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.01);
    const startMs = Date.UTC(2025, 0, 1); // 2025-01-01T00:00:00Z
    const seis = makeMockSeismogram(samples, 100, startMs);

    const { callbacks } = makeCallbacks();
    // Threshold 0 so every window produces an event
    const allEvents = await runner.processChunk(seis, callbacks, 0);

    expect(allEvents.length).toBe(2);
    expect(allEvents[0].windowStart).toBe(startMs);
    expect(allEvents[0].windowEnd).toBe(startMs + 60000);
    expect(allEvents[1].windowStart).toBe(startMs + 60000);

    runner.dispose();
  });
});
