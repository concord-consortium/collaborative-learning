import { getVisibleFocusables } from "@concord-consortium/accessibility-tools/hooks";
import { getEditableTitleElement } from "../../../utilities/dom-utils";
import { getConnectTutorialElement } from "./ui/dataflow-connect-tutorial";

export interface IDataflowFocusSlotsArgs {
  tileElt: HTMLElement | null | undefined;
  programContainerEl: HTMLElement | null | undefined;
}

/**
 * The elements the tile reports to the keyboard focus trap, read live each time focus moves.
 * While the connect dialog shows, it is the only slot besides the toolbar: the title, topbar and
 * palette are hidden from the trap so Tab and Enter can't reach controls the dialog covers.
 */
export function getDataflowFocusSlots({ tileElt, programContainerEl }: IDataflowFocusSlotsArgs) {
  const dialog = getConnectTutorialElement(tileElt);
  if (dialog) {
    return { title: undefined, content: dialog, topbar: undefined, palette: undefined };
  }

  const contentEl = programContainerEl?.querySelector<HTMLElement>(".dataflow-program-content");
  return {
    title: getEditableTitleElement(tileElt ?? undefined),
    // The focus trap advances past a slot only if it can put focus somewhere inside it, and it
    // treats a slot with no element as "not present" and skips it. An empty program has no
    // focusable blocks (zoom lives in the toolbar), so reporting the element would swallow Tab
    // instead of moving on. Deliberately the accessibility-tools helper rather than the similar
    // one in utilities/dom-utils: this has to agree with what the trap itself counts as
    // focusable, or the slot can be reported as non-empty and swallow Tab anyway.
    content: contentEl && getVisibleFocusables(contentEl).length > 0 ? contentEl : undefined,
    topbar: programContainerEl?.querySelector<HTMLElement>(".program-editor-topbar") ?? undefined,
    palette: programContainerEl?.querySelector<HTMLElement>(".program-toolbar") ?? undefined
  };
}
