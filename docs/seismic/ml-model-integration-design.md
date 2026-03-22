# ML Model Integration with Wave Runner

Design for the interface between the ML model code ([tiny-cnn-seismicML](https://github.com/concord-consortium/tiny-cnn-seismicML) repo) and the Wave Runner tile. This work is a prerequisite for implementing the ML model running in the browser (CLUE-440).

Related: [CLUE-466](https://concord-consortium.atlassian.net/browse/CLUE-466), [seismic-tiles-plan.md](seismic-tiles-plan.md), [event-database-design.md](event-database-design.md)

## Model Packaging

Each model is split into two files hosted on S3/CDN:

### metadata.json (~1 KB)

Fetched when the user selects a model from the dropdown. Contains everything needed to identify the model and query precomputed events, without downloading the large weights file.

```json
{
  "id": "compact-v1",
  "architecture": "compact",
  "class_names": ["Noise", "Earthquake"],
  "sampling_rate": 100,
  "window_duration": 60,
  "instrument_types": ["H", "L"],
  "weightsUrl": "./weights.json"
}
```

Field descriptions:
- **id**: Stable identifier used in the event database path (`services/seismic/stations/{station}/channels/{channel}/models/{model}/...`). Bumped when the model is retrained (e.g., `compact-v2`), so old events remain valid.
- **architecture**: Maps to a build function in CLUE (see [Architecture Registry](#architecture-registry)).
- **class_names**: Human-readable names for each class, in output order. The model outputs one probability per class index, and this array provides the index-to-name mapping (e.g., index 0 → `"Noise"`, index 1 → `"Earthquake"`). The entry `"Noise"` is special: it represents the absence of a detected event and is excluded when creating `SeismicEvent` records (see [Confidence threshold](#confidence-threshold)). The number of output classes is `class_names.length`.
- **sampling_rate**: Sample rate the model expects (Hz). Input data at a different rate must be resampled.
- **window_duration**: Length of each classification window (seconds). Combined with `sampling_rate`, determines the expected input size (e.g., 100 Hz × 60s = 6000 samples).
- **instrument_types**: Compatible SEED instrument codes (second character of the channel code). `H` = high-gain seismometer, `L` = low-gain seismometer — both velocity instruments. The Wave Runner tile should filter the channel dropdown to only show compatible channels, or warn if the selected channel is incompatible.
- **weightsUrl**: Relative URL to the weights file, resolved relative to the directory containing `metadata.json`. Only fetched when the user clicks "Run Model."

### weights.json (1–3 MB)

The model weight arrays, keyed by layer name. Only fetched when the model needs to run. This is the same format already used in the tiny-cnn-seismicML explainer app:

```json
{
  "conv1/kernel": [...],
  "conv1/bias": [...],
  "bn1/gamma": [...],
  "bn1/beta": [...],
  "bn1/moving_mean": [...],
  "bn1/moving_variance": [...],
  ...
}
```

## Model Registry

### App config

A default list of models is defined in the app configuration. Each entry provides the label (for the dropdown) and the metadata URL:

```json
{
  "models": [
    { "label": "Compact Model", "metadataUrl": "https://models.concord.org/seismic/compact-v1/metadata.json" },
    { "label": "Standard Model", "metadataUrl": "https://models.concord.org/seismic/standard-v1/metadata.json" }
  ]
}
```

### Unit JSON override

A curriculum unit can override the default model list to show only the models appropriate for that lesson, with curriculum-appropriate labels:

```json
{
  "models": [
    { "label": "Earthquake Detector", "metadataUrl": "https://models.concord.org/seismic/compact-v1/metadata.json" }
  ]
}
```

### Architecture registry

Model architectures (the TF.js layer definitions) must live in code because each architecture is a distinct programmatic construction. The architecture registry lives in `shared/seismic/seismic-architectures.ts` alongside the runner, so it's available in both browser and Node environments:

```typescript
const ARCHITECTURES: Record<string, (metadata: ModelMetadata) => tf.LayersModel> = {
  compact: buildCompactModel,
  standard: buildStandardModel,
};
```

The `buildCompactModel` and `buildStandardModel` functions are adapted from the tiny-cnn-seismicML repo's `seismicModel.js`. Adding a genuinely new architecture requires adding its build function here and registering it in this map. If a `metadata.json` references an architecture not in the registry, the model is unavailable and the UI shows an error.

## Runner Architecture

### Location

`shared/seismic/seismic-model-runner.ts` — alongside the raw data fetcher and other shared seismic utilities.

The runner lives in `shared/seismic/` rather than in the Wave Runner plugin because it needs to run in both environments:

- **Browser**: The Wave Runner tile's orchestration loop calls the runner, maps detected events into a SharedDataSet for the UI.
- **Node.js scripts**: A server-side script calls the same runner, maps detected events into Firestore writes to prepopulate the event database.

The runner itself has no knowledge of SharedDataSet, Firestore, or any output destination. It accepts a Seismogram and produces SeismicEvent objects via callbacks and return value. The caller decides what to do with the events.

### Design choice: mini-batch loop with `tf.nextFrame()` yields

The runner processes windows in mini-batches (~50 windows at a time). In the browser, `await tf.nextFrame()` between batches keeps the UI responsive. In Node.js, `tf.nextFrame()` resolves immediately (via `setImmediate`), so batching still works but without the browser-specific frame scheduling. This approach was chosen over:

- **Sequential single-window processing**: 3–4× slower than batched on GPU (confirmed by benchmarks in the tiny-cnn-seismicML repo).
- **Web Worker**: WebGPU in workers has inconsistent browser support. For the primary target (Chromebooks with WebGPU), inference is already sub-second — the UI thread is barely blocked. Adds significant complexity for minimal benefit.

### Streaming chunk-at-a-time model

A year of data at 200 Hz is ~7.3 GB raw, ~14 GB in memory via seisplotjs — far beyond what a Chromebook can hold. The runner processes one chunk of data at a time, releasing each chunk before the next is loaded.

The runner stays loaded (model weights in GPU memory) across chunks. Processing must be sequential — TF.js holds GPU state that isn't safe to use concurrently. Download parallelism is entirely the caller's concern.

### Runner interface

```typescript
// SeismicEvent is defined in event-database-design.md

interface ModelRunnerCallbacks {
  onProgress: (windowsProcessed: number, windowsTotal: number) => void;
  onEvents: (events: SeismicEvent[]) => void;
}

class SeismicModelRunner {
  /** Load model weights and build the TF.js model. */
  async loadModel(metadata: ModelMetadata): Promise<void>;

  /**
   * Process one chunk of seismic data.
   * The runner reads sampleRate and startTime from the Seismogram.
   * Resampling (e.g., 200 Hz → 100 Hz) is handled internally.
   * Windows that overlap gaps between seismogram segments are skipped.
   */
  async processChunk(
    seismogram: Seismogram,
    callbacks: ModelRunnerCallbacks
  ): Promise<SeismicEvent[]>;

  /** Dispose the TF.js model and free GPU memory. */
  dispose(): void;
}
```

The runner accepts a seisplotjs `Seismogram` directly. This avoids requiring the caller to extract and flatten sample data — the runner reads `sampleRate`, `startTime`, and segment data from the Seismogram object.

### Input preprocessing

For each chunk, the runner:
1. **Resamples** from the source sample rate to the model's expected rate if they differ. Two strategies depending on the ratio:
   - **Integer decimation** for exact integer ratios (e.g., 200 Hz → 100 Hz): keeps every Nth sample. Fast O(n) path for the common HHZ downsampling case.
   - **Linear interpolation** for other ratios (e.g., 50 Hz → 100 Hz for BHZ channels): interpolates between adjacent samples to produce the target number of samples. The training pipeline uses FFT-based resampling (`scipy.signal.resample`), but for bandlimited seismic data the difference is negligible — the per-window normalization (step 3) dominates any interpolation artifacts.
2. **Windows** the data into non-overlapping segments of `windowDuration × samplingRate` samples. Windows that straddle a gap between seismogram segments are skipped — a gap means we don't know what happened, and classifying partial data would be misleading.
3. **Preprocesses** each window: detrend (subtract mean) and scale to unit variance.
4. **Batches** ~50 windows into a single tensor for batched inference.

### Units

The model was trained on raw miniSEED counts (no instrument response removal). The preprocessing normalizes to zero mean and unit variance, which makes the absolute scale irrelevant — counts and physical units produce identical tensors after normalization. No unit conversion is needed.

What does matter is the **instrument type**: the models were trained on velocity seismometer data (EHZ, BHZ channels). Feeding accelerometer data into a velocity-trained model would produce bad classifications because the waveform shapes are fundamentally different. The `instrument_types` field in the model metadata specifies compatible instruments.

**Preprocessing mismatch note**: The training pipeline applies a bandpass filter (1–45 Hz) that the current browser inference code omits. This is an ML-side concern to resolve in the tiny-cnn-seismicML repo, not a CLUE integration issue.

### Resampling validation

The linear interpolation used for upsampling (e.g., 50 Hz BHZ → 100 Hz) differs from the FFT-based `scipy.signal.resample` used in training. This needs validation to confirm it doesn't affect classification accuracy. The quickest test is within the Python pipeline: resample the same BHZ waveform with both `scipy.signal.resample` and `numpy.interp` (linear), run both through the PyTorch model (`trained_models/best_model.pth`), and compare the output probabilities. If the results diverge significantly, the CLUE runner would need FFT-based resampling. A cross-framework test (Python pipeline vs CLUE runner on the same waveform) would additionally catch any PyTorch-vs-TF.js floating-point differences, but isolating one variable at a time is more informative.

### Confidence threshold

The model outputs a probability for each class. The runner iterates over the output indices, skipping any class whose name is `"Noise"` (matched by string). For each remaining class that exceeds a confidence threshold (initially 0.5), the runner produces a `SeismicEvent` with `eventType` set to the class name. For a 2-class model (Noise/Earthquake), each window yields at most one event. For a multi-class model (Noise/Traffic/Earthquake), a single window could produce both a Traffic event and an Earthquake event if both exceed the threshold. The threshold could later become a user-facing control if students need to explore how it affects detection counts.

## Orchestration

The orchestration loop lives in the caller, not the runner. The runner is a stateless processing engine — it takes a Seismogram and produces events. The caller is responsible for downloading data, feeding chunks, and deciding what to do with events:

- **Wave Runner tile (browser)**: Downloads data via `fetchRawSeismicData`, feeds chunks to the runner, maps events into a SharedDataSet.
- **Server-side script (Node.js)**: Downloads data the same way, feeds chunks to the same runner, writes events to Firestore.

The rest of this section describes the Wave Runner tile's orchestration as the primary use case.

### Chunk size

The caller determines how much data to request per download. Recommended default: **1 day** (~20 MB download, ~40 MB in memory). This is comfortable on any Chromebook and means 365 round trips for a year of data.

### Orchestration loop

```
determine uncovered time ranges for station + channel + model (from coverage bitmaps — see event-database-design.md)
load model weights (once)
for each chunk of the uncovered ranges:
    download chunk from proxy (station + channel + time range) → Seismogram
    events = await runner.processChunk(seismogram, callbacks)
    add events to working SharedDataSet (orchestration layer sets source="local")
    // Future: compute and upload envelope tiles from this same seismogram
    // before releasing it (see envelope-tile-cache-design.md)
    // seismogram goes out of scope, GC reclaims memory
report completion
```

### Download parallelism

On fast machines with sufficient memory, the downloader can have multiple requests in flight (up to 5, matching EarthScope's per-IP connection limit). Completed chunks are queued and fed to the runner sequentially. The runner doesn't need to know about download concurrency — it processes whatever Seismogram it's handed, one at a time.

### Progress reporting

Two levels of progress:

1. **Chunk level** (from the orchestration layer): "Processing day 5 of 365. 127 events found so far." This is the primary progress indicator for students.
2. **Window level** (from the runner's `onProgress` callback): mini-batch progress within a chunk. Mainly visible on the CPU path where a single day's chunk could take ~2 minutes.

Estimated time: the orchestration layer times the first chunk (download + processing) and extrapolates. The estimate improves as more chunks complete.

## Event Storage and SharedDataSet Flow

### Volatile event storage

Detected events are stored as volatile state on the Wave Runner content model (`detectedEvents: SeismicEvent[]`). This array is populated incrementally as the runner processes chunks, and is cleared when a new model run starts. The Wave Runner UI (event counts in "Status and Output") reads directly from this volatile state.

No SharedDataSet is created during model execution — events live only in volatile memory until the user explicitly clicks "Timeline It!".

### SharedDataSet creation on "Timeline It!"

When the user clicks "Timeline It!", the Wave Runner creates a SharedDataSet from the current `detectedEvents`, creates a new Timeline tile, and links the SharedDataSet to it. The Wave Runner keeps a reference to the SharedDataSet it created so that pressing "Timeline It!" again (without re-running the model) reuses the same SharedDataSet rather than creating a duplicate.

When the user clicks "Run Model" again, the cached SharedDataSet reference is cleared. The next "Timeline It!" click will create a fresh SharedDataSet from the new results.

### SharedDataSet schema

Each row in the dataset is a detected event:

| Column | Type | Description |
|--------|------|-------------|
| `windowStart` | number | Epoch ms |
| `windowEnd` | number | Epoch ms |
| `eventType` | string | "Earthquake", "Traffic", etc. |
| `confidence` | number | 0–1 |

### Flow: "Run Model"

```
User clicks "Run Model"
  → clear detectedEvents and cached SharedDataSet reference
  → for each chunk:
      download data → runner.processChunk()
      → onEvents callback appends to volatile detectedEvents
      → Wave Runner UI updates event count
  → run completes
  → Wave Runner shows "Run complete. X events found."
User clicks "Timeline It!"
  → create SharedDataSet from detectedEvents (or reuse cached reference)
  → create a new Timeline tile observing the SharedDataSet
User clicks "Timeline It!" again (without re-running)
  → reuse the same SharedDataSet
  → create another Timeline tile observing it
User clicks "Run Model" again
  → cached SharedDataSet reference is cleared
  → new run produces new detectedEvents
```

### Future: Combining loaded and precomputed events

When Firestore event loading is implemented ("Load Data"), loaded events will also be stored in `detectedEvents`. The coverage bitmaps (see [event-database-design.md](event-database-design.md)) will prevent duplication — the runner only processes uncovered time ranges. The `source` column (tracking local vs remote events for upload purposes) will be added to the schema at that point.

## Out of Scope

The following are related concerns designed elsewhere:

- **Firestore event upload**: Writing detected events to Firestore and updating coverage bitmaps. See [event-database-design.md](event-database-design.md).
- **Envelope tile upload**: The "Run Model" flow in [seismic-tiles-plan.md](seismic-tiles-plan.md) mentions uploading tiled envelope data alongside events. The envelope upload pipeline is designed in [envelope-tile-cache-design.md](envelope-tile-cache-design.md) and is a separate integration point from the ML model runner.
