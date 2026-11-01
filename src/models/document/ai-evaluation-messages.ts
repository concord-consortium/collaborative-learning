/**
 * Messages shown to a student about AI evaluation of their document, across the Ideas button and
 * the AI tile.
 */

export const IDEAS_EMPTY_MESSAGE = "Add some work to your document before requesting Ideas";
export const IDEAS_REQUEST_FAILED_MESSAGE = "Something went wrong requesting Ideas. Please try again";
// Shown while a request is still pending but has stopped looking normal, so a long wait reads as
// unusual rather than as nothing happening. Not a failure: the request may still succeed.
export const IDEAS_SLOW_MESSAGE = "Ada is taking longer than usual...";
export const AI_TILE_EMPTY_MESSAGE = "Add some work to your document to get additional tips on proceeding";
export const AI_TILE_REQUEST_FAILED_MESSAGE = "Something went wrong getting tips. Please try again";
