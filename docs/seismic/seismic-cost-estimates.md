# Seismic ML Infrastructure Cost Estimates

## Variations

Two independent architectural choices create four combinations:

| | Client-side ML | AWS ML |
|---|---|---|
| **Without L3 cache** | A: Minimal infrastructure | B: Server ML only |
| **With L3 cache** | C: Cache only | D: Full server-side |

Three data scales:

| Scale | Stations | Years each | Station-years |
|---|---|---|---|
| Small | 5 | 1 | 5 |
| Medium | 10 | 10 | 100 |
| Large | 100 | 10 | 1,000 |

## Key data sizes (per station-year)

From the [envelope tile cache design](envelope-tile-cache-design.md):

| Data | Size (gzipped) | Object count |
|---|---|---|
| L0-L2 envelope tiles | ~3 MB | ~1,000 |
| L3 envelope tiles (~9hr tiles) | ~250 MB | ~977 |
| ML event output | ~0.1 MB (est.) | 1 |
| Raw seismic data (from provider) | ~7.3 GB | not stored |

L3 is 99% of the tile cache storage. With ~9-hour tiles, L3 object count is comparable to L0–L2.

## ML model processing time

The ML model's speed depends heavily on whether GPU acceleration is available:

| Environment | Time per day of data | Time per station-year | Speedup vs browser JS |
|---|---|---|---|
| CPU-only JavaScript (browser) | ~2 min | ~730 min (~12 hours) | 1x |
| CPU ONNX Runtime (est.) | ~2–12s | ~12–73 min | 10–50x |
| M2 MacBook WebGPU (browser) | ~0.5s | ~3 min | ~240x |
| AWS GPU (CUDA, e.g., g4dn T4) | ~0.5s (est.) | ~3 min (est.) | ~240x |

Running on CPU in the browser (JavaScript/WASM) is ~240x slower than GPU. Using a native CPU runtime like ONNX Runtime in Lambda could be 10–50x faster than browser JS (native SIMD, oneDNN optimizations, operator fusion), but this range is uncertain — a benchmark is needed.

An AWS T4 GPU should perform comparably to an M2 MacBook's WebGPU — likely similar or faster due to native CUDA vs WebGPU overhead.

## AWS compute options for ML processing

### CPU-only options (Lambda, Fargate)

Lambda and Fargate have **no GPU support**. Two CPU runtime options:

**Browser-equivalent JS/WASM (~2 min/day):**
- Lambda (15-min limit): can process ~7 days per invocation → 52 invocations per station-year
- Cost per station-year at 2 GB: **$1.46**
- 1,000 station-years: **$1,460** — expensive

**ONNX Runtime in Lambda container (~2–12s/day, estimated):**

ONNX Runtime uses native SIMD (AVX2), oneDNN, and graph-level optimizations (operator fusion, constant folding) that could be 10–50x faster than browser JS on the same CPU. This range is uncertain — it depends on the specific model's operations. A benchmark is needed.

| Scale | Conservative (12s/day, 4 GB) | Optimistic (2s/day, 4 GB) |
|---|---|---|
| 5 station-years | $1.46 | $0.29 |
| 100 station-years | $29 | $5.84 |
| 1,000 station-years | **$292** | **$58** |

Still more expensive than GPU at scale, but potentially viable for small deployments where avoiding GPU infrastructure complexity is worth the cost.

### GPU options

| Service | GPU | On-demand | Spot | Scales to zero | Startup time | Extra charge |
|---|---|---|---|---|---|---|
| **AWS Batch + EC2** | g4dn.xlarge (T4) | $0.526/hr | **$0.219/hr** | Yes (queue idles) | 6–7 min cold | None |
| **EC2 directly** | g4dn.xlarge (T4) | $0.526/hr | $0.219/hr | Yes (terminate) | 1–3 min | None |
| **SageMaker Processing** | ml.g4dn.xlarge | $0.736/hr | No spot | Yes (per job) | 3–8 min | ~40% markup |
| **Fargate** | — | — | — | — | — | No GPU support |
| **Lambda** | — | — | — | — | — | No GPU support |

The g4dn.xlarge (NVIDIA T4, 16 GB VRAM) is the cheapest AWS GPU instance at **$0.219/hr spot**. All options bill per-second with a 60-second minimum.

**Recommendation: AWS Batch with g4dn.xlarge spot instances.**

AWS Batch manages a job queue, launches GPU instances on demand, handles spot interruptions with automatic retries, and scales to zero when idle. No charge beyond the underlying EC2 spot price. You'd package the ML model as a Docker container with CUDA/TensorFlow or ONNX Runtime.

For batch processing, one instance processes many station-years sequentially — the 6–7 min cold start is amortized across the batch. For periodic daily updates, the startup cost dominates for small numbers of stations.

## Cost breakdown by component

### S3 storage (monthly)

| Scale | Without L3 | With L3 |
|---|---|---|
| 5 station-years | $0.0003 | $0.03 |
| 100 station-years | $0.007 | $0.58 |
| 1,000 station-years | $0.07 | **$5.82** |

Rate: $0.023/GB/month.

### S3 PUT requests (one-time, for tile generation)

| Scale | Without L3 | With L3 (~5 min tiles) | With L3 (~9 hour tiles) |
|---|---|---|---|
| 5 station-years | $0.02 | $2.47 | $0.05 |
| 100 station-years | $0.49 | $49 | $1.00 |
| 1,000 station-years | $4.94 | **$494** | $9.88 |

Rate: $0.005 per 1,000 PUT requests. With small L3 tiles (~5 min, 1024 points), the ~97,700 tiles per station-year make PUT costs expensive at scale. **Using larger L3 tiles reduces PUT costs dramatically.** See [L3 tile duration options](#l3-tile-duration-options) below for details.

#### L3 tile duration options

L3 has ~100 million envelope points per station-year. The tile duration determines the trade-off between S3 PUT costs (fewer larger tiles = cheaper), fetch size for slow networks (smaller tiles = faster initial load), and conflict window for concurrent writers (smaller tiles = fewer conflicts, see [envelope tile cache design](envelope-tile-cache-design.md#concurrent-writes-and-conflict-handling)).

| L3 tile duration | Points per tile | Tile size (gzipped Int16) | Tiles per station-year | PUTs at 1,000 station-years | PUT cost |
|---|---|---|---|---|---|
| ~5.4 min (1,024 pts) | 1,024 | ~2 KB | 97,700 | 97.7M | **$489** |
| 1 hour (~11,400 pts) | ~11,400 | ~22 KB | ~8,770 | 8.77M | $44 |
| ~9 hours (~100K pts) | ~100,000 | ~200 KB | ~977 | 977K | $4.89 |
| 1 day (~274K pts) | ~274,000 | ~540 KB | 365 | 365K | **$1.83** |

A duration in the **1–9 hour range** is recommended, balancing cost, fetch size, and concurrency. The rest of this document uses ~9-hour tiles (~977 tiles per station-year) for cost estimates.

**How the client uses L3 tiles:**

1. User zooms into L3 range (viewing ~5–50 minutes of data).
2. Client determines which tile(s) the viewport spans.
3. Client fetches the tile(s) — typically 1, occasionally 2 at a tile boundary.
4. Client decompresses (~200 KB → ~400 KB) and indexes directly into the point array.
5. The decompressed tile is cached in memory. Subsequent panning within the same tile requires no additional fetches.

**Updating tiles:** When new data arrives, only tiles covering the affected time range need to be re-uploaded using conditional writes (`If-Match` ETag). Previous tiles for completed time ranges are immutable.

### CloudFront serving (monthly)

Assuming moderate classroom usage: 100 active students, each viewing ~5 stations across 2-3 zoom levels, 2 sessions/month.

| | Without L3 | With L3 |
|---|---|---|
| Tile fetches/month | ~40,000 | ~120,000 |
| Data transferred | ~80 MB | ~240 MB |
| Request cost | $0.04 | $0.12 |
| Data transfer cost | $0.007 | $0.02 |
| **Total/month** | **~$0.05** | **~$0.14** |

**CloudFront free tier covers tile serving entirely**: 1 TB/month data transfer + 10M requests/month (always free, not just first 12 months). Even 50x the above tile usage stays within the free tier.

Note: S3-to-CloudFront data transfer is free.

#### CloudFront as CORS proxy for EarthScope data

EarthScope's data server does not support CORS, so browser-based access to raw seismic data requires proxying through CloudFront. This applies in two situations:

**1. Client-side ML processing (one-time per station-year):** One student processes the raw data for a station-year and uploads the ML results to S3 for other students to access. Each station-year is ~7.3 GB of raw data.

| Station-years processed | Data through proxy | CloudFront cost |
|---|---|---|
| 5 | 36.5 GB | free tier |
| 100 | 730 GB | free tier |
| 1,000 | 7.3 TB | **~$536** |

This is a one-time cost, not monthly. CloudFront caching helps if multiple students attempt to process the same station — the data is served from edge cache rather than re-fetching from EarthScope.

Download time for 7.3 GB (one station-year) depends on the student's effective bandwidth:

| Effective bandwidth | Time for 7.3 GB |
|---|---|
| 1 Mbps | ~16 hours |
| 5 Mbps | ~3.2 hours |
| 10 Mbps | ~1.6 hours |
| 25 Mbps | ~39 min |
| 50 Mbps | ~19 min |

On shared school networks, per-student throughput may be well below the school's total bandwidth.

**2. Exploration at raw zoom level:** When students zoom past the finest cached level (L3 or L2 depending on configuration), the client fetches raw 200 Hz data for the visible time range. Raw data is ~1.4 MB per hour of seismic data, so a student viewing a few minutes at raw zoom downloads only a few hundred KB. Even heavy exploration by 100 students would likely stay well within the free tier.

Rate: first 1 TB/month free, then $0.085/GB.

This proxy is needed for all four scenarios (A–D) for raw-zoom exploration, but the ML processing cost only applies to client-side ML (A and C). With server-side ML (B and D), the ML model runs on AWS infrastructure that can fetch from EarthScope directly without CloudFront.

### Compute for tile cache generation (one-time + periodic)

Generating envelope tiles requires downloading raw data from EarthScope and computing min/max envelopes. Envelope computation is trivially fast — the bottleneck is download time.

Using Lambda (monthly chunks per station, ~10s per invocation including download):

| Scale | Raw data to download | Lambda compute cost |
|---|---|---|
| 5 station-years | 36.5 GB | $0.02 |
| 100 station-years | 730 GB | $0.40 |
| 1,000 station-years | 7.3 TB | $4.00 |

EarthScope data is free to download. Lambda outside a VPC has free internet access. Lambda-to-S3 transfers are within AWS (free).

### Compute for ML model (AWS ML option only)

**GPU (AWS Batch + g4dn.xlarge spot at $0.219/hr):**

At ~3 min per station-year on GPU, the compute is modest. The 6–7 min cold start for AWS Batch is significant for small jobs but amortized across larger batches.

| Scale | GPU compute time | Total time (incl. startup) | Spot cost |
|---|---|---|---|
| 5 station-years | ~15 min | ~22 min | **$0.08** |
| 100 station-years | ~5 hours | ~5.1 hours | **$1.12** |
| 1,000 station-years | ~50 hours | ~50 hours | **$10.95** |

**CPU comparison (see [CPU-only options](#cpu-only-options-lambda-fargate)):**

| Scale | Browser JS Lambda | ONNX Runtime Lambda (est.) | GPU spot |
|---|---|---|---|
| 5 station-years | $7.30 | $0.29–$1.46 | **$0.08** |
| 100 station-years | $146 | $5.84–$29 | **$1.12** |
| 1,000 station-years | $1,460 | $58–$292 | **$10.95** |

GPU is 5–27x cheaper than even the optimistic ONNX Runtime estimate, and ~130x cheaper than browser JS on Lambda.

If tile cache generation is also running on the GPU instance, the ML model can share the same instance with negligible additional cost (the raw data is already downloaded, and envelope computation is trivially fast).

### Periodic updates (monthly, for keeping current data fresh)

For live/recent stations, new data arrives daily (~20 MB/station/day).

**GPU compute for daily ML updates:**

Each day of data takes ~0.5s per station on GPU, so startup time still dominates for small station counts. A single g4dn instance processes all stations then terminates.

| Stations kept current | GPU time/day | Startup overhead | Total time/day | Monthly GPU spot cost |
|---|---|---|---|---|
| 5 | ~2.5s | ~7 min | ~7 min | $0.78 |
| 10 | ~5s | ~7 min | ~7 min | $0.78 |
| 100 | ~50s | ~7 min | ~8 min | $0.88 |

Cost is ~$0.78–$0.88/month — one instance launch per day at $0.219/hr spot.

**S3 PUTs for daily L3 tile cache updates:**

| Stations kept current | Daily PUTs | Monthly PUTs | Monthly PUT cost |
|---|---|---|---|
| 5 | 5 | ~150 | $0.001 |
| 10 | 10 | ~300 | $0.002 |
| 100 | 100 | ~3,000 | $0.015 |

With multi-hour L3 tiles, each station's daily update is a single PUT (one tile covers the new data). PUT costs are negligible.

**Combined monthly update costs (GPU + L3 PUTs):**

| Stations kept current | Monthly cost |
|---|---|
| 5 | ~$0.78 |
| 10 | ~$0.78 |
| 100 | ~$0.90 |

## Summary: total monthly cost by combination

Assumes the tile cache and event data are pre-generated (one-time cost amortized over time), plus ongoing storage and serving. Periodic update costs are included for scenarios where stations have current data.

### A: No L3 cache + Client-side ML (minimal infrastructure)

| Scale | Storage | Serving | Updates | **Monthly total** |
|---|---|---|---|---|
| 5 × 1yr | $0.00 | $0.05 | — | **~$0.05** |
| 10 × 10yr | $0.01 | $0.05 | — | **~$0.06** |
| 100 × 10yr | $0.07 | $0.05 | — | **~$0.12** |

One-time setup: L0-L2 tile generation ($0.02–$5) + S3/CloudFront configuration. Plus one-time CORS proxy cost for ML processing (free for ≤100 station-years, ~$536 at 1,000 — see [CORS proxy](#cloudfront-as-cors-proxy-for-earthscope-data)).

**Trade-off**: Students must download raw data through the CORS proxy to zoom deeply or run the ML model. A year of data is ~7.3 GB per station — only practical for short time ranges (days to weeks) in the browser. ML results are uploaded to S3 after processing so each station-year only needs to be processed once. No smooth zoom across long time ranges.

### B: No L3 cache + AWS ML

| Scale | Storage | Serving | ML updates (GPU) | **Monthly total** |
|---|---|---|---|---|
| 5 × 1yr | $0.00 | $0.05 | $0.78 | **~$0.83** |
| 10 × 10yr | $0.01 | $0.05 | $0.78 | **~$0.84** |
| 100 × 10yr | $0.07 | $0.05 | $0.90 | **~$1.02** |

One-time setup: L0-L2 tile generation + AWS Batch with g4dn GPU instances for ML pipeline.

**Trade-off**: Pre-computed events mean students don't need to wait for ML processing. Still no smooth deep zoom. GPU instance startup (~7 min/day) dominates the cost. Adds server infrastructure to maintain.

### C: L3 cache + Client-side ML

The tile cache still needs server-side generation (downloading 7.3 GB/station-year and computing envelopes is impractical in a browser). This can run on the same GPU instance or on CPU Lambda — envelope computation is lightweight, so CPU is fine for cache-only.

| Scale | Storage | Serving | Cache updates (Lambda) | **Monthly total** |
|---|---|---|---|---|
| 5 × 1yr | $0.03 | $0.14 | $0.02 | **~$0.19** |
| 10 × 10yr | $0.58 | $0.14 | $0.02 | **~$0.74** |
| 100 × 10yr | $5.82 | $0.14 | $0.05 | **~$6.01** |

One-time setup: Full tile cache generation ($0.05–$10) + Lambda pipeline for cache + S3/CloudFront. Plus one-time CORS proxy cost for ML processing (free for ≤100 station-years, ~$536 at 1,000 — see [CORS proxy](#cloudfront-as-cors-proxy-for-earthscope-data)).

**Trade-off**: Smooth zoom experience without downloading raw data for browsing. Students still run ML in browser (slow for long time ranges on Chromebooks — ~2 min per day of data on CPU), downloading raw data through the CORS proxy. ML results are uploaded to S3 so each station-year only needs to be processed once. Server infrastructure needed for tile cache regardless.

### D: L3 cache + AWS ML (full server-side)

Since the GPU instance is already running for ML, tile cache generation runs alongside it at no additional compute cost.

| Scale | Storage | Serving | GPU updates (cache + ML) | **Monthly total** |
|---|---|---|---|---|
| 5 × 1yr | $0.03 | $0.14 | $0.78 | **~$0.95** |
| 10 × 10yr | $0.58 | $0.14 | $0.78 | **~$1.50** |
| 100 × 10yr | $5.82 | $0.14 | $0.90 | **~$6.86** |

One-time setup: Full tile cache generation + ML pipeline on AWS Batch + S3/CloudFront.

**Trade-off**: Best user experience — smooth zoom and instant event data. The GPU instance handles both ML and cache generation in one daily run. Most infrastructure to build and maintain, but the marginal cost of adding ML to the cache pipeline is near zero.

## One-time generation costs

For the initial data population (not monthly). Uses GPU (g4dn spot) for ML:

| Scale | L0-L2 tile PUTs | L3 tile PUTs (~9hr tiles) | GPU compute (ML + cache) | **Total one-time** |
|---|---|---|---|---|
| 5 × 1yr | $0.02 | $0.01 | $0.08 | **~$0.11** |
| 10 × 10yr | $0.49 | $0.18 | $1.12 | **~$1.79** |
| 100 × 10yr | $4.94 | $1.83 | $10.95 | **~$17.72** |

(Includes GPU spot compute + S3 PUTs. Raw data download from EarthScope is free for server-side processing. For client-side ML, add CORS proxy cost — see [CORS proxy](#cloudfront-as-cors-proxy-for-earthscope-data).)

## Key takeaways

1. **AWS costs are low.** Even the largest scenario (1,000 station-years with full L3 cache + AWS ML) costs ~$7/month ongoing. The infrastructure cost is dominated by engineering time to build and maintain the pipeline, not AWS bills.

2. **GPU is dramatically cheaper than CPU for ML.** At 1,000 station-years: GPU spot = $10.95, ONNX Runtime on CPU Lambda = $58–$292, browser JS on Lambda = $1,460. GPU is 5–27x cheaper than the best CPU option and ~130x cheaper than browser JS.

3. **GPU startup time dominates for daily updates.** A g4dn spot instance takes ~7 min to cold start. The actual ML processing is ~0.5s per station per day. For daily updates, you pay ~$0.78–$0.88/month mostly for instance launches — nearly flat regardless of station count.

4. **ONNX Runtime on CPU Lambda could work for small scale.** If GPU infrastructure is too complex, ONNX Runtime in a Lambda container might be 10–50x faster than browser JS (a benchmark is needed). At 5 stations this could be $0.29–$1.46 one-time — reasonable if you're avoiding GPU setup.

5. **L3 tile duration matters.** With small (~5 min) L3 tiles, PUT costs reach ~$500 for 1,000 station-years. Using larger tiles (~9 hours) reduces this to ~$5. See [L3 tile duration options](#l3-tile-duration-options).

6. **CloudFront free tier covers tile serving but not necessarily ML data.** 1 TB/month (always free) easily covers tile serving. However, CloudFront is also needed as a CORS proxy for EarthScope data. For client-side ML, raw data downloads are one-time per station-year (~7.3 GB each) — free at moderate scale but ~$536 at 1,000 station-years. Exploration at raw zoom uses minimal data.

7. **Adding ML to a cache pipeline is nearly free.** If you're already running a GPU instance for tile cache generation, running the ML model in the same job adds negligible cost. This makes combination D (full server-side) only marginally more expensive than C (cache-only), with a much better student experience.

8. **Client-side ML performance varies by hardware.** No server cost, but students need to download raw data. On CPU it's ~2 min per day of data — only practical for short time ranges. Chromebooks do support WebGPU, which dramatically improves performance (24 hours of data in ~0.5–10s depending on the device). The bottleneck for client-side ML is data download size, not model execution — see [seismic-tiles-plan.md](seismic-tiles-plan.md).

9. **The real cost is engineering time.** Building the AWS Batch pipeline, Docker container with CUDA/TensorFlow, tile generation logic, S3/CloudFront setup, and EventBridge scheduling is likely weeks of engineering work regardless of the AWS bill.
