/*
READ-ONLY survey of one class's CLUE documents and their AI-analysis history.

For each document the class's Firestore metadata knows about, this fetches the document's actual
content from the Firebase Realtime Database, classifies what it holds (tile types, text volume,
drawing objects, Dataflow size), and joins it against the AI analysis queues (`analysis/queue/done`
and the failure queues) plus Ada Insight's comments — so one run answers both "what is really in
these documents?" and "which of them has the production pipeline already evaluated, and what did
it say?".

Output: stdout gets a compact report — per-document facts, a per-document category distribution
across its done records, and failure reasons. The full detail (every done record, every AI comment
text) goes to the file named by --out. Everything either output derives from is real teacher/student
work, so both --out and --export are refused outside the repo's canonical ignored artifact root,
scripts/ai-harness/data/.

Setup: a service account key at scripts/serviceAccountKey.json (see scripts/README.md), or
GOOGLE_APPLICATION_CREDENTIALS pointing at one.

Run from the scripts directory:
  npx tsx survey-class-documents.ts <context_id>
  npx tsx survey-class-documents.ts <context_id> [--verbose]     # full detail on stdout too (long!)
  npx tsx survey-class-documents.ts <context_id> [--out <file>]  # full detail to a file
  npx tsx survey-class-documents.ts <context_id> [--export <dir>]  # ALSO writes corpus source files

The context id can also come from SURVEY_CONTEXT_ID in the environment (e.g. via scripts/.env) —
it is an identifier for real people's work, so it is never committed as a default in here.

--export writes every non-empty document's content as <dir>/documents/<id>.json plus
<dir>/key-map.json. The ids are deliberately opaque (`p<investigation>-<problem>-<hash>`, the hash
being the first 8 hex characters of sha256 of the document key): they become corpus filenames,
envelope paths, results-file columns and review-report headings, so they carry no portal uid and no
document-key fragment — that provenance lives only in key-map.json, which stays under the gitignored
data root with everything else. Hashing the key rather than counting positions is what makes an id
mean the same document across re-exports, including one taken after the class gains documents.
key-map.json is the input to `harness.ts import --source production --production-data-approved` and
then `apply-key-map.ts`.
*/

import crypto from "crypto";
import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { kAnalyzerUserParams } from "../shared/shared.js";
import { getFirebaseBasePath, getFirestoreBasePath, getScriptRootFilePath } from "./lib/script-utils.js";
import { isContainedBy } from "./ai-harness/src/files.js";
import { classifyDocument } from "../shared/ai-analysis-classify.js";

const kPortal = "learn.concord.org";
const kFirestoreDocuments = getFirestoreBasePath(kPortal);
const kDatabaseClasses = getFirebaseBasePath(kPortal);
const kDatabaseUrl = "https://collaborative-learning-ec215.firebaseio.com";
/** Everything derived from real documents stays inside the harness's gitignored data tree. */
const kDataRoot = getScriptRootFilePath("ai-harness/data");

// --- Arguments --------------------------------------------------------------

/**
 * Both output options land real work on disk, so both are held to the harness's rule (see
 * `resolveDataPath` in scripts/ai-harness/harness.ts): nothing derived from student or teacher
 * documents is ever written outside scripts/ai-harness/data/. Without this, `--export .` from the
 * scripts directory would write real documents into a tracked directory.
 */
function resolveInsideDataRoot(flag: string, value: string): string {
  const resolved = path.resolve(value);
  if (!isContainedBy(resolved, kDataRoot)) {
    console.error(`${flag} must point inside ${kDataRoot} — this output derives from real ` +
      "teacher/student work and never leaves the gitignored data tree. " +
      `Got: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

let verbose = false;
let outFile: string | undefined;
let exportDir: string | undefined;
// Always explicit: a class's context id is an identifier for real people's work, so it belongs in
// the operator's command line or environment (e.g. exported from the gitignored scripts/.env),
// never committed as a default.
let contextId: string | undefined = process.env.SURVEY_CONTEXT_ID;
let positionalContextId: string | undefined;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--verbose") {
    verbose = true; continue;
  }
  if (argv[i] === "--out") {
    const value = argv[i + 1];
    i++;
    if (!value || value.startsWith("--")) {
      console.error("--out requires a file path, e.g. --out ai-harness/data/surveys/class.txt");
      process.exit(1);
    }
    outFile = resolveInsideDataRoot("--out", value);
    continue;
  }
  if (argv[i] === "--export") {
    const value = argv[i + 1];
    i++;
    if (!value || value.startsWith("--")) {
      console.error("--export requires a directory, e.g. --export ai-harness/data/exports/class");
      process.exit(1);
    }
    exportDir = resolveInsideDataRoot("--export", value);
    continue;
  }
  // Only a bare token can be the context id. Anything flag-shaped is a mistake (a typo'd flag,
  // say), and silently surveying it as a class would waste a run and read as "the class is empty".
  if (argv[i].startsWith("-")) {
    console.error(`Unknown flag "${argv[i]}".`);
    process.exit(1);
  }
  if (positionalContextId !== undefined) {
    console.error(`Unexpected second argument "${argv[i]}" — the context id is already "${positionalContextId}".`);
    process.exit(1);
  }
  positionalContextId = argv[i];
}
if (positionalContextId !== undefined) contextId = positionalContextId;
if (!contextId) {
  console.error("Usage: npx tsx survey-class-documents.ts <context_id> [--verbose] [--out <file>] " +
    "[--export <dir>]");
  console.error("(or set SURVEY_CONTEXT_ID in the environment)");
  process.exit(1);
}

// Credentials are checked after the arguments: a run that would die on usage anyway should say so,
// not complain about a missing key first.
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || getScriptRootFilePath("serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error(`No service account key found at ${keyPath}.`);
  console.error("Download one per scripts/README.md, or set GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(keyPath), databaseURL: kDatabaseUrl });
const firestore = admin.firestore();

/*
Two-level reporting. `out` lines appear on stdout and in the file; `detail` lines always land in
the file but reach stdout only with --verbose. The file therefore always holds the complete record
regardless of what the terminal showed — terminal scrollback is not the archive.
*/
const fileLines: string[] = [];
function out(line = "") {
  console.log(line);
  fileLines.push(line);
}
function detail(line = "") {
  if (verbose) console.log(line);
  fileLines.push(line);
}

// ---------------------------------------------------------------------------
// Content volume (deliberately defensive: real documents are messy)
// ---------------------------------------------------------------------------

/** Volume counters for the report. Modality is not among them; `classifyDocument` answers that. */
interface DocumentFacts {
  tileCounts: Record<string, number>;
  /** Trimmed length of student-visible text across Text tiles (best effort for slate format). */
  textChars: number;
  drawingObjects: number;
  drawingTextObjects: number;
  /** Best-effort count of Dataflow program nodes/blocks across Dataflow tiles. */
  dataflowNodes: number;
}

/** The slices of tile content the classifier reads. Real content carries far more; it is ignored. */
interface TileContentLike {
  type?: unknown;
  text?: unknown;
  format?: unknown;
  objects?: unknown;
  program?: {nodes?: unknown};
  nodes?: unknown;
}
interface TileLike { content?: TileContentLike }

/**
 * Extract readable text from a Text tile's content without depending on the slate libraries.
 * @param {TileContentLike|undefined} content The Text tile's content object.
 * @return {string} The tile's readable text, trimmed; "" when there is none.
 */
function textOfTextTile(content: TileContentLike | undefined): string {
  const text = content?.text;
  if (typeof text !== "string") return "";
  if (content?.format === "slate") {
    // Slate JSON: pull every "text" string value out rather than parsing the structure.
    try {
      const parsed = JSON.parse(text);
      const pieces: string[] = [];
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const record = node as Record<string, unknown>;
        if (typeof record.text === "string") pieces.push(record.text);
        for (const value of Object.values(record)) {
          if (Array.isArray(value)) value.forEach(walk);
          else if (value && typeof value === "object") walk(value);
        }
      };
      walk(parsed);
      return pieces.join(" ").trim();
    } catch {
      return text.trim();
    }
  }
  return text.trim();
}

/**
 * Count what one document's tiles hold, for the report's volume figures.
 *
 * Modality is NOT decided here — `classifyDocument` in `shared/ai-analysis-classify.ts` answers
 * that, and it is the only answer this file uses (see `main`). It walks rowOrder/rowMap rather than
 * the flat tileMap, so it skips section headers and tiles no row references, and it treats a
 * Question tile's first row as the authored prompt rather than as student work. A tally over
 * tileMap cannot see any of that, so a modality computed here would disagree with the corpus the
 * export feeds — which is the whole point of importing the harness's classifier instead.
 *
 * The counters below stay local because the classifier does not produce them: it answers
 * yes/no per tile, while the report wants "how much" (characters of prose, drawing objects,
 * Dataflow blocks) to tell a one-line answer from a worked-out one.
 * @param {unknown} content The document's parsed content JSON (shape unknown; read defensively).
 * @return {DocumentFacts} The volume counters the survey reports.
 */
function countTileContent(content: unknown): DocumentFacts {
  const facts: DocumentFacts = {
    tileCounts: {}, textChars: 0, drawingObjects: 0, drawingTextObjects: 0, dataflowNodes: 0,
  };
  const tileMap = (content as {tileMap?: Record<string, TileLike>} | null | undefined)?.tileMap ?? {};
  for (const tile of Object.values(tileMap)) {
    const rawType = tile?.content?.type;
    const type = typeof rawType === "string" ? rawType : "Unknown";
    facts.tileCounts[type] = (facts.tileCounts[type] ?? 0) + 1;

    if (type === "Text") {
      facts.textChars += textOfTextTile(tile.content).length;
      continue;
    }
    if (type === "Drawing") {
      const rawObjects = tile.content?.objects;
      const objects: {type?: unknown; text?: unknown}[] = Array.isArray(rawObjects) ? rawObjects : [];
      facts.drawingObjects += objects.length;
      for (const object of objects) {
        if (object?.type === "text" && typeof object.text === "string" && object.text.trim()) {
          facts.drawingTextObjects++;
        }
      }
      continue;
    }
    if (type === "Dataflow") {
      // The program's block list lives at content.program.nodes (an object keyed by id) in current
      // content; fall back to any nodes-like object so an older shape still counts as present.
      const nodes = tile.content?.program?.nodes ?? tile.content?.nodes;
      facts.dataflowNodes += nodes && typeof nodes === "object" ? Object.keys(nodes).length : 0;
    }
  }
  return facts;
}

// ---------------------------------------------------------------------------
// AI-analysis history
// ---------------------------------------------------------------------------

interface AnalysisRecord {
  status: string;
  summarizer?: string;
  evaluator?: string;
  completedAt?: string;
  promptTokens?: number;
  completionTokens?: number;
  category?: string;
  docSummaryChars?: number;
  /** The failure queues record the error message that landed the document there. */
  error?: string;
}

/**
 * Pull the parsed category back out of a stored `fullResponse` completion, best effort.
 *
 * Category only: what production *said* to the teacher is Ada's actual comment, which the survey
 * reads from the comments collection rather than reconstructing from the response.
 * @param {unknown} fullResponse The raw completion JSON string a done-queue record stores.
 * @return {string|undefined} The category, where the response carried one.
 */
function parseCategory(fullResponse: unknown): string | undefined {
  if (typeof fullResponse !== "string" || fullResponse.length === 0) return undefined;
  try {
    const completion = JSON.parse(fullResponse);
    const category = completion?.choices?.[0]?.message?.parsed?.category;
    return typeof category === "string" ? category : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Turn one queue snapshot into an AnalysisRecord.
 * @param {string} status The queue name the record came from.
 * @param {FirebaseFirestore.DocumentData} data The record's fields.
 * @return {AnalysisRecord} The slice of it the survey reports.
 */
function toRecord(status: string, data: FirebaseFirestore.DocumentData): AnalysisRecord {
  return {
    status,
    summarizer: data.summarizer,
    evaluator: data.evaluator,
    completedAt: data.completedAt?.toDate?.()?.toISOString?.()?.slice(0, 16),
    promptTokens: data.promptTokens,
    completionTokens: data.completionTokens,
    docSummaryChars: typeof data.docSummary === "string" ? data.docSummary.length : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    category: parseCategory(data.fullResponse),
  };
}

/** Split an array into chunks; Firestore caps `in` queries at 30 values and batches reads. */
function chunked<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

/**
 * The class's records from one analysis queue, WITHOUT scanning the whole collection: the queues
 * are shared across every class and portal and grow without bound, so an unfiltered `.get()` reads
 * (and bills) the world to keep one class.
 *
 * Auto-id queues (`done`, and the failure queues in current production) carry the document key in
 * a `documentId` field and are queried with `in` filters. Queues keyed by the document key itself
 * (`pending`, `imaged` — and the failure queues in older data) are fetched directly by reference.
 * The failure queues are read both ways and de-duplicated by path, so either vintage is found.
 * @param {string} status The queue name under analysis/queue/.
 * @param {string[]} keys The class's document keys.
 * @param {"documentId"|"key"|"both"} addressing How this queue names its documents.
 * @return {Promise<Map<string, AnalysisRecord[]>>} Records per document key.
 */
async function fetchQueueRecords(status: string, keys: string[],
  addressing: "documentId" | "key" | "both"): Promise<Map<string, AnalysisRecord[]>> {
  const byKey = new Map<string, AnalysisRecord[]>();
  const seenPaths = new Set<string>();
  const add = (refPath: string, key: string, data: FirebaseFirestore.DocumentData) => {
    if (seenPaths.has(refPath)) return;
    seenPaths.add(refPath);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(toRecord(status, data));
  };
  const collection = firestore.collection(`analysis/queue/${status}`);
  if (addressing !== "key") {
    for (const chunk of chunked(keys, 30)) {
      const snapshot = await collection.where("documentId", "in", chunk).get();
      snapshot.forEach((doc) => add(doc.ref.path, doc.data().documentId, doc.data()));
    }
  }
  if (addressing !== "documentId") {
    for (const chunk of chunked(keys, 100)) {
      const snapshots = await firestore.getAll(...chunk.map((key) => collection.doc(key)));
      for (const snapshot of snapshots) {
        if (snapshot.exists) add(snapshot.ref.path, snapshot.id, snapshot.data()!);
      }
    }
  }
  return byKey;
}

/**
 * "advancedUse 44, unknown 12, …" — counts of a field's values, most common first.
 * @param {(string|undefined)[]} values The field's values, one per record; undefined counts as "(none)".
 * @return {string} The formatted counts line.
 */
function distribution(values: (string | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value ?? "(none)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${value} ${count}`).join(", ");
}

/**
 * Lowercase, non-alphanumerics to dashes, collapsed — the shape `harness import` requires.
 * @param {string} value The raw string to slugify.
 * @return {string} The slug; "x" when nothing survives.
 */
function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

/**
 * The document ids a previous export left in `dir`, according to its key map.
 *
 * Empty when there is no key map or none this script recognises — which is the signal that whatever
 * is in the directory was not put there by an export, and so is not this script's to delete.
 * @param {string} dir The --export directory.
 * @return {Set<string>} The previous export's ids.
 */
function previousExportIds(dir: string): Set<string> {
  const keyMapFile = path.join(dir, "key-map.json");
  if (!fs.existsSync(keyMapFile)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(keyMapFile, "utf8"));
    if (parsed?.schemaVersion !== 1 || typeof parsed?.documents !== "object" ||
        parsed.documents === null) {
      return new Set();
    }
    return new Set(Object.keys(parsed.documents));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  out(`Surveying class ${contextId} in ${kFirestoreDocuments} — ${new Date().toISOString()}`);
  out("This report names document keys, user ids and author-entered titles from real class work.");
  out("Treat it like the data it describes: keep copies under scripts/ai-harness/data/ (gitignored)");
  out("and do not paste it into tickets, chat, or anything else that persists.");
  out();

  // 1. The class's document metadata, from Firestore.
  const metadataSnapshot = await firestore.collection(kFirestoreDocuments)
    .where("context_id", "==", contextId).get();
  if (metadataSnapshot.empty) {
    out("No document metadata found for that context_id.");
    return;
  }
  interface MetaDoc {
    id: string; key: string; uid: string; unit?: string;
    investigation?: string; problem?: string; createdAt?: number; title?: string;
  }
  const metaDocs: MetaDoc[] = [];
  metadataSnapshot.forEach((doc) => {
    const data = doc.data();
    if (typeof data.key !== "string" || typeof data.uid !== "string") return;
    metaDocs.push({
      id: doc.id, key: data.key, uid: data.uid, unit: data.unit,
      investigation: data.investigation, problem: data.problem,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : undefined,
      title: typeof data.title === "string" ? data.title : undefined,
    });
  });
  const units = [...new Set(metaDocs.map((doc) => doc.unit).filter(Boolean))];
  out(`Metadata: ${metaDocs.length} document(s); unit(s): ${units.join(", ") || "?"}; ` +
    `${new Set(metaDocs.map((doc) => doc.uid)).size} distinct user(s).`);

  // 2. The class's actual document content, from the Realtime Database — one subtree fetch.
  const usersSnapshot = await admin.database().ref(`${kDatabaseClasses}/${contextId}/users`).once("value");
  const users = usersSnapshot.val() ?? {};
  const contentByKey = new Map<string, unknown>();
  let unparseable = 0;
  const userRecords = users as Record<string, {documents?: Record<string, {content?: unknown}>}>;
  for (const user of Object.values(userRecords)) {
    for (const [docKey, doc] of Object.entries(user?.documents ?? {})) {
      if (typeof doc?.content !== "string") continue;
      try {
        contentByKey.set(docKey, JSON.parse(doc.content));
      } catch {
        unparseable++;
      }
    }
  }
  out(`Realtime database: ${contentByKey.size} document(s) with content` +
    `${unparseable ? `; ${unparseable} unparseable` : ""}.`);
  out();

  // 3. AI-analysis history for exactly these documents — filtered queries, never a full scan.
  const keys = [...new Set(metaDocs.map((doc) => doc.key))];
  const keySet = new Set(keys);
  const queues = [
    { status: "done", addressing: "documentId" },
    { status: "failedAnalyzing", addressing: "both" },
    { status: "failedImaging", addressing: "both" },
    { status: "pending", addressing: "key" },
    { status: "imaged", addressing: "key" },
  ] as const;
  const history = new Map<string, AnalysisRecord[]>();
  for (const { status, addressing } of queues) {
    const records = await fetchQueueRecords(status, keys, addressing);
    for (const [key, list] of records) {
      if (!history.has(key)) history.set(key, []);
      history.get(key)!.push(...list);
    }
  }

  // Ada's actual comments — the text production really showed the teacher (covers evaluations
  // whose queue records were cleaned up).
  //
  // Addressed by the REALTIME-DATABASE KEY, not by the Firestore metadata document's id: production
  // writes to `documents/<key>/comments` (the commentsPath built in on-analyzable-doc-written.ts),
  // and CLUE's own client reads the same simple path. The two ids are equal for a consolidated
  // metadata document and differ for the legacy `[network]_[key]` and `uid:[user]_[key]` ones that
  // scripts/check-metadata-doc-ids.ts exists to find — where reading by metadata id finds nothing
  // and reports "0 Ada comments" for a document production really did comment on. The metadata id
  // is read as well when it differs, so a comment sitting under the older address is still found.
  // Chunked so the reads overlap without hammering Firestore.
  const adaComments = new Map<string, string[]>();
  const adaCommentsUnder = async (documentId: string): Promise<string[]> => {
    const comments = await firestore.collection(`${kFirestoreDocuments}/${documentId}/comments`)
      .where("uid", "==", kAnalyzerUserParams.id).get();
    const texts: string[] = [];
    comments.forEach((comment) => {
      const content = comment.data().content;
      texts.push(typeof content === "string" ? content : "(non-text comment)");
    });
    return texts;
  };
  for (const chunk of chunked(metaDocs, 10)) {
    await Promise.all(chunk.map(async (meta) => {
      const addresses = meta.id === meta.key ? [meta.key] : [meta.key, meta.id];
      const texts = (await Promise.all(addresses.map(adaCommentsUnder))).flat();
      if (texts.length > 0) adaComments.set(meta.key, texts);
    }));
  }

  // 4. Per-document report, grouped by investigation.problem.
  const byProblem = new Map<string, MetaDoc[]>();
  for (const meta of metaDocs) {
    const problem = `${meta.investigation ?? "?"}.${meta.problem ?? "?"}`;
    if (!byProblem.has(problem)) byProblem.set(problem, []);
    byProblem.get(problem)!.push(meta);
  }

  const modalityTotals: Record<string, number> = {};
  let missingContent = 0; let evaluatedDocs = 0;
  const exportDocs: { meta: MetaDoc; content: unknown; modality: string }[] = [];

  for (const [problem, docs] of [...byProblem.entries()].sort()) {
    out(`=== ${problem} — ${docs.length} document(s) ===`);
    for (const meta of docs) {
      const content = contentByKey.get(meta.key);
      if (!content) {
        missingContent++;
        out(`  * ${meta.key} uid=${meta.uid} — NO CONTENT FOUND in realtime database`);
        continue;
      }
      const facts = countTileContent(content);
      // The harness's own classifier, so the survey's answer and the corpus's `computedModality`
      // for the same document are the same answer rather than two that usually agree.
      const modality = classifyDocument(content).computedModality;
      modalityTotals[modality] = (modalityTotals[modality] ?? 0) + 1;
      if (exportDir && modality !== "empty") {
        exportDocs.push({ meta, content, modality });
      }

      const tiles = Object.entries(facts.tileCounts).map(([type, n]) => `${type}:${n}`).join(" ");
      const records = history.get(meta.key) ?? [];
      const comments = adaComments.get(meta.key) ?? [];
      if (records.length || comments.length) evaluatedDocs++;

      out(`  * ${meta.key} uid=${meta.uid}${meta.title ? ` "${meta.title}"` : ""}`);
      out(`      ${modality}; text ${facts.textChars} chars; drawing ${facts.drawingObjects} ` +
        `objects (${facts.drawingTextObjects} text); dataflow ${facts.dataflowNodes} blocks; ` +
        `tiles: ${tiles || "(none)"}`);
      if (records.length || comments.length) {
        const doneRecords = records.filter((record) => record.status === "done");
        const failures = records.filter((record) => record.status.startsWith("failed"));
        const waiting = records.length - doneRecords.length - failures.length;
        out(`      AI: ${doneRecords.length} done, ${failures.length} failed, ` +
          `${waiting} waiting; ${comments.length} Ada comment(s)`);
        if (doneRecords.length > 0) {
          // The rollup is the compact view; the record-by-record detail goes to the file.
          out(`      categories over ${doneRecords.length} done: ` +
            distribution(doneRecords.map((record) => record.category)));
          const summaryLengths = new Set(doneRecords.map((record) => record.docSummaryChars));
          out(`      distinct summary lengths: ${summaryLengths.size}` +
            (summaryLengths.size <= 4 ?
              ` (${[...summaryLengths].map((chars) => `${chars ?? "?"} chars`).join(", ")})` : ""));
        }
        if (failures.length > 0) {
          out(`      failure reasons: ${distribution(failures.map((record) =>
            (record.error ?? "(no error recorded)").slice(0, 160)))}`);
        }
        for (const record of doneRecords) {
          detail(`        [${record.completedAt ?? "?"}] ${record.summarizer ?? "?"}/` +
            `${record.evaluator ?? "?"} tokens ${record.promptTokens ?? "?"}+` +
            `${record.completionTokens ?? "?"} summary ${record.docSummaryChars ?? "-"} chars ` +
            `category=${record.category ?? "?"}`);
        }
        // What the teacher actually saw, verbatim from the comments collection — not rebuilt from
        // the stored model response.
        for (const text of comments) {
          detail(`        Ada: "${text}"`);
        }
      }
    }
    out();
  }

  // 5. Rollup.
  out("=== Summary ===");
  out(`Documents with metadata: ${metaDocs.length}; content found: ` +
    `${metaDocs.length - missingContent}; missing content: ${missingContent}`);
  out(`Modality (from actual content): ${Object.entries(modalityTotals)
    .map(([modality, count]) => `${count} ${modality}`).join("; ")}`);
  out(`Documents with any AI-analysis history (queues or Ada comments): ${evaluatedDocs}`);
  const allDone = [...history.values()].flat().filter((record) => record.status === "done");
  out(`Done records in total: ${allDone.length}; categories overall: ` +
    distribution(allDone.map((record) => record.category)));
  const rtdbOnly = [...contentByKey.keys()].filter((key) => !keySet.has(key));
  if (rtdbOnly.length) {
    out(`Note: ${rtdbOnly.length} realtime-database document(s) in this class have no ` +
      "Firestore metadata (personal docs, learning logs, or pre-metadata documents) — not surveyed.");
  }

  if (exportDir) {
    const documentsDir = path.join(exportDir, "documents");
    const mapEntries: Record<string, { key: string; uid: string; unit: string | null;
      investigation: string | null; problem: string | null; modality: string }> = {};
    // Opaque ids: the problem, plus a hash of the document key. The id becomes a corpus filename,
    // an envelope path and a results-file column, so the uid and the key itself stay out of it —
    // key-map.json is the only place holding that mapping, and it stays inside the gitignored data
    // root. A firebase push key holds far more entropy than the 32 bits kept here, so an id on its
    // own does not lead back to the key it was made from.
    //
    // Derived from the key rather than from a position in a sorted list, because the id has to mean
    // the same document forever. A counter is stable only while the class's document set is: add
    // one document that sorts earlier and every later id in that problem shifts by one, silently
    // re-pointing each id at a different student's work. That would survive a re-import — import
    // carries a previous manifest's `labels` forward and apply-key-map.ts fills only nulls — so the
    // corpus would keep the old sourceKey and sourceUid against the new content. Re-exporting after
    // a class gains documents is the expected workflow, not a hypothetical.
    const ordered = [...exportDocs].sort((a, b) =>
      `${a.meta.investigation}.${a.meta.problem}.${a.meta.key}`
        .localeCompare(`${b.meta.investigation}.${b.meta.problem}.${b.meta.key}`));
    // One exported document per KEY, not per metadata record. A class can hold two metadata
    // documents describing one document — a legacy `[network]_[key]` or `uid:[user]_[key]` record
    // alongside the consolidated one, which is what scripts/check-metadata-doc-ids.ts looks for —
    // and both name the same realtime-database content. Exporting both would put one student's work
    // into the corpus twice. Where the duplicates disagree about the document's problem the two
    // would even get different ids, so which problem it landed under would be decided by sort
    // order. The first in sorted order wins and the disagreement is reported: it is a metadata
    // problem for the operator to look at, not something to settle silently here.
    const describeRecord = (record: MetaDoc) =>
      `${record.investigation ?? "?"}.${record.problem ?? "?"} uid=${record.uid} ` +
      `(metadata ${record.id})`;
    const byKey = new Map<string, typeof ordered[number]>();
    for (const entry of ordered) {
      const first = byKey.get(entry.meta.key);
      if (!first) {
        byKey.set(entry.meta.key, entry);
        continue;
      }
      if (first.meta.investigation !== entry.meta.investigation ||
          first.meta.problem !== entry.meta.problem || first.meta.uid !== entry.meta.uid) {
        out(`Note: document ${entry.meta.key} has two metadata records that disagree — ` +
          `${describeRecord(first.meta)} vs ${describeRecord(entry.meta)}. Exported once, ` +
          "under the first.");
      }
    }
    const unique = [...byKey.values()];

    // Every id is assigned before anything is written. Two keys hashing alike inside one problem is
    // vanishingly unlikely, but the second document would overwrite the first in silence, so it
    // refuses — and refusing before the first write is what lets it say the export did not happen.
    const idOf = new Map<string, string>();
    const claimedBy = new Map<string, string>();
    for (const { meta } of unique) {
      const base = `p${slugify(meta.investigation ?? "x")}-${slugify(meta.problem ?? "x")}`;
      const id = `${base}-${crypto.createHash("sha256").update(meta.key).digest("hex").slice(0, 8)}`;
      const claimant = claimedBy.get(id);
      if (claimant !== undefined && claimant !== meta.key) {
        console.error(`Export id ${id} is claimed by two different document keys. Nothing was ` +
          "written. Widen the hash in survey-class-documents.ts and re-run.");
        process.exit(1);
      }
      claimedBy.set(id, meta.key);
      idOf.set(meta.key, id);
    }

    // A re-export into a directory that already holds one must not leave the old files there.
    // `harness.ts import` reads EVERY .json under documents/, so a leftover becomes a corpus
    // document that no key map mentions: its provenance stays null forever, and after an id-format
    // change the same student document is imported twice, once under each id.
    //
    // Only files the previous key map claims are removed. Anything else means this is not an export
    // directory — a corpus, say — and deleting from it is not this script's business.
    if (fs.existsSync(documentsDir)) {
      const previous = previousExportIds(exportDir);
      const present = fs.readdirSync(documentsDir).filter((name) => name.endsWith(".json"));
      const unknown = present.filter((name) => !previous.has(path.basename(name, ".json")));
      if (unknown.length > 0) {
        console.error(`${documentsDir} holds ${unknown.length} .json file(s) that no key map ` +
          `here accounts for (${unknown.slice(0, 3).join(", ")}${unknown.length > 3 ? ", …" : ""}). ` +
          "Nothing was written. Export to a new directory, or empty this one yourself.");
        process.exit(1);
      }
      for (const name of present) fs.rmSync(path.join(documentsDir, name));
      if (present.length > 0) {
        out(`Replacing a previous export: removed ${present.length} document(s) from ${documentsDir}.`);
      }
    }

    fs.mkdirSync(documentsDir, { recursive: true });
    for (const { meta, content, modality } of unique) {
      const id = idOf.get(meta.key)!;
      fs.writeFileSync(path.join(documentsDir, `${id}.json`), JSON.stringify(content, null, 2) + "\n");
      mapEntries[id] = {
        key: meta.key, uid: meta.uid, unit: meta.unit ?? null,
        investigation: meta.investigation ?? null, problem: meta.problem ?? null,
        modality,
      };
    }
    fs.writeFileSync(path.join(exportDir, "key-map.json"), JSON.stringify({
      schemaVersion: 1,
      contextId,
      portal: kPortal,
      exportedAt: new Date().toISOString(),
      documents: mapEntries,
    }, null, 2) + "\n");
    console.log(`\nExported ${unique.length} non-empty document(s) to ${documentsDir}` +
      (unique.length === exportDocs.length
        ? ""
        : ` (${exportDocs.length - unique.length} duplicate metadata record(s) collapsed)`));
    console.log(`Key map written to ${path.join(exportDir, "key-map.json")}`);
    const harnessRelative = path.relative(getScriptRootFilePath("ai-harness"), exportDir);
    console.log("Next: cd ai-harness && npx tsx harness.ts import --from " +
      `${harnessRelative} --corpus <name> --source production --production-data-approved`);
    console.log(`Then: npx tsx apply-key-map.ts --corpus <name> --key-map ${harnessRelative}/key-map.json`);
  }

  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fileLines.join("\n") + "\n");
    console.log(`\nFull report (every done record and AI comment) written to ${outFile}`);
  } else if (!verbose) {
    console.log("\nPer-record detail and comment texts were omitted from the terminal. " +
      "Use --out <file> for the full report (recommended over --verbose: terminal scrollback " +
      "is not an archive), e.g. --out ai-harness/data/surveys/class.txt");
  }
}

main()
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Closing the app releases the Firestore/RTDB connections so the process exits on its own once
    // stdout has drained — a hard process.exit() here could truncate a report piped to a file.
    await admin.app().delete();
  });
