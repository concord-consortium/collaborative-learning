// scripts/seismic/generate-envelopes.ts
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { miniseed } from "seisplotjs/nodeonly";
import {
  LEVEL_SPACINGS, POINTS_PER_TILE, K_FACTOR, NUM_LEVELS, AMPLITUDE_RANGES, NO_DATA_SENTINEL
} from "../../shared/seismic/envelope-config.js";
import { getTileIndex, getTileTimeRange, getTileS3Key } from "../../shared/seismic/tile-addressing.js";
import { encodeEnvelopeTile, quantize } from "../../shared/seismic/envelope-codec.js";
import { computeEnvelopesFromRaw, rollUpEnvelopes } from "../../shared/seismic/envelope-compute.js";
import { fetchStationMetadata } from "../../shared/seismic/earthscope-client.js";
import type { ChannelMetadata, EnvelopePoint, EnvelopeTileData } from "../../shared/seismic/seismic-types.js";

// ---- Configuration ----

const DEFAULT_S3_BUCKET = "models-resources";
const DEFAULT_S3_PREFIX = "collaborative-learning/envelopes/";
const DEFAULT_AWS_REGION = "us-east-1";

interface ScriptConfig {
  /** Path to ROVER data root (e.g., "<datarepo>/data/") */
  inputDir: string;
  /** SEED network code (e.g., "AK") */
  network: string;
  /** SEED station code (e.g., "K204") */
  station: string;
  /** SEED channel code (e.g., "BHZ"). If omitted, processes all channels found. */
  channel?: string;
  /** S3 bucket name */
  s3Bucket: string;
  /** S3 key prefix (e.g., "envelopes/") */
  s3Prefix: string;
  /** AWS region */
  awsRegion: string;
}

function parseArgs(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: Partial<ScriptConfig> = {
    s3Bucket: DEFAULT_S3_BUCKET,
    s3Prefix: DEFAULT_S3_PREFIX,
    awsRegion: DEFAULT_AWS_REGION,
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    switch (key) {
      case "--input-dir": config.inputDir = value; break;
      case "--network": config.network = value; break;
      case "--station": config.station = value; break;
      case "--channel": config.channel = value; break;
      case "--s3-bucket": config.s3Bucket = value; break;
      case "--s3-prefix": config.s3Prefix = value; break;
      case "--aws-region": config.awsRegion = value; break;
      default:
        console.error(`Unknown argument: ${key}`);
        process.exit(1);
    }
  }

  if (!config.inputDir || !config.network || !config.station) {
    console.error("Usage: npx tsx scripts/seismic/generate-envelopes.ts \\");
    console.error("  --input-dir <path> --network <net> --station <sta> \\");
    console.error("  [--channel <chan>] [--s3-bucket <bucket>] [--s3-prefix <prefix>] [--aws-region <region>]");
    process.exit(1);
  }

  return config as ScriptConfig;
}

// ---- miniSEED Parsing ----

interface RawTrace {
  channel: string;
  sampleRate: number;
  /** Start time in seconds since Unix epoch */
  startTime: number;
  /** Samples as raw counts (integers) */
  samples: Float64Array;
}

/**
 * Find all ROVER miniSEED files for a given network and station.
 * ROVER stores files as: <dataRoot>/<network>/<year>/<dayOfYear>/<station>.<network>.<year>.<dayOfYear>
 */
function findRoverFiles(dataRoot: string, network: string, station: string): string[] {
  const networkDir = join(dataRoot, network);
  const files: string[] = [];

  for (const year of readdirSync(networkDir)) {
    const yearDir = join(networkDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    for (const day of readdirSync(yearDir)) {
      const dayDir = join(yearDir, day);
      if (!statSync(dayDir).isDirectory()) continue;
      const expected = `${station}.${network}.${year}.${day}`;
      const filePath = join(dayDir, expected);
      try {
        statSync(filePath);
        files.push(filePath);
      } catch {
        // File doesn't exist for this day — skip
      }
    }
  }

  return files;
}

function loadMiniSeedFiles(dataRoot: string, network: string, station: string): RawTrace[] {
  const files = findRoverFiles(dataRoot, network, station);
  if (files.length === 0) {
    throw new Error(`No ROVER files found for ${network}.${station} in ${dataRoot}`);
  }
  console.log(`Found ${files.length} ROVER file(s)`);

  const traces: RawTrace[] = [];
  for (const filePath of files) {
    const buffer = readFileSync(filePath);
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const records = miniseed.parseDataRecords(arrayBuf);
    const seismograms = miniseed.seismogramPerChannel(records);

    for (const seis of seismograms) {
      const segments = seis.segments;
      for (const seg of segments) {
        traces.push({
          channel: seis.channelCode,
          sampleRate: seg.sampleRate,
          startTime: seg.startTime.toSeconds(),
          samples: new Float64Array(seg.y),
        });
      }
    }
  }

  console.log(`Loaded ${traces.length} trace segment(s)`);
  return traces;
}

// ---- Sensitivity Lookup ----

function findSensitivity(
  metadata: ChannelMetadata[],
  channel: string,
  timeSec: number
): { scale: number; instrumentCode: string } {
  // Find the channel metadata entry that covers this time
  const matching = metadata.filter(m => m.channel === channel);
  if (matching.length === 0) {
    throw new Error(`No metadata found for channel ${channel}`);
  }

  for (const m of matching) {
    const start = new Date(m.startTime).getTime() / 1000;
    const end = m.endTime === "" ? Infinity : new Date(m.endTime).getTime() / 1000;
    if (timeSec >= start && timeSec < end) {
      return { scale: m.scale, instrumentCode: m.instrumentCode };
    }
  }

  // Fall back to the most recent entry
  console.warn(`No metadata time match for channel ${channel} at ${timeSec}, using latest`);
  const last = matching[matching.length - 1];
  return { scale: last.scale, instrumentCode: last.instrumentCode };
}

// ---- Tile Assembly ----

function assembleTiles(
  level: number,
  envelopePoints: EnvelopePoint[],
  rangeMax: number
): Map<number, EnvelopeTileData> {
  const tiles = new Map<number, EnvelopeTileData>();
  const pointsPerTile = POINTS_PER_TILE[level];

  for (const pt of envelopePoints) {
    const tileIdx = getTileIndex(pt.time, level);
    if (!tiles.has(tileIdx)) {
      const mins = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
      const maxs = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
      tiles.set(tileIdx, { mins, maxs });
    }

    const tile = tiles.get(tileIdx)!;
    const tileRange = getTileTimeRange(level, tileIdx);
    const pointIndex = Math.floor((pt.time - tileRange.start) / LEVEL_SPACINGS[level]);

    if (pointIndex >= 0 && pointIndex < pointsPerTile) {
      const qMin = quantize(pt.min, rangeMax);
      const qMax = quantize(pt.max, rangeMax);

      if (tile.mins[pointIndex] === NO_DATA_SENTINEL) {
        tile.mins[pointIndex] = qMin;
        tile.maxs[pointIndex] = qMax;
      } else {
        // Merge: keep the more extreme values
        tile.mins[pointIndex] = Math.min(tile.mins[pointIndex], qMin);
        tile.maxs[pointIndex] = Math.max(tile.maxs[pointIndex], qMax);
      }
    }
  }

  return tiles;
}

// ---- S3 Operations ----

async function wipeExistingTiles(
  s3: S3Client,
  bucket: string,
  prefix: string,
  station: string,
  channel: string
): Promise<void> {
  const keyPrefix = `${prefix}${station}/${channel}/`;
  console.log(`Wiping existing tiles under ${keyPrefix}...`);

  let continuationToken: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix,
      ContinuationToken: continuationToken,
    }));

    if (list.Contents && list.Contents.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: list.Contents.map(obj => ({ Key: obj.Key })),
        },
      }));
      console.log(`  Deleted ${list.Contents.length} object(s)`);
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
}

async function uploadTiles(
  s3: S3Client,
  bucket: string,
  prefix: string,
  station: string,
  channel: string,
  level: number,
  tiles: Map<number, EnvelopeTileData>
): Promise<void> {
  console.log(`Uploading ${tiles.size} L${level} tile(s)...`);
  let count = 0;

  for (const [tileIdx, tile] of tiles) {
    const key = `${prefix}${getTileS3Key(station, channel, level, tileIdx)}`;
    const body = encodeEnvelopeTile(tile.mins, tile.maxs);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(body),
      ContentType: "application/octet-stream",
      ContentEncoding: "gzip",
    }));

    count++;
    if (count % 100 === 0) {
      console.log(`  Uploaded ${count}/${tiles.size}`);
    }
  }

  console.log(`  Done: ${count} L${level} tile(s) uploaded`);
}

// ---- Main ----

async function main() {
  const config = parseArgs();
  const prefix = config.s3Prefix;

  // 1. Load miniSEED files
  console.log(`Loading ROVER data from ${config.inputDir} for ${config.network}.${config.station}...`);
  const traces = loadMiniSeedFiles(config.inputDir, config.network, config.station);

  // 2. Fetch station metadata
  console.log(`Fetching station metadata for ${config.network}.${config.station}...`);
  const metadata = await fetchStationMetadata(config.network, config.station);
  console.log(`  Found ${metadata.length} channel(s)`);

  // 3. Group traces by channel
  const tracesByChannel = new Map<string, RawTrace[]>();
  for (const trace of traces) {
    if (config.channel && trace.channel !== config.channel) continue;
    if (!tracesByChannel.has(trace.channel)) {
      tracesByChannel.set(trace.channel, []);
    }
    tracesByChannel.get(trace.channel)!.push(trace);
  }

  if (tracesByChannel.size === 0) {
    console.error("No traces found for the specified channel(s)");
    process.exit(1);
  }

  // 4. Process each channel
  const s3 = new S3Client({ region: config.awsRegion });

  for (const [channel, channelTraces] of tracesByChannel) {
    console.log(`\nProcessing channel ${channel} (${channelTraces.length} trace segments)...`);

    // Determine instrument code and rangeMax from first trace
    const { instrumentCode } = findSensitivity(metadata, channel, channelTraces[0].startTime);
    const rangeMax = AMPLITUDE_RANGES[instrumentCode];
    if (!rangeMax) {
      console.warn(`Unknown instrument code "${instrumentCode}" for channel ${channel}, skipping`);
      continue;
    }
    console.log(`  Instrument: ${instrumentCode}, range: ±${rangeMax}`);

    // Sort traces by start time
    channelTraces.sort((a, b) => a.startTime - b.startTime);

    // Compute L2 envelopes from raw data
    const finestLevel = NUM_LEVELS - 1;
    console.log("  Computing L2 envelopes from raw data...");
    const l2Points: EnvelopePoint[] = [];

    for (const trace of channelTraces) {
      // Look up scale for this trace's time range (may differ across epochs)
      const { scale } = findSensitivity(metadata, channel, trace.startTime);
      const physicalSamples = new Float64Array(trace.samples.length);
      for (let i = 0; i < trace.samples.length; i++) {
        physicalSamples[i] = trace.samples[i] / scale;
      }

      const { mins, maxs } = computeEnvelopesFromRaw(
        physicalSamples, trace.sampleRate, LEVEL_SPACINGS[finestLevel]
      );

      for (let i = 0; i < mins.length; i++) {
        const time = trace.startTime + i * LEVEL_SPACINGS[finestLevel];
        l2Points.push({ time, min: mins[i], max: maxs[i] });
      }
    }
    console.log(`  Generated ${l2Points.length} L2 envelope points`);

    // Assemble L2 tiles
    const allTiles: Array<Map<number, EnvelopeTileData>> = new Array(NUM_LEVELS);
    allTiles[finestLevel] = assembleTiles(finestLevel, l2Points, rangeMax);

    // Roll up L2 → L1 → L0
    for (let level = NUM_LEVELS - 2; level >= 0; level--) {
      console.log(`  Rolling up L${level + 1} → L${level}...`);
      const finerTiles = allTiles[level + 1];

      // Collect all finer-level data points in order
      const finerTileIndices = [...finerTiles.keys()];
      const allMins: number[] = [];
      const allMaxs: number[] = [];
      const allTimes: number[] = [];
      const finerPointsPerTile = POINTS_PER_TILE[level + 1];

      for (const tileIdx of finerTileIndices) {
        const tile = finerTiles.get(tileIdx)!;
        const tileRange = getTileTimeRange(level + 1, tileIdx);
        for (let i = 0; i < finerPointsPerTile; i++) {
          allMins.push(tile.mins[i]);
          allMaxs.push(tile.maxs[i]);
          allTimes.push(tileRange.start + i * LEVEL_SPACINGS[level + 1]);
        }
      }

      const rolledUp = rollUpEnvelopes(
        new Int16Array(allMins),
        new Int16Array(allMaxs),
        K_FACTOR
      );

      // Convert rolled-up Int16 values back to timed points for tile assembly
      const coarserPoints: EnvelopePoint[] = [];
      for (let i = 0; i < rolledUp.mins.length; i++) {
        if (rolledUp.mins[i] === NO_DATA_SENTINEL) continue;
        const time = allTimes[i * K_FACTOR] ?? allTimes[0] + i * LEVEL_SPACINGS[level];
        // Dequantize from Int16 back to physical units for re-assembly
        coarserPoints.push({
          time,
          min: (rolledUp.mins[i] / 32767) * rangeMax,
          max: (rolledUp.maxs[i] / 32767) * rangeMax,
        });
      }

      allTiles[level] = assembleTiles(level, coarserPoints, rangeMax);
      console.log(`  Generated ${allTiles[level].size} L${level} tile(s)`);
    }

    // Wipe existing tiles for this station/channel
    await wipeExistingTiles(s3, config.s3Bucket, prefix, config.station, channel);

    // Upload all levels
    for (let level = 0; level < NUM_LEVELS; level++) {
      await uploadTiles(s3, config.s3Bucket, prefix, config.station, channel, level, allTiles[level]);
    }

    console.log(`  Channel ${channel} complete.`);
  }

  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
