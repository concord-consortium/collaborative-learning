// Walks a unit's authored structure (root content.json -> investigations -> problems ->
// sections), in authored order, and turns it into per-problem Markdown plus the hashes and
// manifest the unit-summary generation route and status route both need. See
// docs/plans/CLUE-685-plan.md §2.2 for the design.

import {normalizeCurriculumDataSets, summarizeCurriculum} from "../../../shared/ai-summarizer/ai-summarizer";
import {SharedModelMapEntry, TileHandler} from "../../../shared/ai-summarizer/ai-summarizer-types";
import {defaultTileHandlers} from "../../../shared/ai-summarizer/ai-tile-summarizer";
import {hashString} from "../../../shared/hash-string";
import {handleDrawingTileLabels} from "../../../shared/ai-summarizer/tile-summarizers/handle-drawing-tile-labels";
import {IUnitSummarySourceProblem} from "../../../shared/unit-summary-types";
import {loadUnitFileInventory, readEffectiveContentText, UnitContentFile} from "./unit-content";

// Same shape as documentSummarizerWithDrawings (ai-summarizer-with-drawings.ts): the curriculum-only
// handler goes first so it wins for Drawing tiles, then every other tile type falls through to the
// same defaults every other caller of documentSummarizer gets.
const curriculumTileHandlers: TileHandler[] = [handleDrawingTileLabels, ...defaultTileHandlers];

// The authored shapes read from a unit's root content.json and from a resolved section file.
// Both are read as plain JSON (never loaded into MST), so these describe only the fields this
// walk actually reads -- not the full authored schema.
interface RawSectionContent {
  sharedModels?: SharedModelMapEntry[];
}
interface RawSection {
  // The key into the unit's own `sections` map (e.g. "intro", "labWork") -- present at the top
  // level of both an inline section object and an external section file's JSON, so this one field
  // covers both of resolveSection's cases identically.
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
  // Unit-level, authored once and reused by every problem's sections: maps a section type key to
  // its human-readable name ("intro" -> "Investigate", etc.). Same map curriculum-tabs.tsx reads
  // client-side for the same names.
  sections?: Record<string, {title?: string}>;
}

export interface AssembledProblem {
  // "${investigation.ordinal}.${problem.ordinal}", from the AUTHORED values -- never from
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

// Injectable so tests can supply an in-memory inventory and file contents without touching the
// Realtime Database or GitHub -- the same seam readEffectiveContentText's own updateText branch
// already makes possible for free (it returns before touching either).
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
      for (let i = 0; i < sections.length; i++) {
        const section = await resolveSection(sections[i], ordinal, i, inventoryByPath, branch, unit, deps);
        const dataSets = normalizeCurriculumDataSets(section.content?.sharedModels);
        const body = summarizeCurriculum(section.content, dataSets, 1, undefined, {
          // dataSetTables: "full" is an explicit opt-in, not the default -- handle-table-tile.ts
          // stays silent about a table's data set unless asked. Curriculum digests want the actual
          // rows (subject to TABLE_MARKDOWN_ROW_CAP), same as the pre-existing document-level
          // "Data Sets" summary already showed for runtime documents.
          // tileHandlers: curriculumTileHandlers swaps in the labels-only drawing handler; every
          // other tile type still resolves through the same defaults every other caller gets.
          imageFilenames: true, dataSetTables: "full", tileHandlers: curriculumTileHandlers,
        });
        // A problem's sections were joined with nothing marking where one ends and the next
        // begins, so the digest model had no signal that a problem has several distinct parts to
        // cover -- a likely real contributor to a digest collapsing to just the first one (see
        // docs/plans/CLUE-685-checklist.md step 2.7's vibe review). The heading is each section
        // TYPE's own authored name (e.g. "intro" -> "Investigate"), the same map
        // curriculum-tabs.tsx reads client-side; falls back to the raw type key, and then to a
        // fixed placeholder, so a section with no registered title still gets a heading rather
        // than silently losing its boundary.
        //
        // "# Section: " rather than a bare "## " heading: a section's own tile content can and
        // does already contain "## "-level headings of its own regardless of heading level or the
        // `minimal` option (tilesSummary's per-tile "## Tile 2 (...)" heading for a multi-tile row,
        // e.g. inside a Question tile's response, is never suppressed). A marker distinguished only
        // by heading level would be lost among those; "Section:" is a literal word nothing else in
        // the summarizer ever emits, so it stays unambiguous regardless of what headings a
        // section's own content happens to produce.
        const title = (section.type && root.sections?.[section.type]?.title) || section.type || "Section";
        sectionMarkdowns.push(`# Section: ${title}\n\n${body}`);
      }

      const markdown = sectionMarkdowns.join("\n\n");
      problems.push({ordinal, title: problem.title ?? "", markdown, problemHash: hashString(markdown)});
    }
  }

  const sourceHash = hashString(problems.map((p) => p.markdown).join("\n\n"));
  const sourceManifest: IUnitSummarySourceProblem[] = problems.map((p) => ({
    ordinal: p.ordinal, title: p.title, problemHash: p.problemHash,
  }));

  return {sourceHash, sourceManifest, problems};
}

// Mirrors problem.ts's loadSections: a section is either inline (an object, used as-is) or a
// string path to an external file, resolved relative to the unit root exactly the way the
// runtime resolves it with `new URL(section, unitUrl)`. Using URL resolution here too (rather
// than hand-rolled path-joining) keeps "." / ".." segments handled identically to the runtime.
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
