# Seismic ML Infrastructure Cost Estimates

## Decisions and chosen architecture

We have settled on **client-side ML with an L0–L2 envelope tile cache**. Raw seismic data is fetched on demand from EarthScope (via a CloudFront CORS proxy) for zoomed-in views below L2's range, and the ML model runs in the student's browser.

**Current state vs. planned work.** This document describes the chosen architecture and its cost profile. Not all pieces are in place yet:

- **Deployed today:** S3 tile cache (2 stations × 1 year, BHZ), CloudFront serving + CORS proxy, and a local tile-generation script ([scripts/seismic/generate-envelopes.ts](../../scripts/seismic/generate-envelopes.ts)) run on a developer/author machine.
- **Planned, not yet built:** the Firestore event database (see [event-database-design.md](event-database-design.md)) for sharing ML-detected events between students, and a self-service envelope-generation path so students/teachers can pick an arbitrary station-year and have tiles produced without running a script locally (likely via Lambda — see [Future option: running generation in Lambda](#future-option-running-generation-in-lambda)).

**What the chosen architecture does *not* need:**

- No AWS Batch / GPU / Lambda ML pipeline, no server-side ML processing, and no scheduled automatic updates. Tile generation is a one-time per-station-year operation.
- There is no L3 envelope level. We originally considered L3 as an intermediate tier between coarse envelopes and raw data; the L0–L2 design (with on-demand raw fetches below L2) made L3 unnecessary.

The cost sections below describe the chosen architecture (both deployed and planned pieces). The [Alternatives considered](#alternatives-considered) appendix summarizes the options we looked at and why we rejected them — the cost numbers there are the justification for the decision, not a description of current or planned infrastructure.

## Deployed tile sizes (measured)

We have deployed 1 year of envelope tiles for 2 stations (BHZ channel) to S3 at `s3://models-resources/collaborative-learning/envelopes/v1/`. These are real measurements, not estimates:

| Station | L0 tiles | L1 tiles | L2 tiles | Total tiles | Total size (gzipped) |
|---|---|---|---|---|---|
| AK_FIRE / BHZ | 3 (3.5 KB) | 201 (135 KB) | 999 (12.1 MB) | 1,203 | **~12.2 MB** |
| AK_RC01 / BHZ | 3 (3.1 KB) | 201 (59 KB) | 987 (3.3 MB) | 1,191 | **~3.3 MB** |

Per-tile averages (gzipped Int16):

| Level | Tile duration | Points/tile | AK_FIRE avg | AK_RC01 avg |
|---|---|---|---|---|
| L0 | ~182 days | 1,000 | ~1.2 KB | ~1.1 KB |
| L1 | ~1.8 days | 1,000 | ~690 B | ~300 B |
| L2 | ~8.75 hours | 20,000 | ~12.7 KB | ~3.5 KB |

**Observations:**

- **L2 dominates** (~99% of total storage) as expected from the design.
- **Per-station size varies substantially with signal content.** AK_FIRE is ~3.7× larger than AK_RC01 on the same time range and channel. This is because gzip is much more effective on quiet/sparse envelope data: AK_RC01 appears to have more missing-data sentinel runs and smoother amplitude patterns. The design doc's ~4–6 MB/station-year estimate (extrapolated from a 7-day sample of K204/HNZ) is a reasonable average but individual stations can be well above or below.
- **Tile counts match design.** ~2 L0 + ~200 L1 + ~1,000 L2 per station-year per channel, as specified in [envelope-tile-cache-design.md](envelope-tile-cache-design.md).

For planning purposes, we use **~10 MB/station-year/channel** as a conservative upper bound, and ~5 MB as a typical value.

## Tile level configuration — why L0–L2 with these spacings

The level configuration in [envelope-config.ts](../../shared/seismic/envelope-config.ts) sets L0 spacing to 15,750 s (~6 months of data across a 1,000-point L0 tile) with a scale factor of K=100 between levels, and 20,000 points per L2 tile.

### Why 3 levels and not 4

A 4th envelope level (finer than L2) would have hundreds of millions of points per station-year — hundreds of MB or more of storage. At the L2→raw transition, the viewport is ~2.6 minutes, and fetching raw data for that range from EarthScope is tens to hundreds of KB (fast enough to skip the 4th level).

### Why L0 targets ~6 months (not 3 months or 1 year)

The trade-off at L0 is between L2 storage cost and how far in you can zoom before needing raw data:

| L0 target | L2 point spacing | Raw data needed below… | L2 storage/station-year (est.) |
|---|---|---|---|
| 3 months | ~0.79 s | ~1.3 min view | ~8–12 MB |
| **6 months (chosen)** | **~1.575 s** | **~2.6 min view** | **~4–12 MB (measured)** |
| 1 year | ~3.15 s | ~5 min view | ~2–3 MB |

6 months balances storage against raw-fetch frequency. 1 year would halve storage but push the raw-fetch boundary out to ~5-minute views, which feels too coarse for interactive exploration near the event scale. 3 months doubles storage without a meaningful UX win.

### Why L2 tiles are ~8.75 hours (20,000 points), not shorter or longer

L2 has ~20M points/station-year. The tile-size choice trades S3 object count (fewer larger tiles = fewer PUTs, easier management) against per-fetch size (smaller tiles = faster initial load, less over-fetch, smaller conflict window for concurrent writers).

| L2 tile duration | Points/tile | Tile size (gzipped, est.) | Tiles/station-year |
|---|---|---|---|
| ~1.6 min | 1,000 | ~200–600 B | ~320,000 |
| ~26 min | 1,000 × 16 | ~3–10 KB | ~20,000 |
| **~8.75 hr (chosen)** | **20,000** | **~3–13 KB (measured)** | **~1,000** |
| ~1 day | ~55,000 | ~10–35 KB | ~365 |

~1,000 tiles/station-year is a comfortable object count for S3, and a single tile fetch (~3–13 KB) is small enough not to feel slow even on school networks. Larger tiles (1 day+) would reduce tile count further but make partial-tile updates (for conflict resolution during incremental fills) larger.

See [envelope-tile-cache-design.md](envelope-tile-cache-design.md) for the full addressing and concurrent-write design.

## Ongoing cost: S3 storage

At $0.023/GB/month:

| Scale | Storage (~10 MB/station-year/channel) | Monthly cost |
|---|---|---|
| 5 station-years | ~50 MB | <$0.01 |
| 100 station-years | ~1 GB | ~$0.02 |
| 1,000 station-years | ~10 GB | ~$0.23 |

Storage is effectively free at any plausible project scale.

## Ongoing cost: CloudFront serving

Assuming moderate classroom usage — 100 active students, each viewing ~5 stations across 2–3 zoom levels, 2 sessions/month:

| Metric | Estimate |
|---|---|
| Tile fetches/month | ~120,000 |
| Data transferred | ~240 MB |
| Cost | ~$0.14/month |

**CloudFront's always-free tier (1 TB/month + 10M requests/month) covers this many times over.** Tile serving is effectively free.

### CloudFront as CORS proxy for EarthScope data

EarthScope's data server does not support CORS, so browser access to raw seismic data goes through our CloudFront proxy. Two usage patterns:

1. **Client-side ML processing (one-time per station-year, planned).** Once the Firestore event database is in place, a student processes the raw data for a station-year and uploads ML event results to Firestore so other students don't have to redo the work. Each station-year is ~7.3 GB of raw data.
2. **Exploration at raw zoom level.** Below L2 (~2.6-minute viewport), the client fetches raw 200 Hz data for the visible time range. Raw is ~1.4 MB/hour, so even active exploration by 100 students stays well within the free tier.

| Station-years processed via proxy | Data through proxy | CloudFront cost |
|---|---|---|
| 5 | 36.5 GB | free tier |
| 100 | 730 GB | free tier |
| 1,000 | 7.3 TB | ~$536 (one-time) |

Rate: first 1 TB/month free, then $0.085/GB. CloudFront edge caching reduces this if multiple students process the same station.

Download time matters as much as cost. 7.3 GB (one station-year) takes:

| Effective bandwidth | Time for 7.3 GB |
|---|---|
| 5 Mbps | ~3.2 hours |
| 25 Mbps | ~39 min |
| 50 Mbps | ~19 min |

On shared school networks, per-student throughput may be well below the school's total bandwidth. This is the main practical limit on client-side ML for long time ranges, not the cloud bill.

## Ongoing cost: Firestore event database (planned)

The event database is not yet built. Once it is, ML-detected events and coverage bitmaps will be stored in Firestore. See [event-database-design.md](event-database-design.md) for the schema. Assumes 5% event rate with 60-second model windows (~26K events per station-year) and 10-minute coverage bitmaps (13 docs/year).

**Storage** (at $0.18/GB/month):

| Scale | Event docs | Event storage | **Monthly total** |
|---|---|---|---|
| 5 station-years | ~130K | ~26 MB | **~$0.005** |
| 100 station-years | ~2.6M | ~520 MB | **~$0.09** |
| 1,000 station-years | ~26M | ~5.2 GB | **~$0.94** |

**Writes** (one-time as students process data, at $0.18/100K writes):

| Scale | Event writes | **Write cost** |
|---|---|---|
| 5 station-years | ~130K | ~$0.23 |
| 100 station-years | ~2.6M | ~$4.68 |
| 1,000 station-years | ~26M | ~$46.80 |

**Reads** per query (at $0.06/100K reads): loading events for 1 station+model+year reads ~26K docs = ~$0.016/query.

## One-time cost: tile generation

Envelope tile generation is currently run as a local script ([scripts/seismic/generate-envelopes.ts](../../scripts/seismic/generate-envelopes.ts)) on a developer or author machine, on-demand when a new station-year is needed. Per station-year, the work is:

- Download ~7.3 GB raw data from EarthScope (free; EarthScope doesn't charge, and the script runs outside the browser so no CORS proxy is needed).
- Compute L0–L2 envelopes (trivially fast — dominated by download).
- Upload ~1,200 tiles to S3. At $0.005/1,000 PUTs, this is ~$0.006/station-year.

**The only cloud cost is the S3 PUTs**, which is negligible:

| Scale | S3 PUTs | **Total cloud cost** |
|---|---|---|
| 5 station-years | ~6,000 | **~$0.03** |
| 100 station-years | ~120,000 | **~$0.60** |
| 1,000 station-years | ~1.2M | **~$6** |

### Future option: running generation in Lambda

Longer-term we want students and teachers to be able to pick an arbitrary station-year from within the app and have envelope tiles produced on the fly, without anyone running a local script. Wrapping the generation script in AWS Lambda is the natural path there, and also helps if we need to bulk-process many stations. The workload fits Lambda well: each invocation processes one monthly chunk for one station (~600 MB raw data, ~10 s including download, well under the 15-minute limit and within memory/ephemeral-storage limits).

Estimated cost in addition to the S3 PUTs above:

| Scale | Lambda invocations | Lambda compute |
|---|---|---|
| 5 station-years | ~60 | ~$0.02 |
| 100 station-years | ~1,200 | ~$0.40 |
| 1,000 station-years | ~12,000 | ~$4 |

At these scales the Lambda cost is also negligible — on the same order as the S3 PUTs. The decision to move to Lambda would be driven by workflow (automation, self-service generation) rather than cost.

## Summary: total ongoing monthly cost

| Scale | S3 | CloudFront serving | Firestore events | **Total/month** |
|---|---|---|---|---|
| 5 × 1 yr | <$0.01 | ~$0.14 | ~$0.005 | **~$0.15** |
| 10 × 10 yr | ~$0.02 | ~$0.14 | ~$0.09 | **~$0.25** |
| 100 × 10 yr | ~$0.23 | ~$0.14 | ~$0.94 | **~$1.31** |

**The infrastructure bill is negligible at any plausible scale.** The real costs are engineering time to build and maintain the pipeline, and (for client-side ML) the student-time cost of downloading 7.3 GB per station-year for ML processing.

## Key takeaways

1. **Cloud costs are not a constraint on this project.** Ongoing costs are ~$1/month even at 100 × 10-year scale. Engineering time dominates.
2. **Deployed L2 size varies ~4× between stations.** AK_FIRE/BHZ is ~12 MB/year; AK_RC01/BHZ is ~3 MB/year. Gzip compresses quiet/sparse envelope data far more effectively than noisy data. Plan for ~10 MB/station-year/channel as a conservative upper bound.
3. **Client-side ML's real cost is student download time, not cloud bills.** 7.3 GB per station-year through the browser is the binding constraint for long time ranges on school networks.
4. **Free tiers cover serving entirely.** CloudFront's always-free 1 TB/month + 10M requests/month covers tile serving and the CORS proxy for small-to-moderate deployments. At 1,000 station-years processed via proxy, ~$536 one-time becomes visible — that's the only scale at which CloudFront appears on the bill.

---

## Alternatives considered

We evaluated several architectures before settling on client-side ML + L0–L2 tile cache. This section summarizes what we considered and why we rejected each. The cost numbers here are historical context — they justify why we chose the current architecture, not something we plan to build.

### Server-side ML on AWS (rejected)

We considered running the ML model on AWS (Lambda CPU, Fargate CPU, or AWS Batch with GPU) and pre-computing events for all stations/years the students would see.

**Cost snapshot at 1,000 station-years (one-time ML compute):**

| Compute option | Cost | Notes |
|---|---|---|
| AWS Batch + g4dn spot GPU | ~$11 | Cheapest. ~3 min/station-year on T4 GPU. |
| ONNX Runtime on Lambda CPU (est.) | $58–$292 | Uncertain 10–50× speedup over browser JS from SIMD / oneDNN. Benchmark was never run. |
| Browser-equivalent JS/WASM on Lambda | ~$1,460 | ~2 min per day of data. |

GPU is 5–27× cheaper than CPU Lambda and ~130× cheaper than running the same JS model on Lambda.

**Why we didn't go this route:**
- Ongoing GPU startup cost (~$0.78–$0.88/month) was small but nonzero, and required AWS Batch / Docker / CUDA pipeline engineering to build and maintain.
- Client-side ML was already viable: WebGPU runs the model in ~0.5–10 s/day on modern devices (including Chromebooks), and CPU fallback is ~2 min/day (acceptable for short ranges).
- Eliminating server-side ML removes an entire infrastructure layer (AWS Batch, container builds, scheduled jobs, monitoring) — a significant reduction in what we have to build and keep working.
- Server-side ML *would* avoid the ~7.3 GB per station-year raw-data download that client-side ML currently requires (the server would fetch from EarthScope directly, no CORS proxy, no student bandwidth). This is a real trade-off we accepted: with client-side ML, processing a new station-year is slow on school networks, but each station-year only needs to be processed once and the results are shared via Firestore — so the pain is amortized across a class rather than repeated per student.
- **We want to support any station, globally.** There are thousands of seismic stations worldwide, and we can't pre-process all of them. A server-side pipeline would need to handle on-demand requests for arbitrary stations that a classroom picks. AWS Batch scales to zero when idle, so *compute* cost would still be near zero when no classrooms are active, but keeping such a pipeline responsive and maintained (container images, model updates, EarthScope auth, error handling, monitoring) is a nontrivial ongoing engineering cost — probably more than the cloud bill. Client-side ML puts the "on-demand for any station" capability directly in the browser with no always-on infrastructure to maintain. *(The cost framing here is a judgment call, not a computed number; the engineering-overhead argument is the stronger one.)*

### Periodic automatic updates (rejected)

We considered a daily scheduled job (EventBridge + AWS Batch) that fetches new data for "live" stations, runs ML on it, and updates tiles and event docs. Cost was ~$0.78–$0.90/month (dominated by GPU cold-start, ~7 min per daily launch), plus negligible S3 PUTs.

**Why we didn't go this route:**
- Our current use case is classroom exploration of past events, not live monitoring. Students aren't asking "what happened last night" — they're asking "what happened during the last year."
- An on-demand generation workflow (a student or author picks a station-year, we run the pipeline once) matches actual usage better.
- Removes another piece of always-on infrastructure to maintain.

### L3 envelope level / server-side tile cache layer (rejected)

An earlier version of this design included an L3 level between L2 and raw data (~100M points/station-year, ~250 MB gzipped, fetched as multi-hour tiles from S3). Cost impact at 1,000 station-years was ~$6/month storage + ~$5 one-time PUTs with ~9-hour tiles.

**Why we didn't go this route:**
- At the L2→raw transition, fetching raw data directly from EarthScope (via the CORS proxy that we already need for client-side ML) is fast enough for interactive use — tens to hundreds of KB for a ~2.6-minute view.
- L3 would have multiplied the tile cache's storage by ~50× for a modest UX improvement.
- Keeps the cache architecture simpler: three levels, one consistent format.

### The full four-scenario matrix (historical)

Earlier exploration sketched four combinations of {L3 cache or not} × {client-side or AWS ML}:

| | Client-side ML | AWS ML |
|---|---|---|
| Without L3 | **A: chosen (client-side + L0–L2 cache)** | B: Server ML only |
| With L3 | C: Cache only | D: Full server-side |

At 100 × 10-year scale, monthly costs ranged from ~$1 (A) to ~$8 (D). Cost was never the deciding factor — engineering complexity and the realization that client-side ML is fast enough on WebGPU were what steered us to the simplest option (A).
