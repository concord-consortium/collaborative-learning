import { IAnyStateTreeNode } from "mobx-state-tree";
import { HighlightReference } from "./highlight-reference";

/**
 * What a highlight *source* needs from the document it points into — the narrow slice of
 * `DocumentContentModelWithHighlights` that driving a highlight actually uses.
 *
 * A source depends on this rather than on the composed `DocumentContentModelType` so the contract
 * it relies on is stated in one place, instead of being implied by which handful of a document's
 * many members the source happens to call.
 *
 * It extends `IAnyStateTreeNode` because a source is generally also handing the same node to
 * something that observes the document itself — the chat tutor passes it to a summarizer that
 * watches patches. The MST-ness is a real requirement, not an accident of where the type came from.
 *
 * Both `…IfOwn` clears take the source's own token: several sources share one document and two of
 * them can name the same object, so ownership is decided by token rather than by comparing
 * references. See docs/highlights.md.
 */
export interface IHighlightContentModel extends IAnyStateTreeNode {
  /** The token of whichever source currently owns the pin, or undefined when nothing is pinned. */
  pinnedHighlightSource: string | undefined;
  setHoveredHighlightRef(ref: HighlightReference, source?: string): void;
  clearHoveredHighlightRefIfOwn(source: string | undefined): void;
  togglePinnedHighlightRef(ref: HighlightReference, source?: string): void;
  clearPinnedHighlightRefIfOwn(source: string | undefined): void;
}
