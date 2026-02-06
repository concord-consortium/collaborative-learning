import { IInvestigation, IProblem, ISection, IUnit } from "../../../types";
import { CurriculumItem, getSectionTypeFromPath } from "../../../utils/nav-path";
import { ProblemSectionFormItem } from "./container-config-types";

export function isUnit(item: CurriculumItem): item is IUnit {
  return "investigations" in item && Array.isArray(item.investigations);
}

export function isInvestigation(item: CurriculumItem): item is IInvestigation {
  return "problems" in item && Array.isArray(item.problems);
}

export function isProblem(item: CurriculumItem): item is IProblem {
  return "sections" in item && Array.isArray(item.sections);
}

// Build form data for problem sections.
// Returns enabled sections first (in their saved order from problem.sections),
// then disabled sections (in the order they appear in availableSections).
// sectionPathPrefix: "" for regular sections, "teacher-guide/" for teacher guide sections.
// The files map keys include this prefix, but problem.sections stores paths without it.
export function buildProblemSectionsFormData(
  problem: IProblem,
  availableSections: Record<string, ISection>,
  files: Record<string, { type?: string }> | undefined,
  sectionPathPrefix = ""
): ProblemSectionFormItem[] {
  const existingPathsByType = new Map<string, string>();
  problem.sections.forEach((sectionPath) => {
    const file = files?.[sectionPathPrefix + sectionPath];
    const sectionType = file?.type ?? getSectionTypeFromPath(sectionPath);
    if (sectionType) {
      existingPathsByType.set(sectionType, sectionPath);
    }
  });

  const enabledTypes = new Set(existingPathsByType.keys());

  // 1. Enabled sections first, in their saved order (from problem.sections)
  const enabledItems: ProblemSectionFormItem[] = [];
  problem.sections.forEach((sectionPath) => {
    const file = files?.[sectionPathPrefix + sectionPath];
    const sectionType = file?.type ?? getSectionTypeFromPath(sectionPath);
    if (sectionType && availableSections[sectionType]) {
      enabledItems.push({
        type: sectionType,
        enabled: true,
        existingPath: sectionPath,
      });
    }
  });

  // 2. Disabled sections after, in the order they appear in availableSections
  const disabledItems: ProblemSectionFormItem[] = Object.keys(availableSections)
    .filter((sectionType) => !enabledTypes.has(sectionType))
    .map((sectionType) => ({
      type: sectionType,
      enabled: false,
    }));

  return [...enabledItems, ...disabledItems];
}

// Extract investigation index from path.
// Paths are: "investigations/investigation-{n}/problem-{m}" or "teacher-guides/investigation-{n}/problem-{m}"
export function parseItemPath(itemPath: string): {
  investigationIndex: number;
  isTeacherGuide: boolean;
} | undefined {
  const parts = itemPath.split("/");
  const root = parts[0];
  if (root !== "investigations" && root !== "teacher-guides") {
    return undefined;
  }
  const isTeacherGuide = root === "teacher-guides";

  const invMatch = /^investigation-(\d+)$/.exec(parts[1] || "");
  if (!invMatch) return undefined;

  return {
    investigationIndex: parseInt(invMatch[1], 10),
    isTeacherGuide,
  };
}
