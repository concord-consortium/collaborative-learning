import { UnitModelType } from "../models/curriculum/unit";
import { ProblemModelType } from "../models/curriculum/problem";
import { IStores } from "../models/stores";
import { Logger } from "./logger";

export const setTitle = (showDemoCreator?: boolean, problem?: ProblemModelType) => {
  document.title = showDemoCreator ? `CLUE: Demo Creator` : (problem ? `CLUE: ${problem.fullTitle}` : document.title);
};

export const updateProblem = (stores: IStores, problemId: string) => {
  const {unit, showDemoCreator} = stores;
  const {investigation, problem} = unit.getProblem(problemId);
  if (investigation && problem) {
    Logger.updateProblem(investigation, problem);
    setTitle(showDemoCreator, problem);
    stores.supports.createFromUnit(unit, investigation, problem);
    stores.problem = problem;
  }
};
