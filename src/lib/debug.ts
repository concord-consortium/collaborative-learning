const debug = (typeof window !== 'undefined' && window.localStorage
  ? window.localStorage.getItem("debug")
  : undefined) || "";
if (debug.length > 0) {
  // eslint-disable-next-line no-console
  console.info("DEBUG:", debug);
}

const debugContains = (key: string) => debug.indexOf(key) !== -1;

/**
 * Format and print a message to the browser console if its debug key is set.
 * The first argument is a boolean; no message will be printed if it is false.
 * Usually the argument should be one of the debugging constants defined in this file.
 *
 * Note that since this is a regular function, its arguments will be evaluated before the
 * "enabled" flag is checked. If there are any expensive computations or things that may
 * result in errors, you should instead use an explicit
 *     `if (flag) { ...log something... }
 *
 * @param enabled whether the message should be output.
 * @param message object passed to console.log for printing, may contain argument placeholders.
 * @param params additional parameters to insert into message.
 */
export function debugLog(enabled: boolean, message: any, ...params: any[]) {
  if (enabled) {
    // eslint-disable-next-line no-console
    console.log(message, ...params);
  }
}

export const DEBUG_BOOKMARKS = debugContains("bookmarks");
export const DEBUG_CANVAS = debugContains("canvas");
export const DEBUG_IFRAME = debugContains("iframe");
export const DEBUG_DATAFLOW = debugContains("dataflow");
export const DEBUG_DOC_LIST = debugContains("docList");
export const DEBUG_DOCUMENT = debugContains("document");
export const DEBUG_DROP = debugContains("drop");
export const DEBUG_FIRESTORE = debugContains("firestore");
export const DEBUG_HISTORY = debugContains("history");
export const DEBUG_IMAGES = debugContains("images");
export const DEBUG_LISTENERS = debugContains("listeners");
export const DEBUG_LOADING = debugContains("loading");
export const DEBUG_LOGGER = debugContains("logger");
export const DEBUG_SAVE = debugContains("save");
export const DEBUG_SHARED_MODELS = debugContains("sharedModels");
export const DEBUG_STORES = debugContains("stores");
export const DEBUG_UNDO = debugContains("undo");
