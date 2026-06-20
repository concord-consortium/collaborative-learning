#!/usr/bin/node

// Exports CLUE document comments and their tags from Firestore to a CSV file.
//
// This is a one-off/operational export intended for researcher tagging reports.
// Researcher actions are intentionally not sent to the remote logger, so the
// Firestore comments subcollections are the source of truth for tag activity.
//
// Setup:
//   1. Place a service account key for the target Firebase project at
//      scripts/serviceAccountKey.json (same requirement as the other scripts).
//   2. cd scripts
//   3. npx tsx export-comment-tags.ts [options]
//
// You must narrow the export with at least one of:
//   --context-ids     Comma-separated class hashes (context_id). Queries
//                     documents by class. Recommended when the class is known.
//   --document-keys   Comma-separated CLUE document keys (the `key` field).
//   --commenter-uids  Comma-separated comment author UIDs. Without
//                     --context-ids/--document-keys this uses a Firestore
//                     collection-group query, which may require enabling a
//                     collection-group index for `uid` (the error message
//                     includes a link that creates it).
//
// Other options:
//   --portal          Portal host, default "learn.concord.org".
//   --demo            Demo space name (e.g. "TAGCLUE"). Overrides --portal
//                     pathing and reads from demo/{name}/documents.
//   --start-date      Inclusive ISO date (YYYY-MM-DD) or datetime. Dates are
//                     interpreted as UTC start-of-day.
//   --end-date        Inclusive ISO date or datetime. Dates are interpreted
//                     as UTC end-of-day (23:59:59.999Z).
//   --tag-labels      Path to a JSON file, or an https URL to a unit
//                     content.json. Used to add human-readable tag labels.
//                     A JSON file should map tag IDs to labels; a unit URL
//                     uses the unit's `config.commentTags`.
//   --database-url    Realtime Database URL used to look up each document's
//                     offeringId (needed to build the document_link column).
//                     Defaults to https://{service-account project_id}.firebaseio.com.
//   --include-untagged  Also emit rows for comments that have no tags.
//   --exclude-content   Omit the comment text from the CSV.
//   --out             Output CSV path. Default comment-tags-export-<ts>.csv.
//
// Output columns:
//   In addition to portal/class/document/comment/tag columns, the CSV includes
//   `class_teacher_uids` (pipe-separated uids from the Firestore class doc),
//   `problem_label` (e.g. "MSA 1.3", built from the document's unit/
//   investigation/problem fields and blank for documents lacking them — older
//   docs may need `find-documents-missing-metadata.ts` run first to backfill),
//   and `document_offering_id` + `document_link` (researcher-mode "link to
//   work" URL into CLUE, built like the report-service ClueLinkToWork step).
//   `offering_id`/`document_link` are blank for personal documents and
//   learning logs (no offering) and for --demo runs.
//
// Examples:
//   npx tsx export-comment-tags.ts --context-ids abc123 \
//     --start-date 2026-03-01 --end-date 2026-05-31
//   npx tsx export-comment-tags.ts --commenter-uids 1234,5678 \
//     --start-date 2026-03-01 --end-date 2026-05-31 --include-untagged

import fs from "fs";
import admin from "firebase-admin";
import { GrpcStatus } from "firebase-admin/firestore";

import {
  getFirebaseBasePath, getFirestoreBasePath, getFirestoreClassesPath, getScriptRootFilePath, prettyDuration
} from "./lib/script-utils.js";

// Firestore limits `in` queries; 10 is safe across SDK versions.
const inQueryLimit = 10;

interface IArgs {
  portal: string;
  demo: string | false;
  contextIds: string[];
  documentKeys: string[];
  commenterUids: string[];
  startDate?: Date;
  endDate?: Date;
  tagLabels?: string;
  databaseUrl?: string;
  includeUntagged: boolean;
  excludeContent: boolean;
  out: string;
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  console.error(`Run with --help for usage.`);
  process.exit(1);
}

function parseDateArg(name: string, value: string, endOfDay: boolean) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isoValue = dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value;
  const date = new Date(isoValue);
  if (isNaN(date.getTime())) {
    fail(`Invalid ${name}: ${value}. Use YYYY-MM-DD or an ISO datetime.`);
  }
  return date;
}

function parseList(value: string) {
  return value.split(",").map(item => item.trim()).filter(item => item.length > 0);
}

function parseArgs(argv: string[]): IArgs {
  const result: IArgs = {
    portal: "learn.concord.org",
    demo: false,
    contextIds: [],
    documentKeys: [],
    commenterUids: [],
    includeUntagged: false,
    excludeContent: false,
    out: `comment-tags-export-${Date.now()}.csv`
  };
  const booleanFlags = ["include-untagged", "exclude-content", "help"];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`Unexpected argument: ${arg}`);
    let flag = arg.slice(2);
    let value: string | undefined;
    const equalsIndex = flag.indexOf("=");
    if (equalsIndex >= 0) {
      value = flag.slice(equalsIndex + 1);
      flag = flag.slice(0, equalsIndex);
    } else if (!booleanFlags.includes(flag)) {
      value = argv[++i];
      if (value === undefined) fail(`Missing value for --${flag}`);
    }

    switch (flag) {
      case "help":
        // The usage comment is at the top of this file.
        console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\nimport ")[0]);
        process.exit(0);
        break;
      case "portal": result.portal = value!; break;
      case "demo": result.demo = value!; break;
      case "context-ids": result.contextIds = parseList(value!); break;
      case "document-keys": result.documentKeys = parseList(value!); break;
      case "commenter-uids": result.commenterUids = parseList(value!); break;
      case "start-date": result.startDate = parseDateArg("start-date", value!, false); break;
      case "end-date": result.endDate = parseDateArg("end-date", value!, true); break;
      case "tag-labels": result.tagLabels = value!; break;
      case "database-url": result.databaseUrl = value!; break;
      case "include-untagged": result.includeUntagged = true; break;
      case "exclude-content": result.excludeContent = true; break;
      case "out": result.out = value!; break;
      default: fail(`Unknown option: --${flag}`);
    }
  }

  if (!result.contextIds.length && !result.documentKeys.length && !result.commenterUids.length) {
    fail("Provide at least one of --context-ids, --document-keys, or --commenter-uids.");
  }
  if (result.startDate && result.endDate && result.startDate > result.endDate) {
    fail("--start-date is after --end-date.");
  }
  return result;
}

async function loadTagLabels(source: string | undefined): Promise<Record<string, string>> {
  if (!source) return {};
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const response = await fetch(source);
    if (!response.ok) fail(`Failed to fetch tag labels from ${source}: ${response.status}`);
    const unitContent: any = await response.json();
    const commentTags = unitContent?.config?.commentTags ?? unitContent?.commentTags;
    if (!commentTags) fail(`No commentTags found in unit content at ${source}`);
    return commentTags;
  }
  return JSON.parse(fs.readFileSync(source, "utf8"));
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Prevent CSV/spreadsheet formula injection. A cell whose first character is
 * =, +, -, @, tab, or CR can be interpreted as a formula by Excel/Sheets (e.g.
 * =HYPERLINK(...)). This export carries free-text, student/teacher-authored
 * fields, so prefix any such value with a single quote to force a literal.
 * Safe to neutralize a leading "-" because this export has no numeric columns;
 * revisit if a numeric column is ever added.
 */
function neutralizeCsvInjection(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function toIsoString(timestamp: any) {
  if (!timestamp) return "";
  if (typeof timestamp.toDate === "function") return timestamp.toDate().toISOString();
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? String(timestamp) : date.toISOString();
}

function timestampToDate(timestamp: any): Date | undefined {
  if (!timestamp) return undefined;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? undefined : date;
}

const args = parseArgs(process.argv.slice(2));

console.log(`*** Starting comment/tag export ***`);
const startTime = Date.now();

const tagLabels = await loadTagLabels(args.tagLabels);

// Initialize the app with a service account, granting admin privileges.
// The Firebase project is determined by the service account key, so this
// works for CLUE production, staging, etc. depending on the key provided.
const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, "utf8"));
console.log(`- Service account: ${serviceAccount.client_email}`);
console.log(`- Firebase project: ${serviceAccount.project_id}`);
const credential = admin.credential.cert(serviceAccountFile);
const databaseURL = args.databaseUrl ?? `https://${serviceAccount.project_id}.firebaseio.com`;
console.log(`- Realtime Database URL: ${databaseURL}`);
admin.initializeApp({ credential, databaseURL });
const firestore = admin.firestore();
const database = admin.database();

process.on("uncaughtException", (error: any) => {
  if (error?.code === GrpcStatus.UNAUTHENTICATED) {
    console.error(`\nERROR: Google rejected the service account credential (UNAUTHENTICATED).`);
    console.error(`This usually means the key in scripts/serviceAccountKey.json has been`);
    console.error(`revoked/expired, or your system clock is off by more than ~5 minutes.`);
    console.error(`Fix: generate a fresh key in the Firebase console for project`);
    console.error(`"${serviceAccount.project_id}" (Project settings > Service accounts >`);
    console.error(`Generate new private key) and replace scripts/serviceAccountKey.json.\n`);
    console.error(`Original error: ${error.message ?? error}`);
    process.exit(1);
  }
  throw error;
});

const documentsPath = getFirestoreBasePath(args.portal, args.demo);
const classesPath = getFirestoreClassesPath(args.portal, args.demo);
const databaseClassesPath = getFirebaseBasePath(args.portal, args.demo);
console.log(`- Documents collection: ${documentsPath}`);

// --- Class metadata cache (context_id -> class info) ---

interface IClassInfo { classId: string; className: string; teacherUids: string[]; }
const classCache: Record<string, IClassInfo> = {};

async function getClassInfo(contextId: string | undefined): Promise<IClassInfo> {
  const unknown = { classId: "", className: "", teacherUids: [] };
  if (!contextId) return unknown;
  if (classCache[contextId]) return classCache[contextId];

  let data: admin.firestore.DocumentData | undefined;
  // Class docs are stored under both {contextId} and {network}_{contextId}.
  const directDoc = await firestore.collection(classesPath).doc(contextId).get();
  if (directDoc.exists) {
    data = directDoc.data();
  } else {
    const querySnapshot = await firestore.collection(classesPath)
      .where("context_id", "==", contextId).limit(1).get();
    data = querySnapshot.docs[0]?.data();
  }
  const info: IClassInfo = data
    ? {
        classId: data.id ?? "",
        className: data.name ?? "",
        teacherUids: Array.isArray(data.teachers) ? data.teachers.filter((uid: unknown) => !!uid) : []
      }
    : unknown;
  classCache[contextId] = info;
  return info;
}

// --- Document offering lookup cache (documentKey -> offeringId) ---
//
// CLUE only writes offeringId into the Realtime Database document metadata for
// document types where it applies (Problem/Planning/Group/Publication). Personal
// documents and learning logs have no offeringId, so the lookup returns "" and
// the resulting document_link column is left blank for them. In --demo mode we
// skip the lookup entirely since the resulting CLUE link wouldn't resolve
// against a real portal.

const offeringIdCache: Record<string, string> = {};

async function getOfferingId(classHash: string, ownerUid: string, documentKey: string): Promise<string> {
  if (args.demo) return "";
  if (!classHash || !ownerUid || !documentKey) return "";
  if (offeringIdCache[documentKey] !== undefined) return offeringIdCache[documentKey];

  const path = `${databaseClassesPath}/${classHash}/users/${ownerUid}/documentMetadata/${documentKey}`;
  let offeringId = "";
  try {
    const snapshot = await database.ref(path).once("value");
    const metadata = snapshot.val();
    if (metadata?.offeringId != null) {
      offeringId = String(metadata.offeringId);
    }
  } catch (error: any) {
    console.warn(`    Failed to read RTDB metadata at ${path}: ${error?.message ?? error}`);
  }
  offeringIdCache[documentKey] = offeringId;
  return offeringId;
}

// Formats the curriculum problem fields on a Firestore document into a label
// like "MSA 1.3". Returns "" if any of unit/investigation/problem is missing —
// older documents may not have those fields populated (see
// scripts/find-documents-missing-metadata.ts, which backfills them from the
// portal offering when missing).
function buildProblemLabel(documentData: admin.firestore.DocumentData) {
  const unit = documentData.unit;
  const investigation = documentData.investigation;
  const problem = documentData.problem;
  if (!unit || investigation == null || problem == null) return "";
  return `${String(unit).toUpperCase()} ${investigation}.${problem}`;
}

// Builds the researcher "link to work" URL into CLUE, mirroring the
// ClueLinkToWork post-processing step in report-service
// (server/lib/report_server/reports/clue/history_link.ex). Returns "" if any
// required input is missing.
function buildDocumentLink(params: {
  portal: string;
  classId: string;
  offeringId: string;
  documentUid: string;
  documentKey: string;
}) {
  const { portal, classId, offeringId, documentUid, documentKey } = params;
  if (!classId || !offeringId || !documentUid || !documentKey) return "";
  const classUrl = `https://${portal}/api/v1/classes/${classId}`;
  const offeringUrl = `https://${portal}/api/v1/offerings/${offeringId}`;
  const authDomainUrl = `https://${portal}/`;
  const qs = [
    `class=${encodeURIComponent(classUrl)}`,
    `offering=${encodeURIComponent(offeringUrl)}`,
    "researcher=true",
    "reportType=offering",
    `authDomain=${encodeURIComponent(authDomainUrl)}`,
    `resourceLinkId=${offeringId}`,
    `targetUserId=${documentUid}`,
    `studentDocument=${documentKey}`
  ].join("&");
  return `https://collaborative-learning.concord.org/?${qs}`;
}

// --- Row collection ---

const header = [
  "portal", "firestore_root",
  "context_id", "class_id", "class_name", "class_teacher_uids",
  "document_firestore_id", "document_key", "document_type", "document_title", "document_owner_uid",
  "problem_label", "document_offering_id", "document_link",
  "comment_id", "comment_created_at", "comment_author_uid", "comment_author_name", "comment_network",
  "tile_id", "tag_id", "tag_label", "all_comment_tags",
  ...(args.excludeContent ? [] : ["comment_content"])
];
const rows: string[][] = [];

let documentsProcessed = 0;
let commentsProcessed = 0;
let commentsIncluded = 0;
let tagRowsEmitted = 0;
let untaggedComments = 0;

function commentMatchesFilters(comment: admin.firestore.DocumentData) {
  if (args.commenterUids.length && !args.commenterUids.includes(String(comment.uid))) return false;
  const createdAt = timestampToDate(comment.createdAt);
  if (args.startDate && (!createdAt || createdAt < args.startDate)) return false;
  if (args.endDate && (!createdAt || createdAt > args.endDate)) return false;
  return true;
}

async function processComment(
  documentSnapshot: admin.firestore.DocumentSnapshot,
  commentId: string,
  comment: admin.firestore.DocumentData
) {
  commentsProcessed++;
  if (!commentMatchesFilters(comment)) return;
  commentsIncluded++;

  const documentData = documentSnapshot.data() ?? {};
  const classInfo = await getClassInfo(documentData.context_id);
  // Malformed comment docs with non-array `tags` have been observed in production
  // (see functions-v2/src/on-document-tagged.ts), so guard against them rather
  // than aborting the entire export.
  let tags: string[] = [];
  const rawTags = comment.tags;
  if (Array.isArray(rawTags)) {
    tags = rawTags.map((tag: unknown) => String(tag).trim()).filter(tag => tag.length > 0);
  } else if (rawTags != null) {
    console.warn(`    Skipping invalid tags on ${documentSnapshot.ref.path}/comments/${commentId}:`, rawTags);
  }
  if (!tags.length) {
    untaggedComments++;
    if (!args.includeUntagged) return;
  }

  const offeringId = await getOfferingId(documentData.context_id ?? "", documentData.uid ?? "", documentData.key ?? "");
  const documentLink = buildDocumentLink({
    portal: args.portal,
    classId: classInfo.classId,
    offeringId,
    documentUid: documentData.uid ?? "",
    documentKey: documentData.key ?? ""
  });
  const problemLabel = buildProblemLabel(documentData);

  const baseRow = [
    args.demo ? `demo:${args.demo}` : args.portal, documentsPath,
    documentData.context_id ?? "", classInfo.classId, classInfo.className, classInfo.teacherUids.join("|"),
    documentSnapshot.id, documentData.key ?? "", documentData.type ?? "",
    documentData.title ?? "", documentData.uid ?? "",
    problemLabel, offeringId, documentLink,
    commentId, toIsoString(comment.createdAt), String(comment.uid ?? ""), comment.name ?? "",
    comment.network ?? "", comment.tileId ?? ""
  ];
  const contentColumns = args.excludeContent ? [] : [comment.content ?? ""];
  const emitTags = tags.length ? tags : [""];
  for (const tag of emitTags) {
    rows.push([...baseRow, tag, tagLabels[tag] ?? "", tags.join("|"), ...contentColumns]);
    tagRowsEmitted++;
  }
}

const processedDocumentPaths = new Set<string>();

async function processDocumentComments(documentSnapshot: admin.firestore.DocumentSnapshot) {
  // Guard against double-processing when filter modes overlap.
  if (processedDocumentPaths.has(documentSnapshot.ref.path)) return;
  processedDocumentPaths.add(documentSnapshot.ref.path);
  documentsProcessed++;
  const commentSnapshots = await firestore.collection(`${documentSnapshot.ref.path}/comments`).get();
  for (const commentSnapshot of commentSnapshots.docs) {
    await processComment(documentSnapshot, commentSnapshot.id, commentSnapshot.data());
  }
}

// --- Query modes ---

const documentCollection = firestore.collection(documentsPath);

async function exportByContextIds() {
  for (const contextId of args.contextIds) {
    console.log(`--- Querying documents for context_id ${contextId}`);
    const documentSnapshots = await documentCollection.where("context_id", "==", contextId).get();
    console.log(`    Found ${documentSnapshots.size} documents`);
    for (const documentSnapshot of documentSnapshots.docs) {
      await processDocumentComments(documentSnapshot);
    }
  }
}

async function exportByDocumentKeys() {
  for (let i = 0; i < args.documentKeys.length; i += inQueryLimit) {
    const keyBatch = args.documentKeys.slice(i, i + inQueryLimit);
    console.log(`--- Querying documents with keys ${keyBatch.join(", ")}`);
    const documentSnapshots = await documentCollection.where("key", "in", keyBatch).get();
    for (const documentSnapshot of documentSnapshots.docs) {
      await processDocumentComments(documentSnapshot);
    }
  }
}

async function exportByCommenterUids() {
  // Collection-group query across all `comments` subcollections, post-filtered
  // to the requested portal/demo root via the document path.
  console.log(`--- Collection-group query for commenter uids ${args.commenterUids.join(", ")}`);
  const documentCache: Record<string, admin.firestore.DocumentSnapshot> = {};
  for (let i = 0; i < args.commenterUids.length; i += inQueryLimit) {
    const uidBatch = args.commenterUids.slice(i, i + inQueryLimit);
    let commentSnapshots;
    try {
      commentSnapshots = await firestore.collectionGroup("comments").where("uid", "in", uidBatch).get();
    } catch (error: any) {
      if (error?.code === GrpcStatus.FAILED_PRECONDITION) {  // missing index
        console.error("\nThis query needs a collection-group index on `uid` for `comments`.");
        console.error("Firestore's error below should include a link that creates it:\n");
      }
      throw error;
    }
    console.log(`    Found ${commentSnapshots.size} comments (before path/date filtering)`);
    for (const commentSnapshot of commentSnapshots.docs) {
      const documentRef = commentSnapshot.ref.parent.parent;
      if (!documentRef || !`${documentRef.path}/`.startsWith(`${documentsPath}/`)) continue;
      if (!documentCache[documentRef.path]) {
        documentCache[documentRef.path] = await documentRef.get();
        documentsProcessed++;
      }
      await processComment(documentCache[documentRef.path], commentSnapshot.id, commentSnapshot.data());
    }
  }
}

if (args.contextIds.length) {
  await exportByContextIds();
}
if (args.documentKeys.length) {
  await exportByDocumentKeys();
}
if (!args.contextIds.length && !args.documentKeys.length) {
  await exportByCommenterUids();
}

// --- Output ---

const csvLines = [header, ...rows].map(row =>
  row.map(value => csvEscape(neutralizeCsvInjection(String(value)))).join(","));
fs.writeFileSync(args.out, `${csvLines.join("\n")}\n`);

const endTime = Date.now();
console.log(`***** End script *****`);
console.log(`- Total time: ${prettyDuration(endTime - startTime)}`);
console.log(`+ Documents processed: ${documentsProcessed}`);
console.log(`+ Comments scanned: ${commentsProcessed}`);
console.log(`+ Comments matching filters: ${commentsIncluded}`);
console.log(`+ Untagged comments${args.includeUntagged ? " (included)" : " (skipped)"}: ${untaggedComments}`);
console.log(`+ CSV rows written: ${tagRowsEmitted}`);
console.log(`*** Export saved to ${args.out} ***`);

process.exit(0);
