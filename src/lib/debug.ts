const debug = (window.localStorage ? window.localStorage.getItem("debug") : undefined) || "";
if (debug.length > 0) {
  // eslint-disable-next-line no-console
  console.info("DEBUG:", debug);
}

const debugContains = (key: string) => debug.indexOf(key) !== -1;

export const DEBUG_BOOKMARKS = debugContains("bookmarks");
export const DEBUG_CANVAS = debugContains("canvas");
export const DEBUG_CMS = debugContains("cms");
export const DEBUG_DOC_LIST = debugContains("docList");
export const DEBUG_DOCUMENT = debugContains("document");
export const DEBUG_DROP = debugContains("drop");
export const DEBUG_HISTORY = debugContains("history");
export const DEBUG_IMAGES = debugContains("images");
export const DEBUG_LISTENERS = debugContains("listeners");
export const DEBUG_LOGGER = debugContains("logger");
export const DEBUG_SAVE = debugContains("save");
export const DEBUG_SHARED_MODELS = debugContains("sharedModels");
export const DEBUG_STORES = debugContains("stores");
export const DEBUG_UNDO = debugContains("undo");
