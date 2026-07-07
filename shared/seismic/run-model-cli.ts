/**
 * Run the seismic ML model on raw waveform data and print detected events.
 *
 * Usage (from the scripts/ directory):
 *   npx tsx ../shared/seismic/run-model-cli.ts \
 *       --network AK --station K204 --channel HNZ \
 *       --start 2026-01-30 --end 2026-02-01
 *
 * Options:
 *   --model compact|placeholder   Model to use (default: compact, fetched from CDN)
 *   --network, --station, --channel, --start, --end   Data selection
 */

import { parseArgs } from "node:util";
import { miniseed } from "seisplotjs";
import { fetchRawSeismicData } from "./earthscope-client";
import { MILLISECONDS_PER_DAY } from "./seismic-day";
import { SeismicModelRunner } from "./seismic-model-runner";
import { ModelMetadata } from "./seismic-model-types";

const COMPACT_METADATA_URL =
  "https://models-resources.concord.org/tiny-cnn-seismicML/models/v1/compact-v1/metadata.json";

const PLACEHOLDER_METADATA: ModelMetadata = {
  $schema: "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json",
  id: "placeholder-v1",
  architecture: "placeholder",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H", "N", "L"],
  weightsUrl: "",
};

async function main() {
  const { values } = parseArgs({
    options: {
      model:   { type: "string", default: "compact" },
      network: { type: "string", default: "AK" },
      station: { type: "string", default: "K204" },
      channel: { type: "string", default: "HNZ" },
      start:   { type: "string", default: "2026-01-30" },
      end:     { type: "string", default: "2026-02-06" },
    },
  });

  const modelChoice = values.model!;
  const network = values.network!;
  const station = values.station!;
  const channel = values.channel!;
  const startDate = new Date(values.start! + (values.start!.includes("T") ? "" : "T00:00:00Z"));
  const endDate = new Date(values.end! + (values.end!.includes("T") ? "" : "T00:00:00Z"));

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY);

  console.log(`Network: ${network}  Station: ${station}  Channel: ${channel}`);
  console.log(`Range: ${startDate.toISOString()} -> ${endDate.toISOString()} (${totalDays} days)`);
  console.log();

  // Resolve model metadata
  let metadata: ModelMetadata;
  if (modelChoice === "placeholder") {
    metadata = PLACEHOLDER_METADATA;
  } else if (modelChoice === "compact") {
    console.log(`Fetching model metadata from ${COMPACT_METADATA_URL}...`);
    const response = await fetch(COMPACT_METADATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch model metadata: ${response.status}`);
    }
    metadata = await response.json() as ModelMetadata;
    // Resolve relative weightsUrl against the metadata URL
    if (metadata.weightsUrl && !metadata.weightsUrl.startsWith("http")) {
      metadata.weightsUrl = new URL(metadata.weightsUrl, COMPACT_METADATA_URL).href;
    }
  } else {
    throw new Error(`Unknown model: "${modelChoice}". Use "compact" or "placeholder".`);
  }

  const runner = new SeismicModelRunner();
  await runner.loadModel(metadata);
  console.log(`Model loaded: ${metadata.id} (${metadata.architecture})`);
  console.log();

  let totalEvents = 0;

  for (let day = 0; day < totalDays; day++) {
    const chunkStart = new Date(startDate.getTime() + day * MILLISECONDS_PER_DAY);
    const chunkEnd = new Date(chunkStart.getTime() + MILLISECONDS_PER_DAY);
    const label = chunkStart.toISOString().slice(0, 10);

    process.stdout.write(`Day ${day + 1}/${totalDays} (${label}): fetching...`);

    const response = await fetchRawSeismicData({
      network, station, location: "", channel,
      startTime: chunkStart.toISOString(), endTime: chunkEnd.toISOString()
    });
    const buffer = await response.arrayBuffer();
    const records = miniseed.parseDataRecords(buffer);
    const seismogram = miniseed.merge(records);

    process.stdout.write(` ${seismogram.numPoints} samples, running model...`);

    const events = await runner.processChunk(seismogram, {
      onProgress: () => {},
      onEvents: () => {},
    });

    totalEvents += events.length;
    console.log(` ${events.length} events`);

    for (const evt of events) {
      const start = new Date(evt.windowStart).toISOString();
      const end = new Date(evt.windowEnd).toISOString();
      console.log(`  ${evt.eventType} [${(evt.confidence * 100).toFixed(1)}%] ${start} -> ${end}`);
    }
  }

  runner.dispose();
  console.log();
  console.log(`Done. ${totalEvents} total events detected.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
