import {NextFunction, Request, Response} from "express";
import {isCCEmail} from "../../../shared/cc-email";
import {AuthorizedRequest, sendErrorResponse} from "./express";

// CC-staff-only; attach per route.
export const requireCCAccess = (req: Request, res: Response, next: NextFunction) => {
  const email = (req as AuthorizedRequest).decodedToken.email;
  if (email && isCCEmail(email)) {
    return next();
  }
  return sendErrorResponse(res, "Only Concord Consortium staff can use this action.", 403);
};
