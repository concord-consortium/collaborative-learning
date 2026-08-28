import {type AnalysisQueueDocument} from "./on-analyzable-doc-written";

// What the second AI analysis function hands to the third. The `done` queue is mined by the
// evaluation harness and by scripts/survey-class-documents.ts, so these names are a contract.

/** Why a representation was deliberately not sent. A fixed code, never free text. */
export type OmittedReason = "no-student-work-in-summary" | "no-visual-content" | "images-disabled";

/** What the document holds, from walking its tiles. */
export interface AnalysisClassification {
  modality: "mixed" | "text-only" | "visual-only" | "empty";
  hasStudentText: boolean;
  /**
   * Whether the summary would put student work in front of the model, which is what `sendSummary`
   * is decided from. Broader than `hasStudentText`: a drawing with no labels carries no text and
   * its summary still describes what the student drew. Recorded so a `done` record explains its own
   * `sendSummary` without anyone re-running the classifier over the document to find out why.
   */
  summaryCarriesStudentWork: boolean;
  needsImage: boolean;
  /**
   * Whether a picture is needed to make sense of the question rather than of the answer. A
   * question's authored prompt can be an image, which no summary carries, so an answer sent
   * without a screenshot would be judged without the question it answers.
   */
  promptNeedsImage: boolean;
}

/**
 * A record for a real evaluator.
 *
 * Omission and failure are separate fields on purpose. A representation that was left out by
 * decision carries an `…OmittedReason` code; one that was meant to be there and could not be
 * produced carries an `…Error` string. Anything mining the `done` queue can then count each
 * without parsing text. Exactly one of the pair is set when the matching `send…` is false, and
 * neither is set when it is true.
 */
export interface AnalysisImagedQueueDocument extends AnalysisQueueDocument {
  analysisVersion: 2; // records without it are legacy; see representationsOf in the next function
  evaluator: "categorize-design" | "custom";
  /**
   * Compatibility hint for the previous version of the next function, which chooses its path from
   * this field: "text" when only the summary is being sent, otherwise "image". Written for as long
   * as that version might still be running, which is the few seconds of a deploy; it and the
   * legacy branch that reads it go in the same cleanup.
   */
  summarizer: "text" | "image";
  classification: AnalysisClassification;
  renderTarget: {clueUrl: string; unit: string};
  /** Present whenever the summarizer succeeded, whether or not the summary is being sent. */
  docSummary?: string;
  sendSummary: boolean;
  summaryOmittedReason?: OmittedReason;
  summaryError?: string;
  docImageUrl?: string;
  docImaged?: unknown; // server timestamp
  sendImage: boolean;
  imageOmittedReason?: OmittedReason;
  imageError?: string;
}

/** The mock evaluator carries nothing: no classification, no representations. */
export interface MockImagedQueueDocument extends AnalysisQueueDocument {
  analysisVersion: 2;
  evaluator: "mock";
  sendSummary: false;
  sendImage: false;
}

export type ImagedQueueDocument = AnalysisImagedQueueDocument | MockImagedQueueDocument;
