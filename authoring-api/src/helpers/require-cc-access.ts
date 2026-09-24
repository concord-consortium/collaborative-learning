import {NextFunction, Request, Response} from "express";
import {AuthorizedRequest, sendErrorResponse} from "./express";

// Doug's old zoopdoop.com email is what Firebase auth sets as the GitHub provider email in the
// generated auth token even though it is not used on GitHub anymore. Leslie's mit.edu and Teale's
// gmail addresses are what they each use for GitHub.
const otherCCEmailAddresses = ["doug@zoopdoop.com", "lbond@alum.mit.edu", "fristoe@gmail.com"];

export const isCCEmail = (email: string): boolean =>
  email.endsWith("@concord.org") || otherCCEmailAddresses.includes(email);

// CC-staff-only; attach per route.
export const requireCCAccess = (req: Request, res: Response, next: NextFunction) => {
  const email = (req as AuthorizedRequest).decodedToken.email;
  if (email && isCCEmail(email)) {
    return next();
  }
  return sendErrorResponse(res, "Only Concord Consortium staff can use this action.", 403);
};
