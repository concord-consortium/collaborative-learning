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
  if (!investigations || rootPart !== "investigations") return undefined;

  const [, investigationIndexStr] = /^investigation-(\d+)$/.exec(investigationPart ?? "") ?? [];
  if (!investigationIndexStr) return undefined;
  const investigationIndex = parseInt(investigationIndexStr, 10);
  if (investigationIndex < 0 || investigationIndex >= investigations.length) return undefined;
  const investigation = investigations[investigationIndex];

  const [, problemIndexStr] = /^problem-(\d+)$/.exec(problemPart ?? "") ?? [];
  if (!problemIndexStr) return undefined;
  const problemIndex = parseInt(problemIndexStr, 10);
  if (problemIndex < 0 || problemIndex >= investigation.problems.length) return undefined;
  const problem = investigation.problems[problemIndex];

  return `${investigation.ordinal}.${problem.ordinal}`;
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
