import { IInvestigation, IProblem, IUnit } from "../types";

export interface UsageLocation {
  path: string;
  isTeacherGuide: boolean;
  investigationTitle?: string;
  problemTitle?: string;
  sectionType?: string;
}

const teacherGuidePrefix = "teacher-guide/";

// The section type is the directory immediately before content.json,
// e.g. "investigation-0/problem-1/introduction/content.json" -> "introduction".
function sectionTypeFromPath(relativePath: string): string | undefined {
  const segments = relativePath.split("/");
  return segments.length >= 2 ? segments[segments.length - 2] : undefined;
}

type InvAndProblem = { inv: IInvestigation; problem: IProblem };

// Find the investigation/problem that declares this exact section path.
function findByDeclaredSection(config: IUnit, relativePath: string): InvAndProblem | undefined {
  for (const inv of config.investigations ?? []) {
    for (const problem of inv.problems ?? []) {
      if ((problem.sections ?? []).includes(relativePath)) {
        return { inv, problem };
      }
    }
  }
  return undefined;
}

// Fallback: identify the investigation/problem by the ordinals embedded in the path,
// e.g. "investigation-1/problem-2/..." -> investigation ordinal 1, problem ordinal 2.
function findByOrdinals(config: IUnit, relativePath: string): InvAndProblem | undefined {
  const match = /investigation-(\d+)\/problem-(\d+)/.exec(relativePath);
  if (!match) return undefined;
  const invOrdinal = Number(match[1]);
  const problemOrdinal = Number(match[2]);
  const inv = (config.investigations ?? []).find(i => i.ordinal === invOrdinal);
  const problem = inv?.problems?.find(p => p.ordinal === problemOrdinal);
  return inv && problem ? { inv, problem } : undefined;
}

/**
 * Maps a content-file path (relative to curriculum/{unit}/, as returned by the getImageUsages
 * endpoint) to a human-readable location using the unit and teacher-guide configs already loaded
 * client-side. Prefers the declared section structure; falls back to parsing the
 * investigation/problem ordinals from the path.
 */
export function describeUsagePath(
  path: string,
  unitConfig: IUnit | undefined,
  teacherGuideConfig: IUnit | undefined
): UsageLocation {
  const isTeacherGuide = path.startsWith(teacherGuidePrefix);
  const relativePath = isTeacherGuide ? path.slice(teacherGuidePrefix.length) : path;
  const config = isTeacherGuide ? teacherGuideConfig : unitConfig;

  const sectionType = sectionTypeFromPath(relativePath);
  const found = config && (findByDeclaredSection(config, relativePath) ?? findByOrdinals(config, relativePath));

  return {
    path,
    isTeacherGuide,
    investigationTitle: found?.inv.title,
    problemTitle: found?.problem.title,
    sectionType
  };
}
