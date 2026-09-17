/**
 * The messages shown to a student instead of sending an empty document (one with no
 * `documentHasStudentWork`, see shared/ai-analysis-classify.ts) to the AI for evaluation.
 * Exported as constants so the components that render them and the tests that check them read the
 * exact same string.
 */

export const IDEAS_EMPTY_MESSAGE = "Add some work to your document before requesting Ideas";

export const AI_TILE_EMPTY_MESSAGE = "Add some work to your document to get additional tips on proceeding";
