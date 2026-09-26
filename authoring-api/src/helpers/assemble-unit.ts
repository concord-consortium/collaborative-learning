// Walks a unit's authored structure (root content.json -> investigations -> problems ->
// sections), in authored order, and turns it into per-problem Markdown plus the hashes and
// manifest the unit-summary generation and status routes both need.

import {normalizeCurriculumDataSets, summarizeCurriculum} from "../../../shared/ai-summarizer/ai-summarizer";
import {SharedModelMapEntry, TileHandler} from "../../../shared/ai-summarizer/ai-summarizer-types";
import {defaultTileHandlers} from "../../../shared/ai-summarizer/ai-tile-summarizer";
import {hashString} from "../../../shared/hash-string";
import {handleDrawingTileLabels} from "../../../shared/ai-summarizer/tile-summarizers/handle-drawing-tile-labels";
import {IUnitSummarySourceProblem} from "../../../shared/unit-summary-types";
import {loadUnitFileInventory, readEffectiveContentText, UnitContentFile} from "./unit-content";

// Curriculum-only handler goes first so it wins for Drawing tiles; every other tile type falls
// through to the same defaults every other caller of documentSummarizer gets.
const curriculumTileHandlers: TileHandler[] = [handleDrawingTileLabels, ...defaultTileHandlers];

// Read as plain JSON, never loaded into MST, so these interfaces cover only the fields this walk
// actually reads -- not the full authored schema.
interface RawSectionContent {
  sharedModels?: SharedModelMapEntry[];
}
interface RawSection {
  // The key into the unit's own `sections` map (e.g. "intro", "labWork"); present at the top
  // level in both the inline and external-file cases.
  type?: string;
  content?: RawSectionContent;
}
interface RawProblem {
  ordinal: number;
  title?: string;
  sections?: unknown[];
}
interface RawInvestigation {
  ordinal: number;
  problems?: RawProblem[];
}
interface RawUnitContent {
  investigations?: RawInvestigation[];
  // Maps a section type key to its human-readable name ("intro" -> "Investigate", etc.), same as
  // curriculum-tabs.tsx reads client-side.
  sections?: Record<string, {title?: string}>;
}

export interface AssembledProblem {
  // "${investigation.ordinal}.${problem.ordinal}" from the authored values, never from array
  // position. Matches Unit.getAllProblemOrdinals() (src/models/curriculum/unit.ts).
  ordinal: string;
  title: string;
  // This problem's sections' Markdown, concatenated in authored order.
  markdown: string;
  problemHash: string;
}

export interface AssembledUnit {
  // Hash of all problems' Markdown, in order.
  sourceHash: string;
  // Same length and order as `problems`.
  sourceManifest: IUnitSummarySourceProblem[];
  problems: AssembledProblem[];
}

// Injectable so tests can supply an in-memory inventory and file contents instead of touching the
// Realtime Database or GitHub.
export interface AssembleUnitDeps {
  loadInventory: (branch: string, unit: string) => Promise<UnitContentFile[]>;
  readText: (branch: string, unit: string, file: UnitContentFile) => Promise<string>;
}

const defaultDeps: AssembleUnitDeps = {
  loadInventory: loadUnitFileInventory,
  readText: readEffectiveContentText,
};

const rootContentPath = "content.json";

export async function assembleUnit(
  branch: string, unit: string, deps: AssembleUnitDeps = defaultDeps
): Promise<AssembledUnit> {
  const inventory = await deps.loadInventory(branch, unit);
  const inventoryByPath = new Map(inventory.map((file) => [file.path, file]));

  const rootFile = inventoryByPath.get(rootContentPath);
  if (!rootFile) {
    throw new Error(`No root content.json found for unit "${unit}" on branch "${branch}"`);
  }
  const root = parseJson<RawUnitContent>(await deps.readText(branch, unit, rootFile), rootContentPath);

  const investigations = Array.isArray(root.investigations) ? root.investigations : [];
  const seenOrdinals = new Set<string>();
  const problems: AssembledProblem[] = [];
  // Unit-wide, not per-problem, so a section reused verbatim anywhere in the unit is caught, not
  // just reuse within one problem. Maps a section's content hash to the first problem it appeared in.
  const firstSectionOccurrence = new Map<string, string>();

  for (const investigation of investigations) {
    const problemList = Array.isArray(investigation.problems) ? investigation.problems : [];
    for (const problem of problemList) {
      const ordinal = `${investigation.ordinal}.${problem.ordinal}`;
      if (seenOrdinals.has(ordinal)) {
        throw new Error(`Duplicate problem ordinal "${ordinal}"`);
      }
      seenOrdinals.add(ordinal);

      const sections = Array.isArray(problem.sections) ? problem.sections : [];
      const sectionMarkdowns: string[] = [];
      // Raw (pre-section-dedup) section text, kept only to hash this problem's real content --
      // never sent anywhere. See problemHash below for why.
      const rawSectionMarkdowns: string[] = [];
      for (let i = 0; i < sections.length; i++) {
        const section = await resolveSection(sections[i], ordinal, i, inventoryByPath, branch, unit, deps);
        // content is authored, not guaranteed -- a section can be a placeholder not yet filled in
        // (e.g. just {"type": "labWork"}). summarizeCurriculum assumes a real content object and
        // throws on undefined, so a missing one is treated as an empty section here instead.
        const dataSets = normalizeCurriculumDataSets(section.content?.sharedModels);
        const body = section.content ? summarizeCurriculum(section.content, dataSets, 1, undefined, {
          // "full" is an explicit opt-in -- handle-table-tile.ts is silent about a table's data by
          // default. curriculumTileHandlers swaps in the labels-only drawing handler.
          imageFilenames: true, dataSetTables: "full", tileHandlers: curriculumTileHandlers,
        }) : "";
        // Each section gets its own heading so the digest model sees a problem's several parts as
        // distinct rather than one blob. "# Section: " rather than a bare "## " heading: section
        // content can already contain its own "##"-level headings (e.g. a multi-tile row's per-tile
        // heading), so a heading-level alone wouldn't reliably mark a boundary.
        const title = (section.type && root.sections?.[section.type]?.title) || section.type || "Section";
        const heading = `# Section: ${title}\n\n`;
        rawSectionMarkdowns.push(`${heading}${body}`);
        const dedupedBody = dedupedSectionBody(body, title, ordinal, firstSectionOccurrence);
        sectionMarkdowns.push(`${heading}${dedupedBody}`);
      }

      const markdown = sectionMarkdowns.join("\n\n");
      // Hashed from the raw sections, not from `markdown` -- dedupedSectionBody above can replace a
      // later, byte-identical problem's sections with "(same content as problem X)" pointers, which
      // would otherwise give two truly-identical problems different hashes (the first holds real
      // content, the rest hold pointer text). That breaks whole-problem-duplicate detection
      // (unit-summary-digest.ts) for exactly the case it exists to catch: the second occurrence
      // stops matching the first's hash, so it gets a real digest call over pointer text instead of
      // being skipped. Hashing the raw content keeps a problem's identity tied to what it actually
      // says, independent of which pointer text section dedup happened to substitute for it.
      const problemHash = hashString(rawSectionMarkdowns.join("\n\n"));
      problems.push({ordinal, title: problem.title ?? "", markdown, problemHash});
    }
  }

  // Derived from each problem's own hash, not from `markdown` directly, for the same reason
  // problemHash is hashed from raw content above: an unrelated problem's edit shifting which one is
  // the "first occurrence" of a shared section can change ANOTHER problem's deduped `markdown` even
  // though that problem's own real content never changed, which would move sourceHash and falsely
  // flag the whole unit as stale.
  const sourceHash = hashString(problems.map((p) => p.problemHash).join("\n"));
  const sourceManifest: IUnitSummarySourceProblem[] = problems.map((p) => ({
    ordinal: p.ordinal, title: p.title, problemHash: p.problemHash,
  }));

  return {sourceHash, sourceManifest, problems};
}

// A section byte-identical to one already seen elsewhere in the unit is replaced with a pointer to
// the first occurrence, so a digest doesn't re-describe boilerplate already covered for an earlier
// problem. Companion to the whole-problem dedupe in unit-summary-digest.ts, which catches an entire
// problem duplicating another rather than just one shared section. Empty content is left alone --
// there's nothing useful to point at.
function dedupedSectionBody(
  body: string, title: string, ordinal: string, firstOccurrence: Map<string, string>
): string {
  if (!body.trim()) {
    return body;
  }
  const contentHash = hashString(body);
  const firstOrdinal = firstOccurrence.get(contentHash);
  if (firstOrdinal) {
    return `(same "${title}" content as problem ${firstOrdinal})`;
  }
  firstOccurrence.set(contentHash, ordinal);
  return body;
}

// Mirrors problem.ts's loadSections: a section is either inline (used as-is) or a string path to
// an external file, resolved the same way the runtime resolves it (`new URL(section, unitUrl)`),
// so "." / ".." segments behave identically here.
async function resolveSection(
  section: unknown, problemOrdinal: string, sectionIndex: number,
  inventoryByPath: Map<string, UnitContentFile>, branch: string, unit: string, deps: AssembleUnitDeps
): Promise<RawSection> {
  if (section && typeof section === "object" && !Array.isArray(section)) {
    return section as RawSection;
  }

  if (typeof section === "string") {
    const path = resolveSectionPath(section);
    const file = inventoryByPath.get(path);
    if (!file) {
      throw new Error(
        `Problem ${problemOrdinal}: referenced section "${section}" (resolved to "${path}") was not found`
      );
    }
    return parseJson<RawSection>(await deps.readText(branch, unit, file), path, problemOrdinal);
  }

  throw new Error(`Problem ${problemOrdinal}: section at index ${sectionIndex} has an unrecognized shape`);
}

function resolveSectionPath(section: string): string {
  const resolved = new URL(section, `http://unit-root/${rootContentPath}`);
  return decodeURIComponent(resolved.pathname.replace(/^\//, ""));
}

function parseJson<T>(text: string, path: string, problemOrdinal?: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const where = problemOrdinal ? `Problem ${problemOrdinal}: ` : "";
    throw new Error(`${where}failed to parse "${path}": ${error}`);
  }
}
