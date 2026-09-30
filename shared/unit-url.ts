// Reproduces the "main"-branch, canonical-code slice of getUnitUrl/curriculumBaseUrl
// (src/models/stores/curriculum-config.ts) for server-side consumers with no CurriculumConfig to
// build from. Imports curriculum-config.json directly rather than duplicating it, so this can't
// drift from the client. Lives in shared/, not src/, because Cloud Functions can't load src/.
//
// Always resolves "main" -- see docs/unit-summary-consumers.md for why that's accepted.
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
