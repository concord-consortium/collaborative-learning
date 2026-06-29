export const owner = "concord-consortium";
export const repo = "clue-curriculum";

export const baseCurriculumPath = "curriculum";
export const getBaseUnitPath = (unit: string) => `${baseCurriculumPath}/${unit}/`;

export const getRawCurriculumUrl = (branch: string) => {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${baseCurriculumPath}/`;
};

export const getRawUrl = (branch: string, unit: string, path: string) => {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${getBaseUnitPath(unit)}${path}`;
};

// Maps a caught error to a client-facing message + status. Octokit throws a RequestError carrying a
// numeric `status`; we duck-type it (rather than `instanceof`) so duplicate package copies can't
// defeat the check. Known GitHub failures get an actionable message; anything else falls back to the
// caller's generic message so we never leak internal/unexpected error detail to the client.
export function describeGitHubError(error: unknown, fallbackMessage: string): {message: string; statusCode: number} {
  const status = typeof (error as {status?: unknown})?.status === "number" ?
    (error as {status: number}).status :
    undefined;
  switch (status) {
  case 401:
  case 403:
    return {
      message: "Could not authenticate with GitHub. Your session may have expired — sign in again and retry.",
      statusCode: 502,
    };
  case 404:
    return {
      message: "The image or branch was not found on GitHub. It may have been moved or deleted.",
      statusCode: 404,
    };
  case 409:
  case 422:
    return {message: "The branch changed during the operation. Please retry.", statusCode: 409};
  default:
    return {message: fallbackMessage, statusCode: 500};
  }
}
