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
 * The reading, refusing and counting all live in src/key-map.ts, where they can be tested. What is
 * left here is the parts that only make sense as a program: arguments, files, and the exit code.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpusPaths, defaultDataRoot, readManifest, writeManifest } from "./src/corpus.js";
import { applyKeyMap, KeyMapRefused, validateKeyMapFile } from "./src/key-map.js";

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));

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

const paths = corpusPaths(defaultDataRoot(), corpus);
if (!fs.existsSync(paths.manifest)) {
  fail(`No manifest at ${paths.manifest} — run harness.ts import first.`);
}
const manifest = readManifest(paths);

let result;
try {
  const keyMap = validateKeyMapFile(
    JSON.parse(fs.readFileSync(resolvedKeyMap, "utf8")), resolvedKeyMap);
  result = applyKeyMap(manifest, keyMap, { keyMapFile: resolvedKeyMap, corpusName: corpus });
} catch (error) {
  if (error instanceof KeyMapRefused) fail(error.message);
  throw error;
}

// Nothing matched is a failed run, not a quiet one. Export ids are hashes of document keys, so a
// key map for another class shares no ids with this corpus and lands here — and a message that
// scrolled past in a terminal would leave the provenance null with the run looking successful. The
// manifest is left alone rather than rewritten unchanged, so the failure is total.
if (result.matched === 0) {
  fail(`No manifest entry matched any of the ${result.unmatched.length} key-map id(s), so ` +
    `nothing was written. Is this the right key map for corpus "${corpus}"?`);
}

writeManifest(paths, manifest);
console.log(`Matched ${result.matched} of ${manifest.documents.length} manifest entries; ` +
  `filled ${result.filled} field(s); ${result.alreadySet} already-set field(s) left untouched.`);
if (result.unmatched.length) {
  console.log(`Note: ${result.unmatched.length} key-map id(s) have no manifest entry ` +
    `(skipped or renamed?): ${result.unmatched.join(", ")}`);
}
