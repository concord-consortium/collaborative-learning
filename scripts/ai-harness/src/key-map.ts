/**
 * Reading an export's key map, and filling a corpus manifest's provenance from it.
 *
 * Separate from `apply-key-map.ts` because everything here has to be reachable by a test: the
 * script is a top-level program — argv, file reads and `process.exit` all run on import — and the
 * two things worth getting right are the refusals and the counts, neither of which a caller can
 * see from outside the process.
 */
import { CorpusManifest } from "./schemas.js";

export interface KeyMapEntry {
  key: string;
  uid: string;
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
  /**
   * What the modality was at export time, as `classifyDocument` read it.
   *
   * The survey calls the harness's own classifier, so this is normally the same answer as the
   * manifest's `computedModality` rather than a second opinion. It is still recorded, under
   * `labels`, because the two readings are taken from content at different moments: a disagreement
   * means the corpus copy is no longer what was exported. Never an override of the harness's answer.
   */
  modality?: string;
}

export interface KeyMapFile {
  schemaVersion: number;
  contextId?: string | null;
  documents: Record<string, KeyMapEntry>;
}

/** A key map the corpus must not be patched from, as opposed to a bug in the harness. */
export class KeyMapRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyMapRefused";
  }
}

export interface ApplyKeyMapResult {
  /** Manifest entries the key map named. */
  matched: number;
  /** Every field written, `labels` included. */
  filled: number;
  /** Fields the key map offered a value for that an existing value declined. */
  alreadySet: number;
  /** Key-map ids with no manifest entry — skipped at import, or renamed since. */
  unmatched: string[];
}

/**
 * Checks the file really is a version-1 key map before anything reads its fields.
 * @param {unknown} value The parsed JSON.
 * @param {string} file The path, for the message.
 * @return {KeyMapFile} The same value, typed.
 */
export function validateKeyMapFile(value: unknown, file: string): KeyMapFile {
  const record = value as KeyMapFile | null;
  if (!record || record.schemaVersion !== 1 ||
      typeof record.documents !== "object" || record.documents === null) {
    throw new KeyMapRefused(
      `${file} does not look like a version-1 key map (schemaVersion + documents).`);
  }
  return record;
}

/**
 * Fills a manifest's null provenance fields from a key map, in place.
 *
 * Fill-only-null throughout: a value a human already set is never overwritten, which is also what
 * makes one application survive every later re-import (import preserves what it finds).
 *
 * The key map must describe THIS corpus. Once any document carries a `contextId`, a key map with
 * none is refused (its class cannot be checked) and one naming a different class is refused rather
 * than silently patching whichever ids happen to collide. A manifest holding more than one class is
 * refused for the same reason. A fresh manifest — every `contextId` still null — has nothing to
 * compare against; there the protection is that export ids are hashes of document keys, so a key
 * map from another class shares no ids with this corpus and matches nothing at all.
 * @param {CorpusManifest} manifest The manifest to fill, mutated in place.
 * @param {KeyMapFile} keyMap The export's key map.
 * @param {{keyMapFile: string, corpusName: string}} context Names for the refusal messages.
 * @return {ApplyKeyMapResult} What was matched, written and left alone.
 */
export function applyKeyMap(
  manifest: CorpusManifest, keyMap: KeyMapFile,
  context: { keyMapFile: string; corpusName: string }
): ApplyKeyMapResult {
  const manifestContextIds = new Set(manifest.documents
    .map((entry) => entry.contextId)
    .filter((value): value is string => value !== null));
  if (manifestContextIds.size > 0) {
    if (keyMap.contextId == null) {
      throw new KeyMapRefused(
        `${context.keyMapFile} carries no contextId, but corpus "${context.corpusName}" already ` +
        `belongs to class ${[...manifestContextIds].join(", ")} — refusing a key map whose class ` +
        "cannot be checked.");
    }
    const mismatched = [...manifestContextIds].filter((value) => value !== keyMap.contextId);
    if (mismatched.length > 0) {
      throw new KeyMapRefused(
        `${context.keyMapFile} describes class ${keyMap.contextId}, but corpus ` +
        `"${context.corpusName}" carries ${mismatched.join(", ")} — refusing to patch a corpus ` +
        "with another class's key map.");
    }
  }

  let filled = 0;
  let alreadySet = 0;
  let matched = 0;
  const inManifest = new Set(manifest.documents.map((entry) => entry.id));
  const unmatched = Object.keys(keyMap.documents).filter((id) => !inManifest.has(id));

  for (const entry of manifest.documents) {
    const mapped = keyMap.documents[entry.id];
    if (!mapped) continue;
    matched++;
    // A field the key map had nothing for is neither a write nor a declined overwrite.
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

  return { matched, filled, alreadySet, unmatched };
}
