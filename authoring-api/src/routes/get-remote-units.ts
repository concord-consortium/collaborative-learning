import {Request, Response} from "express";
import {Octokit} from "@octokit/rest";
import {baseCurriculumPath, owner, repo} from "../helpers/github";

import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const getRemoteUnits = async (req: Request, res: Response) => {
  const branch = req.query.branch?.toString();
  if (!branch) {
    return sendErrorResponse(res, "Missing required parameter: branch.", 400);
  }
  if (branch === "main") {
    return sendErrorResponse(res, "Cannot get remote units on the main branch.", 400);
  }

  try {
    const authorizedRequest = req as AuthorizedRequest;
    const octokit = new Octokit({auth: authorizedRequest.gitHubToken});

    const {data} = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: baseCurriculumPath,
      ref: branch,
    });

    if (Array.isArray(data) === false) {
      return sendErrorResponse(res, "Unexpected response from GitHub API.", 500);
    }

    const units = data
      .filter((item) => item.type === "dir")
      .map((item) => item.name);

    return sendSuccessResponse(res, {units});
  } catch (error) {
    console.error("Failed to fetch repository tree:", error);
    return sendErrorResponse(res, "An error occurred while fetching the repository data.");
  }
};

export default getRemoteUnits;
