import {Request, Response} from "express";
import {defineSecret, defineString} from "firebase-functions/params";

import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {isValidUnitCode} from "../helpers/image-references";
import {assembleUnit} from "../helpers/assemble-unit";
import {runUnitSummaryGeneration} from "../helpers/unit-summary-generate";
import {createUnitSummaryOpenAIClient} from "../helpers/unit-summary-openai";

// Bound to the `api` function via runWith({secrets: [...]}) in index.ts, using the same name.
const openaiUnitSummaryKey = defineSecret("OPENAI_UNIT_SUMMARY_API_KEY");
const digestModel = defineString("UNIT_SUMMARY_DIGEST_MODEL");
const summaryModel = defineString("UNIT_SUMMARY_MODEL");

// POST /generateUnitSummary?unit=...&branch=... -- CC-staff-only (see requireCCAccess in index.ts).
// Assembles the unit, runs the digest / prior-knowledge / overview steps, validates the result,
// and returns it. The frontend never round-trips the unit text; the OpenAI key stays server-side.
const generateUnitSummary = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }
  if (!isValidUnitCode(unit)) {
    return sendErrorResponse(res, "Invalid unit code.", 400);
  }

  try {
    const client = createUnitSummaryOpenAIClient(openaiUnitSummaryKey.value());
    const summary = await runUnitSummaryGeneration(branch, unit, {
      assembleUnit,
      client,
      digestModel: digestModel.value(),
      summaryModel: summaryModel.value(),
    });
    return sendSuccessResponse(res, {summary});
  } catch (error) {
    console.error("Failed to generate unit summary:", error);
    const message = error instanceof Error ? error.message : String(error);
    return sendErrorResponse(res, message, 500);
  }
};

export default generateUnitSummary;
