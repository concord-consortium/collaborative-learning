import { IInvestigation, IProblem, IUnit, IUnitFiles } from "../types";

export type CurriculumItem = IUnit | IInvestigation | IProblem;

export const getUnitItem = (unit: IUnit | undefined, pathParts: string[]): CurriculumItem | undefined => {
  if (!unit || pathParts.length === 0) {
    return undefined;
  }

  if (pathParts.length === 1) {
    return unit;
  }
  const matchInvestigation = /^investigation-(\d+)$/.exec(pathParts[1]);
  const investigationIndex = matchInvestigation ? parseInt(matchInvestigation[1], 10) : undefined;
  if (investigationIndex === undefined ||
    investigationIndex < 0 || investigationIndex >= (unit.investigations?.length || 0)
  ) {
    return undefined;
  }
  const investigation = unit.investigations![investigationIndex];
  if (pathParts.length === 2) {
    return investigation;
  }
  const matchProblem = /^problem-(\d+)$/.exec(pathParts[2]);
  const problemIndex = matchProblem ? parseInt(matchProblem[1], 10) : undefined;
  if (problemIndex === undefined ||
    problemIndex < 0 || problemIndex >= (investigation.problems?.length || 0)
  ) {
    return undefined;
  }
  const problem = investigation.problems![problemIndex];
  if (pathParts.length === 3) {
    return problem;
  }
  // We might want to return other things. Or we might want to use something like json path to simplify
  // this lookup instead of a custom approach like this.
  return undefined;
};

export const getCurriculumItem = (
  unitConfig: IUnit | undefined,
  teacherGuideConfig: IUnit | undefined,
  path: string
): CurriculumItem | undefined => {
  if (!path) {
    return undefined;
  }

  const pathParts = path.split("/");
  if (pathParts[0] === "investigations" && unitConfig) {
    return getUnitItem(unitConfig, pathParts);
  }

  if (pathParts[0] === "teacher-guides" && teacherGuideConfig) {
    return getUnitItem(teacherGuideConfig, pathParts);
  }
  return undefined;
};

const kContainerConfigurationLabel = "⚙️ Configuration";

export const getProblemOrdinal = (unitConfig: IUnit | undefined, path: string | undefined): string | undefined => {
  const investigations = unitConfig?.investigations;
  const [rootPart, investigationPart, problemPart] = path?.split("/") ?? [];
  const [, investigationIndexStr] = /^investigation-(\d+)$/.exec(investigationPart ?? "") ?? [];
  const [, problemIndexStr] = /^problem-(\d+)$/.exec(problemPart ?? "") ?? [];
  const investigationIndex = parseInt(investigationIndexStr, 10);
  const problemIndex = parseInt(problemIndexStr, 10);
  const investigation = investigations?.[investigationIndex];
  const problem = investigation?.problems[problemIndex];

  if (rootPart !== "investigations" || !investigation || !problem) {
    return undefined;
  }

  return `${investigation.ordinal}.${problem.ordinal}`;
};

/**
 * Extract the section type from a section file path.
 * Example: "investigation-1/problem-1/whatIf/content.json" -> "whatIf"
 * Example: "whatIf/content.json" -> "whatIf"
 */
export const getSectionTypeFromPath = (sectionPath: string): string | undefined => {
  const match = /(?:^|\/)([^/]+)\/content\.json$/.exec(sectionPath);
  return match?.[1];
};

/**
 * Infer the problem's base path from existing section paths.
 * Example: ["investigation-1/problem-1/intro/content.json"] -> "investigation-1/problem-1"
 */
export const inferProblemBasePath = (existingSectionPaths: string[]): string | undefined => {
  if (existingSectionPaths.length === 0) return undefined;
  const firstPath = existingSectionPaths[0];
  const match = /^(.+)\/[^/]+\/content\.json$/.exec(firstPath);
  return match?.[1];
};

/**
 * Extract the path pattern from an existing problem's section paths.
 * Returns the pattern with placeholders for ordinals that can be applied to other problems.
 */
const extractPathPattern = (
  sectionPath: string
): { prefix: string; invPattern: string; probPattern: string } | undefined => {
  const match = /^(.*?)(investigation-)\d+(\/problem-)\d+\//.exec(sectionPath);
  if (!match) return undefined;
  return {
    prefix: match[1],
    invPattern: match[2],
    probPattern: match[3],
  };
};

/**
 * Find an existing section path from any problem in the unit to infer the path convention.
 * Searches sibling problems first, then other investigations.
 */
export const findPathPatternFromUnit = (
  config: IUnit | undefined,
  currentInvestigationIndex: number
): { prefix: string; invPattern: string; probPattern: string } | undefined => {
  if (!config?.investigations) return undefined;

  const currentInvestigation = config.investigations[currentInvestigationIndex];
  if (currentInvestigation?.problems) {
    for (const problem of currentInvestigation.problems) {
      if (problem.sections?.length > 0) {
        const pattern = extractPathPattern(problem.sections[0]);
        if (pattern) return pattern;
      }
    }
  }

  for (let i = 0; i < config.investigations.length; i++) {
    if (i === currentInvestigationIndex) continue;
    const inv = config.investigations[i];
    for (const problem of inv.problems || []) {
      if (problem.sections?.length > 0) {
        const pattern = extractPathPattern(problem.sections[0]);
        if (pattern) return pattern;
      }
    }
  }

  return undefined;
};

/**
 * Generate a section file path for a given section type.
 */
export const generateSectionPath = (
  problemBasePath: string,
  sectionType: string
): string => {
  return `${problemBasePath}/${sectionType}/content.json`;
};

/**
 * Get the problem base path for generating new section file paths.
 * Returns prefix-free paths — the caller handles any teacher-guide prefix
 * via sectionPathPrefix at the files map / saveContent layer.
 *
 * Priority:
 * 1. Infer from current problem's existing section paths
 * 2. Infer pattern from other problems in the unit, apply current ordinals
 * 3. Fall back to ordinal-based default: "investigation-{inv.ordinal}/problem-{prob.ordinal}"
 */
export const getProblemBasePath = (
  existingSectionPaths: string[],
  unitConfig: IUnit | undefined,
  investigation: IInvestigation,
  investigationIndex: number,
  problemOrdinal: number,
): string => {
  const inferredPath = inferProblemBasePath(existingSectionPaths);
  if (inferredPath) {
    return inferredPath;
  }

  const pattern = findPathPatternFromUnit(unitConfig, investigationIndex);
  if (pattern) {
    return `${pattern.prefix}${pattern.invPattern}${investigation.ordinal}${pattern.probPattern}${problemOrdinal}`;
  }

  return `investigation-${investigation.ordinal}/problem-${problemOrdinal}`;
};

export const getUnitChildrenTree = (
  unit: IUnit | undefined,
  files: IUnitFiles | undefined,
  sectionPathPrefix = ""
) => {
  return [
    {
      id: "containerConfig",
      label: kContainerConfigurationLabel,
    },
    ...unit?.investigations?.map((investigation, investigationIndex) => ({
      id: `investigation-${investigationIndex}`,
      label: investigation.title,
      children: [
        {
          id: "containerConfig",
          label: kContainerConfigurationLabel,
        },
        ...investigation.problems?.map((problem, problemIndex) => ({
          id: `problem-${problemIndex}`,
          label: problem.title,
          children: [
            {
              id: "containerConfig",
              label: kContainerConfigurationLabel,
            },
            ...problem.sections?.map((sectionPath, sectionIndex) => {
              const path: string = sectionPathPrefix + sectionPath;
              const file = files?.[path];
              const section = file && file.type ? unit.sections?.[file.type] : undefined;
              return {
                id: `section-${sectionIndex}`,
                label: section?.title ?? `Unknown Section (${path})`,
                path
              };
            }) || [],
          ]
        })) || [],
      ]
    })) || []
  ];
};
