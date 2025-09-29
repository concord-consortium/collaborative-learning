import {Request, Response} from "express";
import {DecodedIdToken} from "firebase-admin/auth";

export interface AuthorizedRequest extends Request{
  decodedToken: DecodedIdToken;
  gitHubToken: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendSuccessResponse = (res: Response, data: any) => {
  res
    .setHeader("Content-Type", "application/json")
    .status(200)
    .send({success: true, ...data});
};

export const sendErrorResponse = (res: Response, message: string, statusCode?: number) => {
  res
    .setHeader("Content-Type", "application/json")
    .status(statusCode || 500)
    .send({success: false, error: message});
};
