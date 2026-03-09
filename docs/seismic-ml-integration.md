# Seismic ML Integration

## Tile Architecture

Two tiles work together to provide seismic data exploration with ML-based event detection.

**Wave Runner tile** (in progress — Teale): Handles data selection and ML model execution. The user picks a seismic station, model, and time range. The tile downloads seismic data, runs the selected ML model in the browser, and shows a preview of the waveform and model status. Toolbar actions: Load Data, Run/Restart/Reset Model, Timeline It.

**Timeline tile** (planned): Displays seismic waveform data with interactive controls for exploring the time series. Also shows events identified and labeled by the ML model. This is the primary visualization and exploration surface for students.

**Shared models** connect the two tiles:
- **SharedDataSet** (existing): Stores the events detected by the ML model so the Timeline tile can display them.
- **New seismic data shared model** (planned): Manages seismic waveform data — downloading from a data provider, caching, and providing envelope summaries for efficient rendering. This will likely be a domain-specific shared model, since the data management concerns (streaming time-series, envelope computation, caching) are specialized. The exact data source is still being determined (see unknowns below).

## Unknowns: ML Model in the Browser

### Model performance across data sizes

We don't know how long the ML model takes to run over different sizes of seismic data. Runtime will vary by model type and by the user's hardware. We need:
- Rough benchmarks for representative data sizes (e.g., 1 hour, 6 hours, 24 hours of data).
- A systematic way to collect and report performance metrics for each model we might use, so we can compare models and set user expectations (the Wave Runner tile has an "estimated time to complete" display).

### Target hardware

We believe the target is Chromebooks, but this needs confirmation. Chromebook performance will be significantly different from development machines, so benchmarking on target hardware is essential for realistic estimates.

### Integration approach

The ML model code lives in the `tiny-cnn-seismicML` repository, which has a browser demo using TensorFlow.js (`browser_demo/`). The plan is to get the model running well in that repo first, then bring the code into CLUE. Open questions:
- What is the right way to package the model for use in CLUE? (e.g., load model weights from a URL, bundle them, or fetch from a CDN)
- How do we handle multiple model options? The Wave Runner tile has a "Choose a model" dropdown.
- What is the interface between the model code and the Wave Runner tile? (input format, output format, progress reporting)

## Unknowns: Seismic Data Management

### Data source

The data source for seismic waveforms is not yet decided. Two main options:
- **Raspberry Shake**: Students would work with data from local Raspberry Shake devices, giving them a connection to seismic activity in their own area. However, there are concerns about download rate limitations and the difficulty of accessing a Raspberry Shake device on a school network from the browser.
- **EarthScope (formerly IRIS)**: A well-established FDSN-compatible data provider with broad station coverage. More reliable for classroom use but loses the "local device" connection.

The choice affects the fetching approach, authentication requirements, and possibly the data format. We may need to support both eventually, but should pick one to target for the initial demo.

### Fetching data

However we source the data, it is not yet decided whether the browser will fetch directly from the provider's endpoints or whether a proxy (e.g., a Cloud Function) is needed. Considerations:
- CORS: Do the data provider's services allow cross-origin requests from browsers?
- Rate limiting and authentication requirements.
- Data size — large time ranges may produce responses too large for a single fetch.

### Seismic data shared model design

The seismic data shared model is a critical integration point — it is the contract between the Wave Runner tile, the Timeline tile, and the data fetching layer. Locking down this design early enables parallel work. Key design questions:
- What API does the shared model expose to tiles? (e.g., "give me samples for time range X at resolution Y")
- How does it abstract over the data source so we can swap providers without changing tile code?
- Does it own the fetching logic, or does it delegate to a separate service?
- What state does it hold? (loaded segments, envelope cache, download progress, station/channel metadata)
- How does it handle the lifecycle of large data — when is data evicted from memory?

If we can define this interface confidently, Teale can code against a mock implementation while the actual data pipeline is being built.

### miniSEED format and in-memory representation

FDSN data is served in miniSEED format. Unknowns:
- What JavaScript libraries exist for parsing miniSEED in the browser?
- Is miniSEED already efficiently compressed (like an audio format), or is the raw sample data stored at full precision?
- How much memory does a typical data range consume once parsed? For example, how large is 24 hours of data from one station at typical sample rates?

### Envelope summaries for compact storage

It is likely that we cannot hold the full time range of high-resolution data in memory at once. The planned approach is to maintain a compact "view" of the data — an envelope that stores summary statistics (e.g., min and max amplitude per 10-second window). This allows rendering an overview without loading all samples. Open questions:
- What is an efficient format for storing envelope data? Are there existing standards or libraries for this?
- What window sizes make sense for different zoom levels?
- Can envelopes be computed server-side to avoid downloading full data just to summarize it?

### Compression of full-resolution data

If miniSEED is not already highly compressed, we should explore options for reducing data size:
- Lossless compression of sample data (e.g., integer delta encoding, which miniSEED may already use).
- Lossy compression analogous to audio codecs (e.g., MP3-like approaches) to dramatically reduce size when full precision isn't needed for visualization.
- Trade-offs between compression ratio, decode speed in the browser, and acceptable precision loss for different use cases (visualization vs. model input).

### Dynamic fetching for zoom

With an envelope-based overview, the system needs to fetch full-resolution data on demand when the user zooms into a specific time range. This involves:
- Deciding the boundary between "use envelope" and "fetch full data."
- Caching strategy for previously fetched full-resolution segments.
- How this interacts with the FDSN shared model — does it manage a tile cache of fetched segments?

## Priority Order for Resolving Unknowns

Steps are grouped into two parallel tracks so Scott and Teale can work simultaneously.

### Scott's track: ML model feasibility

1. **Target hardware** — Confirm whether we are targeting Chromebooks. Quick to resolve and necessary context for all performance-related work.
2. **ML model browser feasibility and benchmarking** — Get the existing TensorFlow.js demo running on target hardware with representative data sizes. Establish a benchmarking setup that can be reused as Derek iterates on models.
3. **Model integration approach** — Define the interface between the ML model code and the Wave Runner tile (input/output formats, progress reporting, model packaging).

### Teale's track: seismic data pipeline

These items can proceed in parallel with Scott's ML work. The goal is to get real seismic data flowing into the tile UI.

4. **Data source decision** — Clarify whether we are targeting Raspberry Shake, EarthScope, or both. This determines the fetching approach and any authentication requirements. Teale should:
   - Document what APIs each provider offers and their browser compatibility (CORS, rate limits).
   - Identify which provider is most practical for the initial demo.
   - Flag any showstoppers (e.g., school network restrictions for Raspberry Shake).

5. **miniSEED format and in-memory representation** — Teale has already found seisplotjs for parsing miniSEED. Remaining work:
   - Build a small proof-of-concept that fetches and parses real data from the chosen provider.
   - Measure memory usage for representative time ranges (1 hour, 6 hours, 24 hours) to inform size constraints.
   - Determine whether miniSEED is already compressed or if raw samples are at full precision.

6. **Seismic data shared model design** — Scott and Teale pair on this. This is the critical integration point — the contract between the Wave Runner tile, the Timeline tile, and the data fetching layer. Scott's understanding of the ML pipeline and data lifecycle will help anticipate what the shared model needs to support. Plan for a couple pairing sessions to work out:
   - The shared model API: what methods/views does it expose? (e.g., samples for a time range, envelope data, station metadata, download progress)
   - How it abstracts over the data source so provider can be swapped later.
   - What state it holds and when data is evicted from memory.
   - Once the interface is agreed upon, Teale implements against a mock so tile UI work can continue without a complete data pipeline.

7. **Fetching data from the provider** — Wire up the actual data fetching. Teale should:
   - Test browser-direct fetching from the chosen provider.
   - If CORS or other issues prevent direct access, prototype a Cloud Function proxy.
   - Integrate fetching into the shared model implementation, replacing the mock.

### Deferred (not needed for initial demo)

8. **Envelope summaries for compact storage** — Design the compact view representation. For the demo, limiting to shorter time ranges may be sufficient.
9. **Compression of full-resolution data** — Explore only if miniSEED is not already compact enough. Optimization work that can wait.
10. **Dynamic fetching for zoom** — Depends on the envelope design. Not needed for an initial demo.

## Rationale

Three constraints drive this ordering:

**Derek needs early feedback on browser feasibility.** The biggest risk in this project is that running ML models in the browser is too slow on target hardware. If that turns out to be the case, we either need Derek to produce smaller/faster models or we need to reconsider the browser-only architecture. The sooner we have benchmarks on real hardware, the sooner Derek can adjust. This is why target hardware confirmation (#1) and ML benchmarking (#2) come first — they are the highest-risk items and Derek's work depends on the answers.

**Teale should not wait on ML work.** Teale has the tile shell built but all the buttons are no-ops. If he waited for the ML track to complete before starting on data, he'd be blocked. Instead, he can work the data pipeline track (#4–#7) in parallel. The shared model design (#6) is especially important — once that interface is agreed upon, Teale can mock it and continue building tile functionality even before fetching is fully wired up.

**Demo in ~1 month means deferring optimization.** Envelope summaries (#8), compression (#9), and dynamic zoom fetching (#10) are important for the full product but not for an initial teacher demo. For the demo, we can constrain the time range to something that fits in memory and skip the multi-resolution view. This lets us show a working end-to-end flow (select station, load data, run model, see events) without solving every data management problem first.

A secondary principle: **pushing computation into the browser is a core goal.** We strongly prefer browser-only execution to avoid maintaining server infrastructure. This keeps published materials cheap to run long-term. The ML feasibility question (#2) is therefore not just a technical question — it determines whether the project's cost model works.
