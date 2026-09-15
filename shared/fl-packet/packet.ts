// Assembles a clue.context_packet.v2 from one CLUE document.
//
// The projections in this directory each describe one thing; assembly is where the packet becomes
// an account of a whole workspace, and so it is where three whole-packet concerns live that no
// single projection can own:
//
//   - Order. "The tile above the program" is a thing a student says, so the tiles go out in
//     reading order. normalize() already walks rowOrder, so the packet inherits it for free.
//   - Limits. The schema caps tiles at 100, shared models at 20 and run values at 100. Going over
//     does not make a big packet, it makes an invalid one.
//   - Omission. Anything dropped that the student would recognize as their own work — by a
//     projection or by those caps — is declared, or the packet reads as a complete account of a
//     workspace it only partly describes. Placeholder tiles are the deliberate exception: they are
//     the empty scaffolding of an auto-sectioned document, so declaring them would report a
//     workspace fuller than the one the student sees. See tiles.ts.
//
// An omitted[] entry carries a kind and a count and deliberately NO id. That is the schema's
// design, and its own note says why: these are declarations of absence, never addressable and
// never citable as evidence, and the absence of a ref grammar for them IS the enforcement. Naming
// what we dropped would hand the diagnostic something to cite.
//
// The byte-size check is the one limit that reports rather than enforces. A packet over the cap is
// returned intact and flagged: silently shrinking one would hide exactly the measurement this
// spike exists to take, and the caller is better placed to decide what to do about it.

import { normalize } from "../ai-summarizer/ai-summarizer";
import { DocumentContentSnapshotType } from "../ai-summarizer/ai-summarizer-types";
import {
  dataflowRunValues, ProjectedDataflowTile, projectDataflowTile, RunValue
} from "./dataflow-tile";
import { buildEnvelope, BuildEnvelopeOptions, Envelope } from "./envelope";
import { ProjectedSharedModel, projectSharedModels } from "./shared-models";
import { ProjectedTile, projectTile } from "./tiles";

// ForeverLearning's per-request context cap, raised from 12,288 after we put the firehose question
// to them. Bytes of UTF-8 JSON, not characters.
export const kMaxPacketBytes = 24576;

// Schema maxItems. These are validity limits, not preferences.
export const kMaxTiles = 100;
export const kMaxSharedModels = 20;
export const kMaxRunValues = 100;

export type PacketTile = (ProjectedTile | ProjectedDataflowTile) & {
  shared_model_ids?: string[];
};

/** Something this packet could not encode: a kind and a count, with nothing to cite. */
export interface Omission {
  kind: string;
  count: number;
}

export interface ContextPacket {
  schema_version: "clue.context_packet.v2";
  envelope: Envelope;
  workspace_state?: {
    document_id: string;
    revision: string;
    tiles: PacketTile[];
    shared_models?: ProjectedSharedModel[];
    omitted?: Omission[];
  };
  run_state?: { values: RunValue[] };
}

export interface BuildContextPacketOptions {
  content: DocumentContentSnapshotType;
  /** The document this packet describes, and which version of it. Both are required by schema. */
  documentId: string;
  revision: string;
  envelope: BuildEnvelopeOptions;
  caseSampleSize?: number;
}

export interface BuildContextPacketResult {
  packet: ContextPacket;
  /** Size of the packet as UTF-8 JSON, which is what the cap is measured in. */
  bytes: number;
  overLimit: boolean;
}

function byteLength(json: string): number {
  return new TextEncoder().encode(json).length;
}

// Truncated rows are counted from the projected models rather than reported back by the
// projection: case_count is the true total and the rows sent are what survived, so the two
// together already say everything an omission needs, and shared-model projection stays a pure
// projection. Counts across models are summed — one kind, one number, no way to attribute it.
function droppedCases(sharedModels: ProjectedSharedModel[]): number {
  let dropped = 0;
  for (const model of sharedModels) {
    const content = model.content as { cases_truncated?: boolean; case_count?: number;
                                       cases?: unknown[] };
    if (!content.cases_truncated) continue;
    dropped += (content.case_count ?? 0) - (content.cases?.length ?? 0);
  }
  return dropped;
}

export function buildContextPacket(
  opts: BuildContextPacketOptions
): BuildContextPacketResult {
  const { normalizedModel } = normalize(opts.content);
  const projection = projectSharedModels(
    normalizedModel, opts.content?.sharedModelMap,
    opts.caseSampleSize !== undefined ? { caseSampleSize: opts.caseSampleSize } : {});

  const omitted: Omission[] = [];

  const allSharedModels = projection.shared_models;
  const sharedModels = allSharedModels.slice(0, kMaxSharedModels);
  if (allSharedModels.length > sharedModels.length) {
    omitted.push({ kind: "shared_models", count: allSharedModels.length - sharedModels.length });
  }
  // A shared_model_ids entry naming a model we dropped is a dangling reference, and an id that
  // resolves to nothing is the fail-open case — the reader cannot tell a model we dropped from one
  // it failed to look up.
  const carried = new Set(sharedModels.map(m => m.model_id));

  // Run values are collected per tile rather than into one list, because they only mean anything
  // beside the tile they came from: a value carries node_id and nothing else, so the reader can
  // only resolve it by finding that node in a tile the packet carries. Collected flat, the values
  // of a tile the cap later drops would stay behind as evidence that resolves to nothing — the
  // same dangling reference shared_model_ids is filtered above to prevent.
  const allTiles: Array<{ tile: PacketTile; runValues: RunValue[] }> = [];
  for (const section of normalizedModel.sections) {
    for (const row of section.rows) {
      for (const { model } of row.tiles) {
        const content = model?.content;
        if (!content) continue;
        let tile: PacketTile | undefined;
        let tileRunValues: RunValue[] = [];
        if (content.type === "Dataflow") {
          tile = projectDataflowTile(content, model.id, model.title);
          tileRunValues = dataflowRunValues(content);
        } else {
          // projectTile returns undefined for tiles that do not belong in the packet at all.
          tile = projectTile(content, model.id, model.title);
        }
        if (!tile) continue;
        const modelIds = (projection.tileModelIds[model.id] ?? []).filter(id => carried.has(id));
        if (modelIds.length) tile.shared_model_ids = modelIds;
        allTiles.push({ tile, runValues: tileRunValues });
      }
    }
  }

  const kept = allTiles.slice(0, kMaxTiles);
  const tiles = kept.map(k => k.tile);
  if (allTiles.length > kept.length) {
    omitted.push({ kind: "tiles", count: allTiles.length - kept.length });
  }
  // Only from the tiles that survived, so no value outlives the tile that gave it meaning.
  const allRunValues = kept.flatMap(k => k.runValues);
  const runValues = allRunValues.slice(0, kMaxRunValues);
  if (allRunValues.length > runValues.length) {
    omitted.push({ kind: "run_values", count: allRunValues.length - runValues.length });
  }
  const cases = droppedCases(sharedModels);
  if (cases > 0) omitted.push({ kind: "dataset_cases", count: cases });

  const packet: ContextPacket = {
    schema_version: "clue.context_packet.v2",
    envelope: buildEnvelope(opts.envelope),
    workspace_state: {
      document_id: opts.documentId,
      revision: opts.revision,
      tiles,
      ...(sharedModels.length ? { shared_models: sharedModels } : {}),
      // Absent rather than empty, so a packet that dropped nothing makes no claim either way.
      ...(omitted.length ? { omitted } : {}),
    },
  };
  // Absent rather than empty: a document with no program has no run to report, which is a
  // different claim from a program that ran and produced nothing.
  if (runValues.length) {
    packet.run_state = { values: runValues };
  }

  const bytes = byteLength(JSON.stringify(packet));
  return { packet, bytes, overLimit: bytes > kMaxPacketBytes };
}
