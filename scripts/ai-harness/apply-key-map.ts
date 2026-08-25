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

// The key map must describe THIS corpus. After a first application the manifest's documents carry
// the class's contextId, so once any is set: a key map with no contextId at all is refused (its
// class cannot be checked), and one naming a different class — or a manifest holding more than one
// class — is refused rather than silently patching whichever ids happen to collide. A fresh
// manifest (every contextId still null) has nothing to compare, and the matched count printed
// below is the visibility for that case.
const manifestContextIds = new Set(manifest.documents
  .map((entry) => entry.contextId)
  .filter((value): value is string => value !== null));
if (manifestContextIds.size > 0) {
  if (keyMap.contextId == null) {
    fail(`${resolvedKeyMap} carries no contextId, but corpus "${corpus}" already belongs to class ` +
      `${[...manifestContextIds].join(", ")} — refusing a key map whose class cannot be checked.`);
  }
  const mismatched = [...manifestContextIds].filter((value) => value !== keyMap.contextId);
  if (mismatched.length > 0) {
    fail(`${resolvedKeyMap} describes class ${keyMap.contextId}, but corpus "${corpus}" carries ` +
      `${mismatched.join(", ")} — refusing to patch a corpus with another class's key map.`);
  }
}

// `filled` counts every write, labels included; `alreadySet` counts only real overwrite candidates
// — a field the key map offered a value for that an existing value declined. A field the key map
// had nothing for is neither.
let filled = 0;
let alreadySet = 0;
let matched = 0;
const unmatched: string[] = [];
const inManifest = new Set(manifest.documents.map((entry) => entry.id));
for (const id of Object.keys(keyMap.documents)) {
  if (!inManifest.has(id)) unmatched.push(id);
}

for (const entry of manifest.documents) {
  const mapped = keyMap.documents[entry.id];
  if (!mapped) continue;
  matched++;
  const fill = (current: string | null, value: string | null | undefined): string | null => {
    if (value == null) return current;
    if (current !== null) {
      alreadySet++;
      return current;
    }
    filled++;
    return value;
  };
  entry.unit = fill(entry.unit, mapped.unit);
  entry.investigation = fill(entry.investigation, mapped.investigation);
  entry.problem = fill(entry.problem, mapped.problem);
  entry.contextId = fill(entry.contextId, keyMap.contextId);
  const fillLabel = (name: "sourceKey" | "sourceUid" | "surveyModality", value: string | undefined) => {
    if (value === undefined) return;
    if (entry.labels[name] !== undefined) {
      alreadySet++;
      return;
    }
    entry.labels[name] = value;
    filled++;
  };
  fillLabel("sourceKey", mapped.key);
  fillLabel("sourceUid", mapped.uid);
  fillLabel("surveyModality", mapped.modality);
}

writeManifest(paths, manifest);
console.log(`Matched ${matched} of ${manifest.documents.length} manifest entries; ` +
  `filled ${filled} field(s); ${alreadySet} already-set field(s) left untouched.`);
if (matched === 0) {
  console.log("Nothing matched at all — is this the right key map for this corpus?");
}
if (unmatched.length) {
  console.log(`Note: ${unmatched.length} key-map id(s) have no manifest entry (skipped or renamed?): ` +
    unmatched.join(", "));
}
