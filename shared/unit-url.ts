// Reproduces the "main" branch, canonical-code slice of getUnitUrl/curriculumBaseUrl in
// src/models/stores/curriculum-config.ts, for server-side (functions-v2) consumers that have no
// urlParams/env to build an MST CurriculumConfig from. curriculumSiteUrl and unitCodeMap are
// authored once, in the co-located curriculum-config.json, and imported directly here rather than
// copied, so this can't drift from what the client actually uses. It lives here rather than under
// src/ because shared/ is loaded by Cloud Functions, which cannot depend on anything under src/.
//
// v1 limitation: this always builds the "main" branch URL. A class running on a branch-preview
// deploy whose curriculum differs from main still resolves to main's content.json here -- there
// is no branch on document metadata for a server-side consumer to read instead. See
// get-unit-summary.ts and docs/unit-configuration.md.
import curriculumConfigJson from "./curriculum-config.json";

interface ICurriculumConfigJson {
  curriculumSiteUrl: string;
  unitCodeMap: Record<string, string>;
}

const curriculumConfig = curriculumConfigJson as ICurriculumConfigJson;

/**
 * The published-content URL for a unit's "main" branch content.json, applying unitCodeMap to
 * resolve a legacy/alias unit code to its canonical short code first (an unmapped code is
 * assumed already canonical, same as getUnitUrl).
 */
export function mainBranchUnitJsonUrl(unitCode: string): string {
  const canonicalCode = curriculumConfig.unitCodeMap[unitCode] || unitCode;
  return `${curriculumConfig.curriculumSiteUrl}/branch/main/${canonicalCode}/content.json`;
}
