// Deciding what a deletion run may remove.
//
// Kept separate from the script that performs the deletions so the rules can be read, tested and
// argued with on their own. Every rule here refuses rather than adapts: a document this cannot
// confidently address is reported, never guessed at.

import { isRtdbAddressable, resolveSpace } from "./rtdb-document-index";

/**
 * Spaces this script will not touch under any flag.
 *
 * Production holds three documents in the skip report — content with no metadata node — and those are
 * student work rather than demo debris. They want looking at individually, not sweeping.
 */
export const kProtectedSpaces = ["authed/learn_concord_org"];

/** A year. Documents newer than this are refused, whatever else is true of them. */
export const kDefaultRetentionMs = 365 * 24 * 60 * 60 * 1000;

export interface ISkippedRecord {
  key: string;
  classHash: string;
  uid: string;
  hasContent: boolean;
  hasMetadata: boolean;
  reason: string;
  space: string;
  createdAt?: number;
}

export interface IPlannedDeletion {
  key: string;
  space: string;
  reason: string;
  createdAt?: number;
  /** The realtime-database paths to remove, in the order they should go. */
  paths: string[];
}

export interface IRefusal {
  key: string;
  space: string;
  reason: string;
}

export interface IDeletionPlan {
  deletions: IPlannedDeletion[];
  refused: IRefusal[];
  summary: {
    documents: number;
    nodes: number;
    refused: number;
    bySpace: Record<string, number>;
    byReason: Record<string, number>;
  };
}

export interface IPlanOptions {
  now: number;
  protectedSpaces?: string[];
  retentionMs?: number;
}

/**
 * Turn a skip report into the set of realtime-database nodes a run may remove.
 *
 * Content is deleted before metadata, so an interrupted run leaves a document that this same report
 * would classify the same way next time rather than one that has changed category underneath it.
 */
export function planDeletions(
  records: ISkippedRecord[],
  { now, protectedSpaces = kProtectedSpaces, retentionMs = kDefaultRetentionMs }: IPlanOptions
): IDeletionPlan {
  const deletions: IPlannedDeletion[] = [];
  const refused: IRefusal[] = [];

  for (const record of records) {
    const refuse = (reason: string) => refused.push({ key: record.key, space: record.space, reason });

    if (protectedSpaces.includes(record.space)) {
      refuse("protected space");
      continue;
    }
    // A document still in use is not debris, whatever the repair could not work out about it.
    if (record.createdAt != null && now - record.createdAt < retentionMs) {
      refuse(`newer than the retention window (${new Date(record.createdAt).toISOString().slice(0, 10)})`);
      continue;
    }
    if (!isRtdbAddressable(record.classHash, record.uid, record.key)) {
      refuse("cannot be addressed in the realtime database");
      continue;
    }
    const resolution = resolveSpace(`${record.space}/documents`);
    if (resolution.status !== "ok") {
      refuse(`no realtime-database root for this space (${resolution.status})`);
      continue;
    }

    const userPath = `${resolution.rtdbRoot}/classes/${record.classHash}/users/${record.uid}`;
    const paths: string[] = [];
    if (record.hasContent) paths.push(`${userPath}/documents/${record.key}`);
    if (record.hasMetadata) paths.push(`${userPath}/documentMetadata/${record.key}`);
    if (!paths.length) {
      refuse("nothing to delete: neither content nor metadata is present");
      continue;
    }

    deletions.push({
      key: record.key, space: record.space, reason: record.reason,
      createdAt: record.createdAt, paths
    });
  }

  const bySpace: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  for (const d of deletions) {
    bySpace[d.space] = (bySpace[d.space] ?? 0) + 1;
    byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  }

  return {
    deletions,
    refused,
    summary: {
      documents: deletions.length,
      nodes: deletions.reduce((total, d) => total + d.paths.length, 0),
      refused: refused.length,
      bySpace,
      byReason
    }
  };
}
