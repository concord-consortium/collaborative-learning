// This script processes local seismic data and uploads it to S3.
// Seismic data should be downloaded using Rover. See https://github.com/EarthScope/rover.
// You must be logged in to AWS for the script to upload.
// Run like:
// npx tsx seismic/generate-envelopes.ts --input-dir ../../seismic-data/data \
//   --network AK --station K204 --location 00 --channel HNZ

// scripts/seismic/generate-envelopes.ts
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import {
  S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
  type PutObjectCommandOutput
} from "@aws-sdk/client-s3";
import { miniseed } from "seisplotjs/nodeonly";
import {
  LEVEL_SPACINGS, NUM_LEVELS, AMPLITUDE_RANGES, S3_BUCKET, S3_PREFIX
} from "../../shared/seismic/envelope-config.js";
import {
  decodeLocation, getS3Root, getStationChannelPrefix, getTileS3Key
} from "../../shared/seismic/tile-addressing.js";
import { encodeEnvelopeTile, quantize } from "../../shared/seismic/envelope-codec.js";
import { computeEnvelopesFromRaw } from "../../shared/seismic/envelope-compute.js";
import { fetchStationMetadata } from "../../shared/seismic/earthscope-client.js";
import {
  createPipelineState, processL2Point, flushTiles, type FlushTileFn
} from "../../shared/seismic/envelope-pipeline.js";
import type { ChannelMetadata, EnvelopeTileData, StationData } from "../../shared/seismic/seismic-types.js";

// ---- Configuration ----

const DEFAULT_AWS_REGION = "us-east-1";

interface ScriptConfig {
  /** Path to ROVER data root (e.g., "<datarepo>/data/") */
  inputDir: string;
  /** SEED network code (e.g., "AK") */
  network: string;
  /** SEED station code (e.g., "K204") */
  station: string;
  /** SEED location code (e.g., "00"). Blank ("") is the blank location. */
  location: string;
  /** SEED channel code (e.g., "BHZ"). If omitted, processes all channels found. */
  channel?: string;
  /** Optional local output directory for saving tiles as files */
  outputDir?: string;
  /** S3 bucket name */
  s3Bucket: string;
  /** S3 key prefix (e.g., "envelopes/") */
  s3Prefix: string;
  /** AWS region */
  awsRegion: string;
  /** When true, skip all S3 operations. --output-dir is required. */
  localOnly: boolean;
  /** Maximum number of ROVER files to process (for testing). 0 = no limit. */
  maxFiles: number;
}

function parseArgs(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: Partial<ScriptConfig> = {
    location: "",
    s3Bucket: S3_BUCKET,
    s3Prefix: S3_PREFIX,
    awsRegion: DEFAULT_AWS_REGION,
    localOnly: false,
    maxFiles: 0,
  };

  let i = 0;
  while (i < args.length) {
    const key = args[i];
    switch (key) {
      case "--local-only":
        config.localOnly = true;
        i += 1;
        break;
      case "--input-dir": config.inputDir = args[i + 1]; i += 2; break;
      case "--network": config.network = args[i + 1]; i += 2; break;
      case "--station": config.station = args[i + 1]; i += 2; break;
      case "--location": config.location = decodeLocation((args[i + 1] ?? "").trim()); i += 2; break;
      case "--channel": config.channel = args[i + 1]; i += 2; break;
      case "--output-dir": config.outputDir = args[i + 1]; i += 2; break;
      case "--s3-bucket": config.s3Bucket = args[i + 1]; i += 2; break;
      case "--s3-prefix": config.s3Prefix = args[i + 1]; i += 2; break;
      case "--aws-region": config.awsRegion = args[i + 1]; i += 2; break;
      case "--max-files": config.maxFiles = Number(args[i + 1]); i += 2; break;
      default:
        console.error(`Unknown argument: ${key}`);
        process.exit(1);
    }
  }

  if (!config.inputDir || !config.network || !config.station) {
    console.error("Usage: npx tsx scripts/seismic/generate-envelopes.ts \\");
    console.error("  --input-dir <path> --network <net> --station <sta> \\");
    console.error("  [--location <loc>] [--channel <chan>] [--output-dir <path>] [--local-only]");
    console.error("  [--s3-bucket <bucket>] [--s3-prefix <prefix>] [--aws-region <region>]");
    process.exit(1);
  }

  if (config.localOnly && !config.outputDir) {
    console.error("--output-dir is required when --local-only is set");
    process.exit(1);
  }

  return config as ScriptConfig;
}

// ---- miniSEED Parsing ----

interface RawTrace {
  channel: string;
  location: string;
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

  const years = readdirSync(networkDir).sort((a, b) => Number(a) - Number(b));
  for (const year of years) {
    const yearDir = join(networkDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    const days = readdirSync(yearDir).sort((a, b) => Number(a) - Number(b));
    for (const day of days) {
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

function loadMiniSeedFile(filePath: string): RawTrace[] {
  const buffer = readFileSync(filePath);
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const records = miniseed.parseDataRecords(arrayBuf);
  const seismograms = miniseed.seismogramPerChannel(records);

  const traces: RawTrace[] = [];
  for (const seis of seismograms) {
    for (const seg of seis.segments) {
      traces.push({
        channel: seis.channelCode,
        // trim so a padded blank location can never become a path segment
        location: (seis.locationCode ?? "").trim(),
        sampleRate: seg.sampleRate,
        startTime: seg.startTime.toSeconds(),
        samples: new Float64Array(seg.y),
      });
    }
  }
  return traces;
}

// ---- Sensitivity Lookup ----

function findSensitivity(
  metadata: ChannelMetadata[],
  channel: string,
  location: string,
  timeSec: number
): { scale: number; instrumentCode: string } {
  // Find the channel metadata entry that covers this time
  const matching = metadata.filter(m => m.channel === channel && (m.location ?? "") === location);
  if (matching.length === 0) {
    throw new Error(`No metadata found for channel ${channel} location "${location}"`);
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

// ---- S3 Operations ----

async function wipeExistingTiles(
  s3: S3Client,
  bucket: string,
  prefix: string,
  stationData: StationData
): Promise<void> {
  const keyPrefix = `${getS3Root(prefix)}${getStationChannelPrefix(stationData)}`;
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

// ---- Tile Output ----

function makeFlushTile(
  stationData: StationData,
  config: ScriptConfig,
  s3: S3Client | null,
  pendingUploads: Promise<PutObjectCommandOutput>[],
): FlushTileFn {
  let flushedCount = 0;
  return (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
    const tileKey = getTileS3Key(stationData, level, tileIndex);
    const body = encodeEnvelopeTile(tileData.mins, tileData.maxs);
    const bodyBytes = new Uint8Array(body);

    if (config.outputDir) {
      const filePath = join(config.outputDir, tileKey);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, bodyBytes);
    }

    if (s3) {
      pendingUploads.push(
        s3.send(new PutObjectCommand({
          Bucket: config.s3Bucket,
          Key: `${getS3Root(config.s3Prefix)}${tileKey}`,
          Body: bodyBytes,
          ContentType: "application/octet-stream",
          ContentEncoding: "gzip",
        }))
      );
    }

    flushedCount++;
    if (flushedCount % 100 === 0) {
      console.log(`  Flushed ${flushedCount} tile(s)...`);
    }
  };
}

// ---- Main ----

async function main() {
  const config = parseArgs();

  // 1. Find and sort ROVER files
  console.log(`Finding ROVER files in ${config.inputDir} for ${config.network}.${config.station}...`);
  const files = findRoverFiles(config.inputDir, config.network, config.station);
  if (files.length === 0) {
    throw new Error(
      `No ROVER files found for ${config.network}.${config.station} in ${config.inputDir}`
    );
  }
  if (config.maxFiles > 0) {
    files.splice(config.maxFiles);
  }
  console.log(`Found ${files.length} ROVER file(s)`);

  // 2. Fetch station metadata
  console.log(`Fetching station metadata for ${config.network}.${config.station}...`);
  const metadata = await fetchStationMetadata(config);
  console.log(`  Found ${metadata.length} channel(s)`);

  // 3. Discover channels from first file
  const firstFileTraces = loadMiniSeedFile(files[0]);
  const channelsFound = new Set(firstFileTraces.filter(t => t.location === config.location).map(t => t.channel));
  const channelsToProcess = config.channel
    ? [config.channel]
    : Array.from(channelsFound);
  if (channelsToProcess.length === 0) {
    const locationsPresent = Array.from(new Set(firstFileTraces.map(t => t.location)));
    console.error(
      `No channels found at location "${config.location}" in the first file. ` +
      `Locations present in the first file: ${locationsPresent.map(loc => `"${loc}"`).join(", ")}`
    );
    process.exit(1);
  }

  // 4. Set up S3 (if not --local-only)
  const s3 = config.localOnly ? null : new S3Client({ region: config.awsRegion });

  // 5. Process each channel
  for (const channel of channelsToProcess) {
    console.log(`\nProcessing channel ${channel} (location "${config.location}")...`);

    // Determine instrument type and amplitude range
    const firstTrace = firstFileTraces.find(t => t.channel === channel && t.location === config.location);
    if (!firstTrace) {
      const otherLocations = Array.from(new Set(
        firstFileTraces.filter(t => t.channel === channel).map(t => t.location)
      ));
      const existsAt = otherLocations.length > 0
        ? ` (${channel} exists at locations: ${otherLocations.map(loc => `"${loc}"`).join(", ")})`
        : "";
      console.warn(`No traces for channel ${channel} at location "${config.location}"${existsAt}, skipping`);
      continue;
    }
    const { instrumentCode } = findSensitivity(metadata, channel, config.location, firstTrace.startTime);
    const rangeMax = AMPLITUDE_RANGES[instrumentCode];
    if (!rangeMax) {
      console.warn(
        `Unknown instrument code "${instrumentCode}" for channel ${channel}, skipping`
      );
      continue;
    }
    console.log(`  Instrument: ${instrumentCode}, range: ±${rangeMax}`);

    const stationData: StationData = {
      network: config.network, station: config.station, location: config.location, channel
    };

    // Wipe existing tiles (S3 mode only)
    if (s3) {
      await wipeExistingTiles(s3, config.s3Bucket, config.s3Prefix, stationData);
    }

    // Initialize pipeline state
    const state = createPipelineState();
    const pendingUploads: Promise<PutObjectCommandOutput>[] = [];
    const flushTile = makeFlushTile(stationData, config, s3, pendingUploads);
    const finestLevel = NUM_LEVELS - 1;

    // Stream-process each file
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const filePath = files[fileIdx];
      console.log(`  Processing file ${fileIdx + 1}/${files.length}: ${filePath}`);
      const traces = loadMiniSeedFile(filePath);

      // Filter to target channel and sort by start time
      const channelTraces = traces
        .filter(t => t.channel === channel && t.location === config.location)
        .sort((a, b) => a.startTime - b.startTime);

      for (const trace of channelTraces) {
        const { scale } = findSensitivity(metadata, channel, config.location, trace.startTime);
        const physicalSamples = new Float64Array(trace.samples.length);
        for (let i = 0; i < trace.samples.length; i++) {
          physicalSamples[i] = trace.samples[i] / scale;
        }

        const { mins, maxs, times } = computeEnvelopesFromRaw(
          physicalSamples, trace.sampleRate, LEVEL_SPACINGS[finestLevel], trace.startTime
        );

        for (let i = 0; i < mins.length; i++) {
          const qMin = quantize(mins[i], rangeMax);
          const qMax = quantize(maxs[i], rangeMax);
          processL2Point(state, times[i], qMin, qMax);
        }
      }

      // Flush completed state after each file
      flushTiles(state, flushTile);
      if (pendingUploads.length > 0) {
        await Promise.all(pendingUploads);
        pendingUploads.length = 0;
      }
    }

    // Final flush
    flushTiles(state, flushTile, true);
    if (pendingUploads.length > 0) {
      await Promise.all(pendingUploads);
    }

    console.log(`  Channel ${channel} complete.`);
  }

  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
