// Assembles a clue.context_packet.v2 from one CLUE document.
//
// The projections in this directory each describe one thing; assembly is where the packet becomes
// an account of a whole workspace, and so it is where two whole-packet concerns live that no
// single projection can own:
//
//   - Order. "The tile above the program" is a thing a student says, so the tiles go out in
//     reading order. normalize() already walks rowOrder, so the packet inherits it for free.
//   - Omission. Anything a projection dropped has to surface here, or the packet reads as a
//     complete account of a workspace it only partly describes.
//
// The size check reports rather than enforces. A packet over the cap is still returned and still
// flagged: silently shrinking one would hide exactly the measurement this spike exists to take,
// and the caller is better placed to decide what to do about it.

import { normalize } from "../ai-summarizer/ai-summarizer";
import { DocumentContentSnapshotType } from "../ai-summarizer/ai-summarizer-types";
import {
  dataflowRunValues, ProjectedDataflowTile, projectDataflowTile, RunValue
} from "./dataflow-tile";
import { buildEnvelope, BuildEnvelopeOptions, Envelope } from "./envelope";
import { ProjectedSharedModel, projectSharedModels } from "./shared-models";
import { ProjectedTile, projectTile } from "./tiles";

// ForeverLearning's per-request context cap, raised from 12,288 after we raised the firehose
// question with them. Bytes of UTF-8 JSON, not characters.
export const kMaxPacketBytes = 24576;

export type PacketTile = (ProjectedTile | ProjectedDataflowTile) & {
  shared_model_ids?: string[];
};

export interface ContextPacket {
  schema: "clue.context_packet.v2";
  envelope: Envelope;
  workspace_state?: {
    tiles: PacketTile[];
    shared_models: ProjectedSharedModel[];
  };
  run_state?: { values: RunValue[] };
}

/** Something a projection dropped, named so the reader can tell what it is not being told. */
export interface Omission {
  what: "dataset_cases";
  ref: string;
  kept: number;
  total: number;
}

export interface BuildContextPacketOptions {
  content: DocumentContentSnapshotType;
  envelope: BuildEnvelopeOptions;
  caseSampleSize?: number;
}

export interface BuildContextPacketResult {
  packet: ContextPacket;
  /** Size of the packet as UTF-8 JSON, which is what the cap is measured in. */
  bytes: number;
  overLimit: boolean;
  omitted: Omission[];
}

function byteLength(json: string): number {
  return new TextEncoder().encode(json).length;
}

// Truncation is derived from the projected models rather than reported back by the projection:
// case_count is the true total and the rows sent are what survived, so the two together already
// say everything an omission record needs, and shared-model projection stays a pure projection.
function omissionsFrom(sharedModels: ProjectedSharedModel[]): Omission[] {
  const omitted: Omission[] = [];
  for (const model of sharedModels) {
    const content = model.content as { cases_truncated?: boolean; case_count?: number;
                                       cases?: unknown[] };
    if (!content.cases_truncated) continue;
    omitted.push({
      what: "dataset_cases", ref: model.model_id,
      kept: content.cases?.length ?? 0, total: content.case_count ?? 0,
    });
  }
  return omitted;
}

export function buildContextPacket(
  opts: BuildContextPacketOptions
): BuildContextPacketResult {
  const { normalizedModel } = normalize(opts.content);
  const { shared_models, tileModelIds } = projectSharedModels(
    normalizedModel, opts.content?.sharedModelMap,
    opts.caseSampleSize !== undefined ? { caseSampleSize: opts.caseSampleSize } : {});

  const tiles: PacketTile[] = [];
  const runValues: RunValue[] = [];
  for (const section of normalizedModel.sections) {
    for (const row of section.rows) {
      for (const { model } of row.tiles) {
        const content = model?.content;
        if (!content) continue;
        let tile: PacketTile | undefined;
        if (content.type === "Dataflow") {
          tile = projectDataflowTile(content, model.id, model.title);
          runValues.push(...dataflowRunValues(content));
        } else {
          tile = projectTile(content, model.id, model.title);
        }
        // projectTile returns undefined for tiles that do not belong in the packet at all.
        if (!tile) continue;
        const modelIds = tileModelIds[model.id];
        if (modelIds?.length) tile.shared_model_ids = modelIds;
        tiles.push(tile);
      }
    }
  }

  const packet: ContextPacket = {
    schema: "clue.context_packet.v2",
    envelope: buildEnvelope(opts.envelope),
  };
  if (tiles.length || shared_models.length) {
    packet.workspace_state = { tiles, shared_models };
  }
  // Absent rather than empty: a document with no program has no run to report, which is a
  // different claim from a program that ran and produced nothing.
  if (runValues.length) {
    packet.run_state = { values: runValues };
  }

  const bytes = byteLength(JSON.stringify(packet));
  return {
    packet, bytes, overLimit: bytes > kMaxPacketBytes, omitted: omissionsFrom(shared_models),
  };
}
