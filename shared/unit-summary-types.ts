// Data model, validation, and shared text for the AI-generated curriculum unit summary.
// It lives in shared/ because both authoring-api (generation) and src/ (the unit config type,
// the authoring panel, and Save-time validation) need the same shapes and rules.

// How a problem asks students to work. The type, validation, the approach-step prompt and the
// authoring panel's select are all built from this one list.
// divergent: generate or try many ideas. convergent: choose one and develop it. mixed: different
// sections ask for different things. unclear: neither.
export const UNIT_SUMMARY_PROBLEM_APPROACHES = ["divergent", "convergent", "mixed", "unclear"] as const;
export type UnitSummaryProblemApproach = typeof UNIT_SUMMARY_PROBLEM_APPROACHES[number];

// One problem's slice of the summary. `ordinal` is the same `${investigation.ordinal}.${problem.ordinal}`
// string Unit.getAllProblemOrdinals() produces (src/models/curriculum/unit.ts).
export interface IUnitSummaryEntry {
  ordinal: string;
  // What a student should know/have done by the time they START this problem, cumulative over every
  // earlier problem in the unit -- not a restatement of this problem's own content. Generated with
  // visibility into only earlier problems' digests. Empty string is valid only for the unit's first
  // entry, when there is no unit-level front matter to derive it from.
  priorKnowledge: string;
  // A short digest of what THIS problem itself covers/has students do. Generated with visibility
  // into only this problem's own content.
  problemDigest: string;
  // Judged from this problem's own content only. A missing label means "say nothing about
  // approach", not an error.
  approach?: UnitSummaryProblemApproach;
  // One or two sentences saying what the problem asks students to do and what an AI should not
  // suggest instead.
  approachGuidance?: string;
}

// One row of the summary's compatibility manifest: the live curriculum structure the summary was
// generated from (ordinal, title, and a hash of that problem's assembled Markdown). Consumers and
// the authoring panel's staleness badge compare this against the unit's current structure to
// decide whether an entry is still trustworthy.
export interface IUnitSummarySourceProblem {
  ordinal: string;
  title: string;
  problemHash: string;
}

export interface IUnitSummary {
  // ISO timestamp, shown next to the staleness badge in the authoring UI.
  generatedAt: string;
  // Hash of the whole unit's assembled Markdown (all problems, in order) at generation time. Used
  // only for the authoring panel's "possibly stale" badge. It says nothing about whether the
  // summary TEXT has changed; an author's edit leaves it untouched.
  sourceHash: string;
  // Same length and order as `entries`.
  sourceManifest: IUnitSummarySourceProblem[];
  // One paragraph, unit-level "what is this unit about".
  overview: string;
  entries: IUnitSummaryEntry[];
}

// -- Request/response shapes for the two authoring-api routes --

export interface IGenerateUnitSummaryRequest {
  branch: string;
  unit: string;
}

export interface IGenerateUnitSummaryResponse {
  summary: IUnitSummary;
}

export interface IUnitSummaryStatusRequest {
  branch: string;
  unit: string;
}

// A live problem's assembled-Markdown size, for the panel/route to reason about budgets. No
// Markdown itself is returned by the status route.
export interface IUnitSummaryProblemSize {
  ordinal: string;
  markdownLength: number;
}

export interface IUnitSummaryStatusResponse {
  sourceHash: string;
  sourceManifest: IUnitSummarySourceProblem[];
  problemSizes: IUnitSummaryProblemSize[];
}

// -- Validation --

// Per-field and total-summary character limits, counted as plain string length (no tokenizer), at
// roughly 4 characters per token.
export const UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS = 1200;
// Cumulative by design, but kept well below the digest cap: the required format is a compact
// semicolon-separated list of concepts, not narrative sentences, so it stays bounded regardless of
// how many problems precede it.
export const UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS = 800;
export const UNIT_SUMMARY_OVERVIEW_MAX_CHARS = 1200;
// One or two sentences. Sent on every consumer request that has a slice.
export const UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS = 300;
// A ceiling to catch a runaway total, set well above the worst realistic case (every problem at
// every per-field maximum, for the largest known unit). unit-summary-config.test.ts fails if the
// two ever meet.
export const UNIT_SUMMARY_TOTAL_BUDGET_CHARS = 130000;

export type UnitSummaryValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Checks a summary for internal consistency and against the live, ordered list of problem
 * ordinals it should describe. Run both right after generation (against the assembler's problem
 * list) and before Save (against the currently loaded unit's problem list), so an author's manual
 * edit is held to the same rules as a generated result.
 */
export function validateUnitSummary(
  summary: IUnitSummary,
  liveProblems: string[]
): UnitSummaryValidationResult {
  const errors: string[] = [];

  if (summary.entries.length !== summary.sourceManifest.length) {
    errors.push(
      `entries (${summary.entries.length}) and sourceManifest (${summary.sourceManifest.length}) ` +
      "must be the same length"
    );
  }

  const manifestOrdinals = summary.sourceManifest.map(p => p.ordinal);
  const duplicateOrdinals = [...new Set(
    manifestOrdinals.filter((ordinal, i) => manifestOrdinals.indexOf(ordinal) !== i)
  )];
  if (duplicateOrdinals.length > 0) {
    errors.push(`duplicate ordinal(s) in sourceManifest: ${duplicateOrdinals.join(", ")}`);
  } else if (!arraysEqual(manifestOrdinals, liveProblems)) {
    errors.push(
      `sourceManifest ordinals [${manifestOrdinals.join(", ")}] do not match the live problem ` +
      `list [${liveProblems.join(", ")}]`
    );
  }

  summary.entries.forEach((entry, i) => {
    const manifestEntry = summary.sourceManifest[i];
    if (manifestEntry && entry.ordinal !== manifestEntry.ordinal) {
      errors.push(
        `entries[${i}].ordinal ("${entry.ordinal}") does not match sourceManifest[${i}].ordinal ` +
        `("${manifestEntry.ordinal}")`
      );
    }
    if (!entry.ordinal) {
      errors.push(`entries[${i}] is missing ordinal`);
    }
    if (!entry.problemDigest) {
      errors.push(`entries[${i}] (${entry.ordinal}) is missing problemDigest`);
    } else if (entry.problemDigest.length > UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS) {
      errors.push(
        `entries[${i}] (${entry.ordinal}) problemDigest exceeds ` +
        `${UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} characters`
      );
    }
    if (typeof entry.priorKnowledge !== "string") {
      errors.push(`entries[${i}] (${entry.ordinal}) is missing priorKnowledge`);
    } else if (entry.priorKnowledge.length === 0 && i !== 0) {
      errors.push(
        `entries[${i}] (${entry.ordinal}) priorKnowledge is empty; only the unit's first problem ` +
        "may have empty priorKnowledge"
      );
    } else if (entry.priorKnowledge.length > UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS) {
      errors.push(
        `entries[${i}] (${entry.ordinal}) priorKnowledge exceeds ` +
        `${UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} characters`
      );
    }
    // Guidance without a label is rejected rather than ignored: nothing consumes it.
    if (entry.approach !== undefined &&
        !(UNIT_SUMMARY_PROBLEM_APPROACHES as readonly string[]).includes(entry.approach)) {
      errors.push(
        `entries[${i}] (${entry.ordinal}) approach ("${entry.approach}") is not one of ` +
        UNIT_SUMMARY_PROBLEM_APPROACHES.join(", ")
      );
    }
    // Also runs over a hand-edited content.json, where the value can be anything JSON allows, so
    // the type is not a guarantee and reading .length off a null would throw.
    const approachGuidance: unknown = entry.approachGuidance;
    if (approachGuidance !== undefined) {
      if (typeof approachGuidance !== "string") {
        errors.push(`entries[${i}] (${entry.ordinal}) approachGuidance must be a string`);
      } else {
        if (approachGuidance.length > UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS) {
          errors.push(
            `entries[${i}] (${entry.ordinal}) approachGuidance exceeds ` +
            `${UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS} characters`
          );
        }
        if (entry.approach === undefined) {
          errors.push(
            `entries[${i}] (${entry.ordinal}) has approachGuidance but no approach`
          );
        }
      }
    }
  });

  summary.sourceManifest.forEach((p, i) => {
    if (!p.title) errors.push(`sourceManifest[${i}] (${p.ordinal}) is missing title`);
    if (!p.problemHash) errors.push(`sourceManifest[${i}] (${p.ordinal}) is missing problemHash`);
  });

  if (!summary.overview) {
    errors.push("overview is missing");
  } else if (summary.overview.length > UNIT_SUMMARY_OVERVIEW_MAX_CHARS) {
    errors.push(`overview exceeds ${UNIT_SUMMARY_OVERVIEW_MAX_CHARS} characters`);
  }

  if (!summary.generatedAt) {
    errors.push("generatedAt is missing");
  } else if (!isIsoTimestamp(summary.generatedAt)) {
    errors.push(`generatedAt ("${summary.generatedAt}") is not a valid ISO timestamp`);
  }
  if (!summary.sourceHash) errors.push("sourceHash is missing");

  const totalChars = (summary.overview || "").length + summary.entries.reduce(
    (sum, e) => sum + (e.problemDigest || "").length + (e.priorKnowledge || "").length +
      (e.approach || "").length + (e.approachGuidance || "").length, 0
  );
  if (totalChars > UNIT_SUMMARY_TOTAL_BUDGET_CHARS) {
    errors.push(
      `total summary size (${totalChars} characters) exceeds the ` +
      `${UNIT_SUMMARY_TOTAL_BUDGET_CHARS} character budget`
    );
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// generatedAt is always written by our own code as `new Date().toISOString()`, never typed by an
// author, so round-tripping through Date is a precise check: Date.parse alone accepts non-ISO
// formats ("September 21, 2026") and silently rolls an invalid calendar date like Feb 30 over to
// March 2, and both would otherwise pass as "valid".
function isIsoTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// -- Look-ahead instruction text --

// Shared wording so the authoring export view (for Forever Learning) and, later, each OpenAI
// consumer install the same rule in the same words: a consumer must not draw on curriculum
// content from more than one problem ahead of the student's current problem.
export const UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION =
  "Do not reference or rely on information from any curriculum problem more than one problem " +
  "ahead of the student's current problem. You may use earlier problems, the student's current " +
  "problem, and the next problem; treat anything further ahead as unknown.";

// -- Problem-approach instruction text --

// Installed alongside the look-ahead instruction on every request, including units with no
// aiUnitSummary: it needs no summary to be useful.
export const PROBLEM_APPROACH_INSTRUCTION =
  "Follow the way the student's current problem asks them to work, and never suggest the " +
  "opposite. If the problem asks students to try many different ideas, do not push them to " +
  "settle on one. If it asks them to choose one idea and develop it, do not suggest starting " +
  "over or trying many alternatives; help them improve the one they chose. A problem can change " +
  "approach between its parts -- for example, brainstorming first and then choosing one idea to " +
  "build. Follow the part the student is working on, and support a change of approach when the " +
  "problem itself asks for it. If you cannot tell which part the student is working on, do not " +
  "push them either way: respond to what they are doing, or ask which part they are on. Do not " +
  "contradict the problem's instructions.";

// Teacher Summary describes a class's work to a teacher rather than talking to one student, so
// "the student's current problem" does not fit. Its output reaches a student through the AI
// Tile's prompt, so it still must not push the opposite approach.
export const PROBLEM_APPROACH_INSTRUCTION_CLASS =
  "Follow the way the class's current problem asks students to work, and never suggest the " +
  "opposite. If the problem asks students to try many different ideas, do not push them to " +
  "settle on one. If it asks them to choose one idea and develop it, do not suggest starting " +
  "over or trying many alternatives. A problem can change approach between its parts -- for " +
  "example, brainstorming first and then choosing one idea to build. Follow the part the " +
  "students' work shows they are on, and do not recommend a direction that part does not ask " +
  "for. If you cannot tell, do not push the class either way. Do not contradict the problem's " +
  "instructions.";
