import { ProblemModelType } from "../models/curriculum/problem";
import { IStores } from "../models/stores/stores";
import { Logger } from "./logger";

export const setPageTitle = (stores: IStores, argProblem?: ProblemModelType) => {
  const { appConfig, showDemoCreator, unit, problem: storeProblem } = stores;
  const pageTitleTemplate = appConfig && appConfig.pageTitle;
  let pageTitle;
  if (pageTitleTemplate) {
    const problem = argProblem || storeProblem;
    pageTitle = pageTitleTemplate
                  .replace("%unitTitle%", unit && unit.fullTitle || "")
                  .replace("%problemTitle%", problem && problem.fullTitle || "");
  }
  document.title = showDemoCreator
                    ? `CLUE: Demo Creator`
                    : (pageTitle || document.title);
};

export const updateProblem = (stores: IStores, problemId: string) => {
  const {unit} = stores;
  const {investigation, problem} = unit.getProblem(problemId);
  if (investigation && problem) {
    Logger.updateProblem(investigation, problem);
    setPageTitle(stores, problem);
    stores.supports.createFromUnit(unit, investigation, problem);
    stores.problem = problem;
  }
};
