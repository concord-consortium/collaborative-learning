/**
 * Fills a corpus manifest's provenance fields from an export's key map.
 *
 *   npx tsx apply-key-map.ts --corpus teacher-workshop --key-map data/exports/teacher-workshop/key-map.json
 *
 * A first `import` leaves `unit`, `investigation`, `problem` and `contextId` null — import only ever
 * preserves those fields from a previous manifest; it never invents them. This script fills them
 * once from the key map the survey export writes (which also records each document's original
 * realtime-database key and owner uid, stored here under `labels`). Because import preserves
 * existing values, one application survives every later re-import.
 *
 * Fill-only-null: a value a human already set in the manifest is never overwritten.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpusPaths, defaultDataRoot, readManifest, writeManifest } from "./src/corpus.js";

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));

interface KeyMapEntry {
  key: string;
  uid: string;
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
  /**
   * The survey's prose-vs-program classification (only Text-tile prose and drawing labels count as
   * text). Coarser-grained than the harness's `computedModality` — which counts Dataflow/Table
   * content as student text — and stored under `labels` as a secondary stratum for analysis, never
   * as an override of the harness's answer.
   */
  modality?: string;
}

interface KeyMapFile {
  schemaVersion: number;
  contextId?: string | null;
  documents: Record<string, KeyMapEntry>;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
let corpus: string | undefined;
let keyMapPath: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--corpus") { corpus = args[++i]; continue; }
  if (args[i] === "--key-map") { keyMapPath = args[++i]; continue; }
  fail(`Unknown argument "${args[i]}". Usage: apply-key-map.ts --corpus <name> --key-map <file>`);
}
if (!corpus || !keyMapPath) {
  fail("Usage: apply-key-map.ts --corpus <name> --key-map <file>");
}

const resolvedKeyMap = path.resolve(harnessRoot, keyMapPath);
if (!fs.existsSync(resolvedKeyMap)) fail(`No key map at ${resolvedKeyMap}`);
const keyMap = JSON.parse(fs.readFileSync(resolvedKeyMap, "utf8")) as KeyMapFile;
if (keyMap.schemaVersion !== 1 || typeof keyMap.documents !== "object" || keyMap.documents === null) {
  fail(`${resolvedKeyMap} does not look like a version-1 key map (schemaVersion + documents).`);
}

const paths = corpusPaths(defaultDataRoot(), corpus);
if (!fs.existsSync(paths.manifest)) {
  fail(`No manifest at ${paths.manifest} — run harness.ts import first.`);
}
const manifest = readManifest(paths);

let filled = 0;
let alreadySet = 0;
const unmatched: string[] = [];
const inManifest = new Set(manifest.documents.map((entry) => entry.id));
for (const id of Object.keys(keyMap.documents)) {
  if (!inManifest.has(id)) unmatched.push(id);
}

for (const entry of manifest.documents) {
  const mapped = keyMap.documents[entry.id];
  if (!mapped) continue;
  const fill = (current: string | null, value: string | null | undefined): [string | null, boolean] => {
    if (current !== null) { alreadySet++; return [current, false]; }
    if (value == null) return [current, false];
    filled++;
    return [value, true];
  };
  [entry.unit] = fill(entry.unit, mapped.unit);
  [entry.investigation] = fill(entry.investigation, mapped.investigation);
  [entry.problem] = fill(entry.problem, mapped.problem);
  [entry.contextId] = fill(entry.contextId, keyMap.contextId);
  if (entry.labels.sourceKey === undefined) entry.labels.sourceKey = mapped.key;
  if (entry.labels.sourceUid === undefined) entry.labels.sourceUid = mapped.uid;
  if (entry.labels.surveyModality === undefined && mapped.modality !== undefined) {
    entry.labels.surveyModality = mapped.modality;
  }
}

writeManifest(paths, manifest);
console.log(`Filled ${filled} field(s) across ${manifest.documents.length} manifest entries; ` +
  `${alreadySet} already-set field(s) left untouched.`);
if (unmatched.length) {
  console.log(`Note: ${unmatched.length} key-map id(s) have no manifest entry (skipped or renamed?): ` +
    unmatched.join(", "));
}
