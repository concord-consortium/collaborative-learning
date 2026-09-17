/**
 * Messages shown to a student about AI evaluation of their document, across the Ideas button and
 * the AI tile: instead of sending an empty document (one with no `documentHasStudentWork`, see
 * shared/ai-analysis-classify.ts) to the AI for evaluation, or when an Ideas request could not be
 * completed at all. Exported as constants so the components that render them and the tests that
 * check them read the exact same string.
 */

export const IDEAS_EMPTY_MESSAGE = "Add some work to your document before requesting Ideas";

export const IDEAS_REQUEST_FAILED_MESSAGE = "Something went wrong requesting Ideas. Please try again";

export const AI_TILE_EMPTY_MESSAGE = "Add some work to your document to get additional tips on proceeding";
