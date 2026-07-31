import { kDividerHalf } from "../../models/stores/ui-types";

export interface IWideContentLayoutState {
  /** appConfig.contentLayout — "wideContent" opts into the narrow-resources behavior. */
  contentLayout: "evenLayout" | "wideContent" | undefined;
  showLeftPanel: boolean;
  showRightPanel: boolean;
  /** persistentUI.dividerPosition (kDividerMin/Half/Max). */
  dividerPosition: number;
  /** persistentUI.showChatPanel — the comments panel. */
  showChatPanel: boolean;
}

/**
 * Whether the resources pane should be narrowed to its comments-open width (giving the workspace ~2/3).
 * This only applies in the "wideContent" layout while both panes actually share the split (divider
 * centered) and comments are closed; opening comments — or collapsing either pane — restores the even
 * 50/50 split so the comments panel has room.
 */
export function shouldNarrowResources(state: IWideContentLayoutState): boolean {
  const { contentLayout, showLeftPanel, showRightPanel, dividerPosition, showChatPanel } = state;
  return contentLayout === "wideContent"
    && showLeftPanel && showRightPanel
    && dividerPosition === kDividerHalf
    && !showChatPanel;
}
