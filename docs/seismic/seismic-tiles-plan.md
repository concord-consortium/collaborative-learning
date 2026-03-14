# Seismic Tiles Plan

## Related Documents

- [Browser-Based Seismic Data Downloader](browser-seismic-downloader.md) — Design for fetching seismic data directly in the browser
- [Envelope Tile Cache Design](envelope-tile-cache-design.md) — Tile levels, storage format, and cost estimates for envelope summaries
- [Seismic Data Services](data-services.md) — Comparison of EarthScope and Raspberry Shake APIs, file sizes, and rate limits
- [Seismic ML Infrastructure Cost Estimates](seismic-cost-estimates.md) — Cost analysis for different infrastructure options

## Tile Architecture

Two tiles work together to provide seismic data exploration with ML-based event detection.

**Wave Runner tile** (in progress — Teale): Handles data selection and event display. The user picks a seismic station, model, and time range. The tile's preview updates immediately as the user changes filters, but the shared models (and therefore the Timeline tile) are only updated when the user explicitly clicks "Load Data." The tile can be configured in two modes:
- **Database only**: The "Load Data" toolbar button is enabled and the "Run Model" button is disabled. Clicking "Load Data" fetches events from the database (uploaded by other users who previously ran the ML model for that station, model, and time range) and updates the shared models.
- **ML model running**: Both the "Load Data" and "Run Model" buttons are enabled. Clicking "Load Data" fetches whatever events are already in the database. Clicking "Run Model" fills in gaps — it downloads the seismic data, runs the selected ML model in the browser, uploads the detected events, and uploads tiled envelope data so the data can be explored visually efficiently.

  **Open question:** When the ML model runs and produces new events, how should the shared models be updated? Options include updating them in place as the model runs, or requiring an explicit user action to push the new results to the shared models. To be resolved.

**Timeline tile** (in progress — Teale): Displays seismic waveform data with interactive controls for exploring the time series. Also shows events identified and labeled by the ML model. This is the primary visualization and exploration surface for students.

**Shared models** connect the two tiles:
- **SharedDataSet** (existing): Stores the events detected by the ML model so the Timeline tile can display them.
- **New seismic data shared model** (planned): Manages seismic waveform data — downloading from EarthScope, caching, and providing envelope summaries for efficient rendering. This will likely be a domain-specific shared model, since the data management concerns (streaming time-series, envelope computation, caching) are specialized.

## Unknowns: ML Model in the Browser

### Model performance across data sizes

We have a benchmark that runs two TensorFlow.js models (a compact model and a standard model) against fake data in 60-second windows. It supports sizes of 1 hour, 24 hours, 7 days, and 30 days, and uploads results to a Google Spreadsheet.

Key findings so far:
- **Input data does not affect performance** — the model runs at the same speed regardless of what the data contains.
- **Hardware matters significantly** — 24 hours of data ranges from ~0.5s to ~10s depending on the device.
- **WebGL and WebGPU make a big difference** — Chromebooks support both, and using them substantially improves performance.

Running the ML model in the browser is strongly preferred to avoid server-side infrastructure costs. The model itself runs fast enough — even a week of data completes quickly on a Chromebook. However, the bottleneck is raw data download size, not model execution. At 200 Hz, a single station channel produces ~20MB/day, so a week is ~140MB. On a school network this is likely too slow for a single student, and having an entire class download that much data simultaneously would strain both the school network and the data service. This means running the model in the browser is only practical for shorter time ranges (likely up to ~24 hours), and longer ranges will need the model to be run elsewhere with results uploaded to the database.

### Target hardware

Chromebooks are confirmed as the target hardware. They support WebGL and WebGPU, which are critical for acceptable model performance.

### Integration approach

The ML model code lives in the `tiny-cnn-seismicML` repository, which has a browser demo using TensorFlow.js (`browser_demo/`). The plan is to get the model running well in that repo first, then bring the code into CLUE. Open questions:
- What is the right way to package the model for use in CLUE? (e.g., load model weights from a URL, bundle them, or fetch from a CDN)
- How do we handle multiple model options? The Wave Runner tile has a "Choose a model" dropdown.
- What is the interface between the model code and the Wave Runner tile? (input format, output format, progress reporting)

## Unknowns: Seismic Data Management

### Data source

We will use **EarthScope (formerly IRIS)** as the data source. Raspberry Shake was considered for its local-device appeal, but has two significant issues: they do not allow redistribution of raw data, and their rate limits on data downloading are low enough that classroom use would quickly hit restrictions. See [data-services.md](data-services.md) for detailed notes on each service.

### Fetching data

Neither EarthScope nor Raspberry Shake support CORS, so browser-direct fetching is not possible. A proxy is required. See [browser-seismic-downloader.md](browser-seismic-downloader.md) for the proxy design. Additional considerations:
- Rate limiting and authentication requirements.
- Data size — large time ranges may produce responses too large for a single fetch.

**Open question: proxy and EarthScope rate limits.** EarthScope limits clients to 5 concurrent connections per IP. If we use a CloudFront proxy, all requests from a classroom (or potentially all users) would appear to come from the same CloudFront edge IP(s). Since students are likely exploring different stations and time ranges, cache hits won't help much — most requests will be cache misses that reach EarthScope. This means a class of students could easily exceed the 5 concurrent connection limit. Possible mitigations:
- **Request queuing** in the proxy to serialize outbound requests and stay under limits.
- **A Cloud Function proxy** instead of or in addition to CloudFront — each invocation gets its own IP, naturally spreading the load.
- **Pre-warming the cache** — a teacher fetches data for the lesson's stations/time ranges before class.

### Seismic data shared model design

The seismic data shared model is a critical integration point — it is the contract between the Wave Runner tile, the Timeline tile, and the data fetching layer. The current implementation is intentionally simple and will need to be expanded. Key design questions:
- What API does the shared model expose to tiles? (e.g., "give me samples for time range X at resolution Y")
- How does it abstract over the data source so we can swap providers without changing tile code?
- Does it own the fetching logic, or does it delegate to a separate service?
- What state does it hold? (loaded segments, envelope cache, download progress, station/channel metadata)
- How does it handle the lifecycle of large data — when is data evicted from memory?
- How does it interact with the multi-level tile cache described in [envelope-tile-cache-design.md](envelope-tile-cache-design.md)? Does the shared model manage the tile cache, or are they separate systems?

If we can define this interface confidently, Teale can code against a mock implementation while the actual data pipeline is being built.

### miniSEED format and in-memory representation

FDSN data is served in miniSEED format. What we know so far:
- **Library**: [seisplotjs](https://github.com/crotwell/seisplotjs) can parse miniSEED in the browser.
- **Compression**: miniSEED supports multiple compression formats. The data from both Raspberry Shake and EarthScope uses Steim2, the most efficient lossless compression approach available in the format.
- **Memory usage**: seisplotjs uses roughly double the raw file size when data is parsed into memory. For 24 hours of 200 Hz data (~20 MB on disk), this means ~40 MB in memory. This estimate comes from summing `seg.y.byteLength` across seismogram segments, which measures the decoded sample arrays. The actual total memory footprint may be higher due to additional object overhead (segment metadata, seisplotjs internal structures, etc.).


Remaining unknowns:
- Exact memory overhead at larger time ranges and whether this becomes a problem on Chromebooks.

### Envelope summaries for compact storage

The full time range of high-resolution data cannot be held in memory at once. The planned approach is a multi-level tile cache that stores summary statistics (min/max amplitude) at progressively coarser resolutions. This allows rendering an overview of long time ranges without loading all samples, and fetching full-resolution data only when the user zooms in. See [envelope-tile-cache-design.md](envelope-tile-cache-design.md) for the detailed design including tile levels, storage format, and cost estimates.

### Compression of full-resolution data

miniSEED already uses Steim2 lossless compression, so there is limited room for further lossless compression. If data size is still a problem, options include:
- Lossy compression analogous to audio codecs (e.g., MP3-like approaches) to dramatically reduce size when full precision isn't needed for visualization.
- Trade-offs between compression ratio, decode speed in the browser, and acceptable precision loss for different use cases (visualization vs. model input).

## Priority Order for Resolving Unknowns

Steps are grouped into two parallel tracks so Scott and Teale can work simultaneously.

### Scott's track: ML model feasibility

1. ~~**Target hardware**~~ ✅ — Confirmed: Chromebooks, which support WebGL and WebGPU.
2. **ML model browser feasibility and benchmarking** (almost done) — A benchmark running two TensorFlow.js models (compact and standard) against representative data sizes has been built. Results are uploaded to a Google Spreadsheet. Key finding: the model runs fast enough even for a week of data on a Chromebook, but the bottleneck is raw data download size, not model execution. See the [Model performance](#model-performance-across-data-sizes) section.
3. **Model integration approach** — Define the interface between the ML model code and the Wave Runner tile (input/output formats, progress reporting, model packaging).

### Teale's track: UI validation and data pipeline

These items can proceed in parallel with Scott's ML work.

4. ~~**Graph visualization at different time scales**~~ ✅ — Teale generated screenshots of graphs at 24 hours, 1 month, and 1 year of data. Confirmed that a summarized view is needed for longer time ranges.

5. **Thin slice through the tiles** (almost done) — Building a minimal end-to-end path through both tiles to validate the UI design.

6. ~~**Data source decision**~~ ✅ — EarthScope chosen. Raspberry Shake ruled out due to redistribution restrictions and low rate limits. See [data-services.md](data-services.md).

7. **miniSEED format and in-memory representation** — Teale did the investigation work but the results need to be located and added to these documents. What we know so far is captured in the [miniSEED section](#miniseed-format-and-in-memory-representation) above.

8. **Seismic data shared model design** — The current shared model is intentionally simple. It will need to be expanded as Teale works on envelope summaries and dynamic fetching (#10, #11). Scott and Teale should pair on this as the requirements become clearer. Key design questions:
   - The shared model API: what methods/views does it expose? (e.g., samples for a time range, envelope data, station metadata, download progress)
   - How it abstracts over the data source so provider can be swapped later.
   - What state it holds and when data is evicted from memory.
   - How it interacts with the multi-level tile cache.

9. **Fetching data from the provider** — Wire up the actual data fetching through a proxy (neither EarthScope nor Raspberry Shake supports CORS). See the [proxy concurrency problem](#fetching-data) in the fetching data section.

### Up next

10. **Envelope summaries for compact storage** — Teale is planning to work on this next. See [envelope-tile-cache-design.md](envelope-tile-cache-design.md) for detailed analysis of tile levels, storage format, and cost estimates. This work will drive further design of the shared model (#8).

11. **Dynamic fetching for zoom** — Closely tied to the envelope design. Teale plans to work on this alongside #10.

### Deferred

12. **Event boundary detection and grouping** — The ML model classifies fixed-size windows of data. For the initial demo, we just report whether each window contains an event. Deferred work includes: detecting where within a window an event starts/ends, and grouping consecutive event-positive windows into a single event span.
13. **Compression of full-resolution data** — miniSEED already uses Steim2 lossless compression. Further compression only needed if data size remains a problem after envelope summaries reduce download requirements.

## Rationale

Three constraints drive this ordering:

**Derek needs early feedback on browser feasibility.** The biggest risk was that running ML models in the browser would be too slow on target hardware. Benchmarking has shown that model execution is fast enough — the real constraint is data download size on school networks. This means the architecture needs to minimize how much raw data students download, which is why envelope summaries (#10) have moved up in priority.

**Teale should not wait on ML work.** Teale has validated the UI design with graph screenshots (#4) and a thin slice (#5). With the data source decided (#6), he can now focus on the data pipeline — specifically envelope summaries and dynamic fetching (#10, #11), which will also drive the shared model design (#8).

**Summarized views are essential, not optional.** At ~20MB per day from EarthScope, downloading weeks or months of full-resolution data to the browser is impractical, both for individual students and for school networks. Envelope summaries are needed for the product to work at classroom scale, not just as an optimization.

**Pushing computation into the browser is a core goal.** We strongly prefer browser-only execution to avoid maintaining server infrastructure. This keeps published materials cheap to run long-term. The benchmarking confirmed this is feasible for model execution — the remaining challenge is managing data volume efficiently.
