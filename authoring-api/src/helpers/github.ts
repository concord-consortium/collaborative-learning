import {Octokit} from "@octokit/rest";

export const owner = "concord-consortium";
export const repo = "clue-curriculum";

export const newOctoKit = (auth: string) => {
  return new Octokit({auth});
};

export const baseCurriculumPath = "curriculum";
export const getBaseUnitPath = (unit: string) => `${baseCurriculumPath}/${unit}/`;

export const getRawCurriculumUrl = (branch: string) => {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${baseCurriculumPath}/`;
};

export const getRawUrl = (branch: string, unit: string, path: string) => {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${getBaseUnitPath(unit)}${path}`;
};
