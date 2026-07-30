import { kDividerHalf, kDividerMin, kDividerMax } from "../../models/stores/ui-types";
import { IWideContentLayoutState, shouldNarrowResources } from "./wide-content-layout";

// The state that narrows the resources pane: wideContent, both panes shown, divider centered, no comments.
const narrowState: IWideContentLayoutState = {
  contentLayout: "wideContent",
  showLeftPanel: true,
  showRightPanel: true,
  dividerPosition: kDividerHalf,
  showChatPanel: false,
};

describe("shouldNarrowResources", () => {
  it("narrows the resources pane in the wideContent layout with both panes shown and comments closed", () => {
    expect(shouldNarrowResources(narrowState)).toBe(true);
  });

  it("does not narrow in the default even layout", () => {
    expect(shouldNarrowResources({ ...narrowState, contentLayout: "evenLayout" })).toBe(false);
    expect(shouldNarrowResources({ ...narrowState, contentLayout: undefined })).toBe(false);
  });

  it("does not narrow when comments are open (the pane needs its full width for the chat)", () => {
    expect(shouldNarrowResources({ ...narrowState, showChatPanel: true })).toBe(false);
  });

  it("does not narrow unless the divider is centered (both panes sharing the split)", () => {
    expect(shouldNarrowResources({ ...narrowState, dividerPosition: kDividerMin })).toBe(false);
    expect(shouldNarrowResources({ ...narrowState, dividerPosition: kDividerMax })).toBe(false);
  });

  it("does not narrow unless both panels are visible", () => {
    expect(shouldNarrowResources({ ...narrowState, showLeftPanel: false })).toBe(false);
    expect(shouldNarrowResources({ ...narrowState, showRightPanel: false })).toBe(false);
  });
});
