/**
 * Corpus layout, the `import` command, and manifest read/write.
 *
 * Everything derived from documents lives under `data/` (gitignored). Committed example corpora live
 * outside it, in `examples/`, and are copied in by `import`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CorpusManifest, CorpusSource, ManifestDocument, Modality, RepresentationEnvelope,
  kDocumentIdPattern, kSchemaVersion, sha256Canonical, validateCorpusManifest, validateRepresentationEnvelope
} from "./schemas.js";
import { classifyDocument } from "./capability.js";

/** The scripts/ai-harness directory. */
export const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function defaultDataRoot(): string {
  return path.join(harnessRoot, "data");
}

export interface CorpusPaths {
  root: string;
  documents: string;
  representations: string;
  manifest: string;
}

export function corpusPaths(dataRoot: string, corpus: string): CorpusPaths {
  if (!kDocumentIdPattern.test(corpus)) {
    throw new Error(`--corpus must match ${kDocumentIdPattern}, got "${corpus}"`);
  }
  const root = path.join(dataRoot, "corpus", corpus);
  return {
    root,
    documents: path.join(root, "documents"),
    representations: path.join(root, "representations"),
    manifest: path.join(root, "manifest.json")
  };
}

export function readJsonFile(file: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`${file}: cannot be read`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file}: is not valid JSON (${(error as Error).message})`);
  }
}

export function writeJsonFile(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readManifest(paths: CorpusPaths): CorpusManifest {
  return validateCorpusManifest(readJsonFile(paths.manifest), paths.manifest);
}

export function writeManifest(paths: CorpusPaths, manifest: CorpusManifest): void {
  writeJsonFile(paths.manifest, manifest);
}

export function readCorpusDocument(paths: CorpusPaths, entry: ManifestDocument): unknown {
  return readJsonFile(resolveCorpusFile(paths, entry));
}

/**
 * Resolves a manifest entry's `file` inside its corpus, refusing anything that escapes. `import`
 * only ever writes `documents/<id>.json`, but the manifest is a hand-editable file, and a `file` of
 * `../../..` would otherwise make the harness read whatever it pointed at.
 */
export function resolveCorpusFile(paths: CorpusPaths, entry: ManifestDocument): string {
  const resolved = path.resolve(paths.root, entry.file);
  const relative = path.relative(paths.root, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${paths.manifest}: document "${entry.id}" has a file "${entry.file}" that ` +
      `resolves outside the corpus directory (${resolved})`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Representations
// ---------------------------------------------------------------------------

export function representationPath(paths: CorpusPaths, variantId: string, docId: string): string {
  return path.join(paths.representations, variantId, `${docId}.json`);
}

export function readRepresentation(file: string): RepresentationEnvelope {
  return validateRepresentationEnvelope(readJsonFile(file), file);
}

export interface RepresentationIdentity {
  docId: string;
  variantId: string;
  contentSha256: string;
  variantVersion: number;
}

/**
 * The envelope, not the file's existence, decides staleness: a representation is reusable only when
 * it was produced for this document, by this variant, from this exact content, at this exact variant
 * version. The docId/variantId checks matter because the path alone proves nothing — a `default`
 * envelope copied onto a `minimal` path would otherwise pass, silently making the two variants
 * identical and quietly ruining the comparison the harness exists to make.
 */
export function representationIsFresh(
  envelope: RepresentationEnvelope, expected: RepresentationIdentity
): boolean {
  return envelope.docId === expected.docId &&
    envelope.variantId === expected.variantId &&
    envelope.sourceContentSha256 === expected.contentSha256 &&
    envelope.variantVersion === expected.variantVersion;
}

// ---------------------------------------------------------------------------
// import
// ---------------------------------------------------------------------------

export interface ImportOptions {
  from: string;
  corpus: string;
  source: CorpusSource;
  prune: boolean;
  dataRoot: string;
  /** Injected in tests so manifest timestamps are deterministic. */
  now?: () => Date;
}

export interface ImportResult {
  manifest: CorpusManifest;
  imported: string[];
  missing: string[];
  pruned: string[];
  warnings: string[];
}

/** `production` is not accepted here; only the (gated) `pull` command may set it. */
export const importableSources: readonly CorpusSource[] = ["synthetic", "demo", "qa"];

export function importCorpus(options: ImportOptions): ImportResult {
  const { from, corpus, source, prune, dataRoot } = options;
  // Stamped once, so every document in one import shares a retrievedAt and a new corpus's createdAt
  // matches them rather than landing a few milliseconds earlier.
  const importedAt = (options.now ?? (() => new Date()))().toISOString();

  if (!importableSources.includes(source)) {
    throw new Error(`--source must be one of ${importableSources.join(", ")}; ` +
      `"${source}" documents are only produced by the (gated) pull command`);
  }
  const paths = corpusPaths(dataRoot, corpus);

  const sourceDir = path.resolve(from);
  const documentsDir = fs.existsSync(path.join(sourceDir, "documents"))
    ? path.join(sourceDir, "documents")
    : sourceDir;
  if (!fs.statSync(documentsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`--from must name a directory containing document JSON files, got "${from}"`);
  }

  const existing = fs.existsSync(paths.manifest) ? readManifest(paths) : null;
  const previous = new Map((existing?.documents ?? []).map((entry) => [entry.id, entry]));

  const warnings: string[] = [];
  const imported: string[] = [];
  const entries: ManifestDocument[] = [];
  const seen = new Set<string>();

  const sourceFiles = fs.readdirSync(documentsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const name of sourceFiles) {
    const id = path.basename(name, ".json");
    if (!kDocumentIdPattern.test(id)) {
      throw new Error(`${path.join(documentsDir, name)}: document id "${id}" must match ${kDocumentIdPattern}`);
    }
    if (seen.has(id)) {
      throw new Error(`corpus "${corpus}": document id "${id}" is used by more than one source file`);
    }
    seen.add(id);

    const relativeFile = path.join("documents", `${id}.json`);
    const destination = path.join(paths.root, relativeFile);
    // Belt and braces: an id can only produce a path inside the corpus, but check the resolved path.
    if (path.relative(paths.root, path.resolve(destination)).startsWith("..")) {
      throw new Error(`corpus "${corpus}": document "${id}" would be written outside the corpus directory`);
    }

    const content = readJsonFile(path.join(documentsDir, name));
    const contentSha256 = sha256Canonical(content);
    const classification = classifyDocument(content);
    for (const warning of classification.warnings) warnings.push(`${id}: ${warning}`);

    writeJsonFile(destination, content);
    imported.push(id);

    const before = previous.get(id);
    entries.push({
      id,
      file: relativeFile,
      source,
      contentSha256,
      // A synthetic document was authored here, not retrieved from anywhere.
      retrievedAt: source === "synthetic" ? null : importedAt,
      unit: before?.unit ?? null,
      investigation: before?.investigation ?? null,
      problem: before?.problem ?? null,
      contextId: before?.contextId ?? null,
      computedModality: classification.computedModality,
      modalityOverride: before?.modalityOverride ?? null,
      labels: before?.labels ?? {},
      relatedSummaries: before?.relatedSummaries ?? [],
      historical: before?.historical ?? null
    });
  }

  const missing: string[] = [];
  const pruned: string[] = [];
  for (const entry of previous.values()) {
    if (seen.has(entry.id)) continue;
    if (prune) {
      // Destructive on purpose: an entry removed from the manifest is unreachable, and once
      // production corpora exist an unreachable copy of a student's document must not linger.
      removeDocumentArtifacts(paths, entry);
      pruned.push(entry.id);
      continue;
    }
    missing.push(entry.id);
    warnings.push(`${entry.id}: source file has disappeared; the manifest entry is kept ` +
      "(pass --prune to remove it)");
    entries.push(entry);
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  const manifest: CorpusManifest = {
    schemaVersion: kSchemaVersion,
    name: corpus,
    createdAt: existing?.createdAt ?? importedAt,
    documents: entries
  };
  writeManifest(paths, manifest);

  return { manifest, imported, missing, pruned, warnings };
}

/** Deletes a document's copied content and every representation envelope generated from it. */
export function removeDocumentArtifacts(paths: CorpusPaths, entry: ManifestDocument): string[] {
  const removed: string[] = [];
  const remove = (file: string) => {
    if (!fs.existsSync(file)) return;
    fs.rmSync(file);
    removed.push(file);
  };
  try {
    remove(resolveCorpusFile(paths, entry));
  } catch {
    // A manifest entry pointing outside the corpus is not ours to delete; leave it and move on.
  }
  if (fs.existsSync(paths.representations)) {
    for (const variantId of fs.readdirSync(paths.representations)) {
      remove(path.join(paths.representations, variantId, `${entry.id}.json`));
    }
  }
  return removed;
}

/** Recomputes a document's modality from its current content. */
export function computeModality(content: unknown): Modality {
  return classifyDocument(content).computedModality;
}
