import { useCallback, useEffect, useRef } from "react";
import { IAnyStateTreeNode, onPatch } from "mobx-state-tree";
import { RightSummary, summarizeRight } from "./right-context";

interface CachedSummary {
  node: IAnyStateTreeNode;
  summary: RightSummary;
}

// Tracks whether the workspace document has changed since the last summary,
// flipping only a boolean per patch — the expensive summarize runs lazily at
// send time and only when dirty. State is keyed on documentKey: switching
// documents tears down the patch listener and re-attaches to the new content
// node (which may still be undefined while the document loads).
export function useRightDirty(documentKey: string | undefined, content: IAnyStateTreeNode | undefined) {
  const dirtyRef = useRef(true);
  const cachedRef = useRef<CachedSummary | undefined>(undefined);

  useEffect(() => {
    dirtyRef.current = true;
    if (!content) return;
    return onPatch(content, () => {
      dirtyRef.current = true;
    });
  }, [documentKey, content]);

  // Returns the current summary, recomputing only if the document changed;
  // undefined while the document content hasn't loaded. The cache records the
  // node it was computed from, so a just-switched document can never be served
  // the previous document's summary.
  return useCallback((): RightSummary | undefined => {
    if (!content) return undefined;
    let cached = cachedRef.current;
    if (dirtyRef.current || !cached || cached.node !== content) {
      cached = { node: content, summary: summarizeRight(content) };
      cachedRef.current = cached;
      dirtyRef.current = false;
    }
    return cached.summary;
  }, [content]);
}
