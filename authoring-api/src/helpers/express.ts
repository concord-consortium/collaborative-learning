import {Response} from "express";

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
