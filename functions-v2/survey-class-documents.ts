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
text) goes to the file named by --out. Everything in that file derives from real teacher/student
work, so keep it inside the repo's canonical ignored artifact root:

  npx tsx survey-class-documents.ts --out ../scripts/ai-harness/data/surveys/teacher-workshop.txt

Setup: a service account key at scripts/serviceAccountKey.json (see scripts/README.md), or
GOOGLE_APPLICATION_CREDENTIALS pointing at one.

Run from the functions-v2 directory:
  npx tsx survey-class-documents.ts <context_id>
  npx tsx survey-class-documents.ts [--verbose]     # full detail on stdout too (long!)
  npx tsx survey-class-documents.ts [--out <file>]  # full detail to a file; stdout stays compact
  npx tsx survey-class-documents.ts [--export <dir>]  # ALSO writes corpus source files (see below)

--export writes every non-empty document's content as <dir>/documents/<id>.json (ids shaped
p<investigation>-<problem>-u<uid>-<key fragment>, valid for `harness import`) plus
<dir>/key-map.json mapping each id back to its realtime-database key, owner uid, and problem —
the input to `harness.ts import --source production --production-data-approved` and then
`apply-key-map.ts`. This is real teacher/student work landing on disk: point --export inside
scripts/ai-harness/data/ (gitignored), e.g. --export ../scripts/ai-harness/data/exports/teacher-workshop
*/

import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import admin from "firebase-admin";

const kPortal = "learn_concord_org";
const kFirestoreRoot = `authed/${kPortal}`;
const kDatabaseRoot = `/authed/portals/${kPortal}/classes`;
const kDatabaseUrl = "https://collaborative-learning-ec215.firebaseio.com";
const kAdaUid = "ada_insight_1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, "../scripts/serviceAccountKey.json");

if (!fs.existsSync(keyPath)) {
  console.error(`No service account key found at ${keyPath}.`);
  console.error("Download one per scripts/README.md, or set GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

admin.initializeApp({credential: admin.credential.cert(keyPath), databaseURL: kDatabaseUrl});
const firestore = admin.firestore();

// --- Arguments --------------------------------------------------------------

let verbose = false;
let outFile: string | undefined;
let exportDir: string | undefined;
let contextId: string | undefined = process.env.SURVEY_CONTEXT_ID;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--verbose") {
    verbose = true; continue;
  }
  if (argv[i] === "--out") {
    outFile = argv[i + 1];
    i++;
    if (!outFile || outFile.startsWith("--")) {
      console.error("--out requires a file path, e.g. --out ../scripts/ai-harness/data/surveys/x.txt");
      process.exit(1);
    }
    continue;
  }
  if (argv[i] === "--export") {
    exportDir = argv[i + 1];
    i++;
    if (!exportDir || exportDir.startsWith("--")) {
      console.error("--export requires a directory, e.g. " +
        "--export ../scripts/ai-harness/data/exports/teacher-workshop");
      process.exit(1);
    }
    continue;
  }
  // Only a bare token can be the context id. Anything flag-shaped is a mistake (a typo'd flag,
  // say), and silently surveying it as a class would waste a run and read as "the class is empty".
  if (argv[i].startsWith("-")) {
    console.error(`Unknown flag "${argv[i]}".`);
    process.exit(1);
  }
  if (contextId && contextId !== process.env.SURVEY_CONTEXT_ID) {
    console.error(`Unexpected second argument "${argv[i]}" — the context id is already "${contextId}".`);
    process.exit(1);
  }
  contextId = argv[i];
}
if (!contextId) {
  console.error("Usage: npx tsx survey-class-documents.ts <context_id> [--verbose] [--out <file>] " +
    "[--export <dir>]");
  console.error("(or set SURVEY_CONTEXT_ID in the environment)");
  process.exit(1);
}

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
// Content classification (deliberately defensive: real documents are messy)
// ---------------------------------------------------------------------------

interface DocumentFacts {
  tileCounts: Record<string, number>;
  /** Trimmed length of student-visible text across Text tiles (best effort for slate format). */
  textChars: number;
  drawingObjects: number;
  drawingTextObjects: number;
  /** Best-effort count of Dataflow program nodes/blocks across Dataflow tiles. */
  dataflowNodes: number;
  hasText: boolean;
  hasVisual: boolean;
  substantiveTiles: number;
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

/** Tile types where a picture carries information text does not (mirrors the harness registry). */
const kVisualTileTypes = new Set([
  "Drawing", "Image", "Graph", "Geometry", "Diagram", "BarGraph", "DataCard", "Numberline",
  "Expression", "Timeline", "WaveRunner", "Simulator", "Dataflow",
]);

/**
 * Classify one document's parsed content: which tiles it holds and what modality they carry.
 * @param {unknown} content The document's parsed content JSON (shape unknown; read defensively).
 * @return {DocumentFacts} The counts and modality facts the survey reports.
 */
function classifyContent(content: unknown): DocumentFacts {
  const facts: DocumentFacts = {
    tileCounts: {}, textChars: 0, drawingObjects: 0, drawingTextObjects: 0,
    dataflowNodes: 0, hasText: false, hasVisual: false, substantiveTiles: 0,
  };
  const tileMap = (content as {tileMap?: Record<string, TileLike>} | null | undefined)?.tileMap ?? {};
  for (const tile of Object.values(tileMap)) {
    const rawType = tile?.content?.type;
    const type = typeof rawType === "string" ? rawType : "Unknown";
    facts.tileCounts[type] = (facts.tileCounts[type] ?? 0) + 1;
    if (type === "Placeholder") continue;

    if (type === "Text") {
      const text = textOfTextTile(tile.content);
      facts.textChars += text.length;
      if (text.length > 0) {
        facts.hasText = true;
        facts.substantiveTiles++;
      }
      continue;
    }
    if (type === "Drawing") {
      const rawObjects = tile.content?.objects;
      const objects: {type?: unknown; text?: unknown}[] = Array.isArray(rawObjects) ? rawObjects : [];
      facts.drawingObjects += objects.length;
      for (const object of objects) {
        if (object?.type === "text" && typeof object.text === "string" && object.text.trim()) {
          facts.drawingTextObjects++;
          facts.hasText = true;
        }
      }
      if (objects.length > 0) {
        facts.hasVisual = true;
        facts.substantiveTiles++;
      }
      continue;
    }
    if (type === "Dataflow") {
      // The program's block list lives at content.program.nodes (an object keyed by id) in current
      // content; fall back to any nodes-like object so an older shape still counts as present.
      const nodes = tile.content?.program?.nodes ?? tile.content?.nodes;
      const nodeCount = nodes && typeof nodes === "object" ? Object.keys(nodes).length : 0;
      facts.dataflowNodes += nodeCount;
      if (nodeCount > 0) {
        facts.hasVisual = true;
        facts.substantiveTiles++;
      }
      continue;
    }
    if (kVisualTileTypes.has(type)) {
      facts.hasVisual = true;
      facts.substantiveTiles++;
      continue;
    }
    // Question, Table, and anything else: substantive if it exists, but modality-neutral here —
    // Question children are separate tileMap entries and classify themselves.
    if (type !== "Question") facts.substantiveTiles++;
  }
  return facts;
}

function modalityOf(facts: DocumentFacts): string {
  if (facts.hasText && facts.hasVisual) return "mixed";
  if (facts.hasText) return "text-only";
  if (facts.hasVisual) return "visual-only";
  return "empty";
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
  commentText?: string;
  docSummaryChars?: number;
  /** The failure queues record the error message that landed the document there. */
  error?: string;
}

/**
 * Pull the parsed categorization back out of a stored `fullResponse` completion, best effort.
 * @param {unknown} fullResponse The raw completion JSON string a done-queue record stores.
 * @return {object} The category and reconstructed comment text, where the response carried them.
 */
function parseFullResponse(fullResponse: unknown): { category?: string; commentText?: string } {
  if (typeof fullResponse !== "string" || fullResponse.length === 0) return {};
  try {
    const completion = JSON.parse(fullResponse);
    const message = completion?.choices?.[0]?.message;
    const parsed = message?.parsed;
    if (!parsed) return {};
    const indicators = Array.isArray(parsed.keyIndicators) && parsed.keyIndicators.length ?
      ` Your work shows: ${parsed.keyIndicators.join(", ")}` : "";
    return {
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      commentText: `${parsed.discussion ?? ""}${indicators}`.trim() || undefined,
    };
  } catch {
    return {};
  }
}

async function fetchQueueRecords(status: string, keys: Set<string>): Promise<Map<string, AnalysisRecord[]>> {
  const byKey = new Map<string, AnalysisRecord[]>();
  const snapshot = await firestore.collection(`analysis/queue/${status}`).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    // done records carry documentId; the waiting/failed queues are keyed by the doc key itself.
    const key = typeof data.documentId === "string" ? data.documentId : doc.id;
    if (!keys.has(key)) return;
    const record: AnalysisRecord = {
      status,
      summarizer: data.summarizer,
      evaluator: data.evaluator,
      completedAt: data.completedAt?.toDate?.()?.toISOString?.()?.slice(0, 16),
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      docSummaryChars: typeof data.docSummary === "string" ? data.docSummary.length : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
      ...parseFullResponse(data.fullResponse),
    };
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(record);
  });
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  out(`Surveying class ${contextId} in ${kFirestoreRoot} — ${new Date().toISOString()}`);
  out();

  // 1. The class's document metadata, from Firestore.
  const metadataSnapshot = await firestore.collection(`${kFirestoreRoot}/documents`)
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
  const usersSnapshot = await admin.database().ref(`${kDatabaseRoot}/${contextId}/users`).once("value");
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

  // 3. AI-analysis history for exactly these documents.
  const keys = new Set(metaDocs.map((doc) => doc.key));
  const queues = ["done", "failedAnalyzing", "failedImaging", "pending", "imaged"] as const;
  const history = new Map<string, AnalysisRecord[]>();
  for (const status of queues) {
    const records = await fetchQueueRecords(status, keys);
    for (const [key, list] of records) {
      if (!history.has(key)) history.set(key, []);
      history.get(key)!.push(...list);
    }
  }

  // Ada's comments, per metadata document (covers evaluations whose queue records were cleaned up).
  const adaCommentCounts = new Map<string, number>();
  for (const meta of metaDocs) {
    const comments = await firestore.collection(`${kFirestoreRoot}/documents/${meta.id}/comments`)
      .where("uid", "==", kAdaUid).get();
    if (!comments.empty) adaCommentCounts.set(meta.key, comments.size);
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
  const exportDocs: { meta: MetaDoc; content: unknown }[] = [];

  for (const [problem, docs] of [...byProblem.entries()].sort()) {
    out(`=== ${problem} — ${docs.length} document(s) ===`);
    for (const meta of docs) {
      const content = contentByKey.get(meta.key);
      if (!content) {
        missingContent++;
        out(`  * ${meta.key} uid=${meta.uid} — NO CONTENT FOUND in realtime database`);
        continue;
      }
      const facts = classifyContent(content);
      const modality = modalityOf(facts);
      modalityTotals[modality] = (modalityTotals[modality] ?? 0) + 1;
      if (exportDir && modality !== "empty") {
        exportDocs.push({meta, content});
      }

      const tiles = Object.entries(facts.tileCounts).map(([type, n]) => `${type}:${n}`).join(" ");
      const records = history.get(meta.key) ?? [];
      const adaComments = adaCommentCounts.get(meta.key) ?? 0;
      if (records.length || adaComments) evaluatedDocs++;

      out(`  * ${meta.key} uid=${meta.uid}${meta.title ? ` "${meta.title}"` : ""}`);
      out(`      ${modality}; text ${facts.textChars} chars; drawing ${facts.drawingObjects} ` +
        `objects (${facts.drawingTextObjects} text); dataflow ${facts.dataflowNodes} blocks; ` +
        `tiles: ${tiles || "(none)"}`);
      if (records.length || adaComments) {
        const doneRecords = records.filter((record) => record.status === "done");
        const failures = records.filter((record) => record.status.startsWith("failed"));
        const waiting = records.length - doneRecords.length - failures.length;
        out(`      AI: ${doneRecords.length} done, ${failures.length} failed, ` +
          `${waiting} waiting; ${adaComments} Ada comment(s)`);
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
          if (record.commentText) detail(`          "${record.commentText}"`);
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
  const rtdbOnly = [...contentByKey.keys()].filter((key) => !keys.has(key));
  if (rtdbOnly.length) {
    out(`Note: ${rtdbOnly.length} realtime-database document(s) in this class have no ` +
      "Firestore metadata (personal docs, learning logs, or pre-metadata documents) — not surveyed.");
  }

  if (exportDir) {
    const root = path.resolve(exportDir);
    const documentsDir = path.join(root, "documents");
    fs.mkdirSync(documentsDir, {recursive: true});
    const used = new Set<string>();
    const mapEntries: Record<string, { key: string; uid: string; unit: string | null;
      investigation: string | null; problem: string | null; modality: string }> = {};
    for (const {meta, content} of exportDocs) {
      const base = `p${slugify(meta.investigation ?? "x")}-${slugify(meta.problem ?? "x")}` +
        `-u${slugify(meta.uid)}-${slugify(meta.key).slice(0, 8)}`;
      let id = base;
      for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
      used.add(id);
      fs.writeFileSync(path.join(documentsDir, `${id}.json`), JSON.stringify(content, null, 2) + "\n");
      mapEntries[id] = {
        key: meta.key, uid: meta.uid, unit: meta.unit ?? null,
        investigation: meta.investigation ?? null, problem: meta.problem ?? null,
        modality: modalityOf(classifyContent(content)),
      };
    }
    fs.writeFileSync(path.join(root, "key-map.json"), JSON.stringify({
      schemaVersion: 1,
      contextId,
      portal: kPortal,
      exportedAt: new Date().toISOString(),
      documents: mapEntries,
    }, null, 2) + "\n");
    console.log(`\nExported ${exportDocs.length} non-empty document(s) to ${documentsDir}`);
    console.log(`Key map written to ${path.join(root, "key-map.json")}`);
    console.log("This is real work on disk — keep it under scripts/ai-harness/data/ (gitignored).");
    console.log("Next: cd ../scripts/ai-harness && npx tsx harness.ts import --from " +
      `${path.relative(path.resolve(__dirname, "../scripts/ai-harness"), root) || "."} ` +
      "--corpus <name> --source production --production-data-approved");
    console.log("Then: npx tsx apply-key-map.ts --corpus <name> --key-map <exportdir>/key-map.json");
  }

  if (outFile) {
    const resolved = path.resolve(outFile);
    fs.mkdirSync(path.dirname(resolved), {recursive: true});
    fs.writeFileSync(resolved, fileLines.join("\n") + "\n");
    console.log(`\nFull report (every done record and AI comment) written to ${resolved}`);
    console.log("It contains data derived from real work — keep it under scripts/ai-harness/data/ " +
      "(gitignored) and out of version control.");
  } else if (!verbose) {
    console.log("\nPer-record detail and comment texts were omitted from the terminal. " +
      "Use --out <file> for the full report (recommended over --verbose: terminal scrollback " +
      "is not an archive), e.g. --out ../scripts/ai-harness/data/surveys/teacher-workshop.txt");
  }
}

main()
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  })
  .finally(() => process.exit());
