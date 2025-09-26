import {Request, Response} from "express";
import {newOctoKit, owner, repo} from "../helpers/github";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const getRemoteBranches = async (req: Request, res: Response) => {
  const octokit = newOctoKit();

  let page = 1;
  const perPage = 100;
  const branches: string[] = [];
  let keepPaging = true;

  try {
    while (keepPaging) {
      const {data} = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: perPage,
        page,
      });
      branches.push(...data.map((branch) => branch.name));
      keepPaging = data.length === perPage;
      page++;
    }
    sendSuccessResponse(res, {branches});
  } catch (error) {
    sendErrorResponse(res, `Error fetching branches from GitHub: ${error}`);
  }
};

export default getRemoteBranches;
