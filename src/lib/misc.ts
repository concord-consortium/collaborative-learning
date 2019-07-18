import { UnitModelType } from "../models/curriculum/unit";
import { ProblemModelType } from "../models/curriculum/problem";
import { IStores } from "../models/stores/stores";
import { Logger } from "./logger";

export const setTitle = (showDemoCreator?: boolean, unit?: UnitModelType, problem?: ProblemModelType) => {
  const pageTitleTemplate = unit && unit.pageTitle;
  let pageTitle;
  if (pageTitleTemplate) {
    pageTitle = pageTitleTemplate
                  .replace("%unitTitle%", unit && unit.fullTitle || "")
                  .replace("%problemTitle%", problem && problem.fullTitle || "");
  }
  document.title = showDemoCreator
                    ? `CLUE: Demo Creator`
                    : (pageTitle || document.title);
};

export const updateProblem = (stores: IStores, problemId: string) => {
  const {unit, showDemoCreator} = stores;
  const {investigation, problem} = unit.getProblem(problemId);
  if (investigation && problem) {
    Logger.updateProblem(investigation, problem);
    setTitle(showDemoCreator, unit, problem);
    stores.supports.createFromUnit(unit, investigation, problem);
    stores.problem = problem;
  }
};
