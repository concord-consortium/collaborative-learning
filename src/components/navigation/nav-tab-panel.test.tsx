import React from "react";
import { Provider } from "mobx-react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavTabPanel } from "./nav-tab-panel";
import { specStores } from "../../models/stores/spec-stores";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { ENavTab } from "../../models/view/nav-tabs";
import { kDividerHalf } from "../../models/stores/ui-types";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

// The tab contents are irrelevant here; we are testing which tab a click selects.
jest.mock("./section-document-or-browser", () => ({ SectionDocumentOrBrowser: () => <div/> }));
jest.mock("./problem-tab-content", () => ({ ProblemTabContent: () => <div/> }));
jest.mock("../document/sort-work-view", () => ({ SortWorkView: () => <div/> }));
jest.mock("../document/student-group-view", () => ({ StudentGroupView: () => <div/> }));
jest.mock("../chat/chat-panel", () => ({ ChatPanel: () => <div/> }));
jest.mock("../../lib/logger", () => ({ Logger: { log: jest.fn() } }));

function setup() {
  const stores = specStores({ appConfig: specAppConfig({ config: {
    navTabs: { tabSpecs: [
      { tab: ENavTab.kMyWork, label: "My Work" },
      { tab: ENavTab.kClassWork, label: "Class Work" }
    ]}
  } as any }) });
  const { persistentUI } = stores;
  persistentUI.setActiveNavTab(ENavTab.kMyWork);
  persistentUI.setDocumentGroupPrimaryDocument(ENavTab.kMyWork, "Workspaces", "doc-1");
  persistentUI.setCurrentDocumentGroupId(ENavTab.kMyWork, "Workspaces");
  render(<Provider stores={stores}><NavTabPanel onDragOver={jest.fn()}/></Provider>);
  return stores;
}

describe("NavTabPanel tab selection", () => {

  beforeEach(() => (Logger.log as jest.Mock).mockClear());

  it("selects the clicked tab while the author's fixed start view is showing another one", async () => {
    const stores = setup();
    const { persistentUI } = stores;
    act(() => persistentUI.applyFixedStartView(ENavTab.kClassWork, kDividerHalf));
    expect(stores.displayedActiveNavTab).toBe(ENavTab.kClassWork);

    // My Work is the tab the user is most likely to click first: it is the one they left off on, and
    // it is not the tab they can see selected.
    await userEvent.click(screen.getByRole("tab", { name: "My Work" }));

    expect(stores.displayedActiveNavTab).toBe(ENavTab.kMyWork);
    // ...and their open document is still open, not closed by the click.
    expect(persistentUI.focusDocument).toBe("doc-1");
  });

  it("closes the open document when the displayed tab is clicked again", async () => {
    const stores = setup();
    const { persistentUI } = stores;
    await userEvent.click(screen.getByRole("tab", { name: "My Work" }));
    expect(persistentUI.focusDocument).toBeUndefined();
    // Nothing changed about which tab is showing, so this is not a tab view.
    expect(Logger.log).not.toHaveBeenCalledWith(LogEventName.SHOW_TAB, expect.anything());
  });

  it("hands back the saved document when the forced tab itself is clicked", async () => {
    // Nothing was on screen to close, so this click must not close the document the user cannot see:
    // it ends the forced view and returns them to their own state.
    const stores = setup();
    const { persistentUI } = stores;
    act(() => persistentUI.applyFixedStartView(ENavTab.kMyWork, kDividerHalf));
    expect(persistentUI.focusDocument).toBeUndefined();

    await userEvent.click(screen.getByRole("tab", { name: "My Work" }));

    expect(persistentUI.isStartViewOverrideActiveFor(ENavTab.kMyWork)).toBe(false);
    expect(persistentUI.focusDocument).toBe("doc-1");
    // The panel swapped the thumbnail browser for the user's own document, so the log should say so.
    expect(Logger.log).toHaveBeenCalledWith(LogEventName.SHOW_TAB, { tab_name: ENavTab.kMyWork });
  });
});
