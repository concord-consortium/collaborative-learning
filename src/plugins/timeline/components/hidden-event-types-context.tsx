import { createContext, useContext } from "react";

export interface IHiddenEventTypes {
  /** The event types switched off in this pane's Event Key. */
  types: string[];
  toggle: (eventType: string) => void;
}

/**
 * Which event types this pane has switched off, and how to switch one.
 *
 * It is per pane rather than on the content model because CLUE shows one document model in more
 * than one pane at a time: My Work renders a student's own document read-only beside the editable
 * workspace, and the doc editor does the same. A reader's filtering kept on the model would reach
 * the editable pane, where the Event Key would then draw one thing and save another.
 *
 * So a read-only pane seeds its set from the document once, at mount, and from then on the two
 * diverge: an author switching a type off afterwards does not change what the reader sees, and the
 * reader's choices are dropped when the pane closes. Reconciling them would mean deciding whose
 * choice wins on each type, which is not something either person asked for.
 */
export const HiddenEventTypesContext = createContext<IHiddenEventTypes>({ types: [], toggle: () => undefined });

export const useHiddenEventTypes = () => useContext(HiddenEventTypesContext);
