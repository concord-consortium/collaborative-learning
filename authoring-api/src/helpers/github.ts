import {Octokit} from "@octokit/rest";

export const owner = "concord-consortium";
export const repo = "clue-curriculum";

// TODO: change auth to required to avoid rate limiting
export const newOctoKit = (auth?: string) => new Octokit({auth});

export const baseCurriculumPath = "curriculum";
export const getBaseUnitPath = (unit: string) => `${baseCurriculumPath}/${unit}/`;

export const getRawUrl = (branch: string, unit: string, path: string) => {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${getBaseUnitPath(unit)}${path}`;
};
