import React from "react";
import { Provider } from "mobx-react";
import { act, render, screen } from "@testing-library/react";
import { SectionDocumentOrBrowser } from "./section-document-or-browser";
import { specStores } from "../../models/stores/spec-stores";
import { ENavTab } from "../../models/view/nav-tabs";
import { createDocumentModel } from "../../models/document/document";
import { ProblemPublication } from "../../models/document/document-types";
import { kDividerHalf } from "../../models/stores/ui-types";

// The two branches under test are "which of these two renders", so stand them both in.
jest.mock("./document-view", () => ({ DocumentView: () => <div data-testid="document-view"/> }));
jest.mock("../thumbnail/document-collection-list", () => ({
  kNavItemScale: 0.1,
  DocumentCollectionList: ({ selectedDocument }: { selectedDocument?: string }) =>
    <div data-testid="document-browser" data-selected={selectedDocument ?? ""}/>
}));
jest.mock("./network-documents-section", () => ({ NetworkDocumentsSection: () => null }));
jest.mock("react-query", () => ({ useQueryClient: () => ({}) }));

const tabSpec = {
  tab: ENavTab.kClassWork,
  label: "Class Work",
  sections: [{ title: "Workspaces", type: "published-problem-documents" }]
};

function setup() {
  const stores = specStores();
  stores.appConfig.setConfigs([{ navTabs: { tabSpecs: [tabSpec] } } as any]);
  stores.documents.add(createDocumentModel({
    type: ProblemPublication, title: "Published", uid: "1", key: "doc-1", createdAt: 1, content: {}
  }));
  const { persistentUI } = stores;
  persistentUI.setActiveNavTab(ENavTab.kClassWork);
  persistentUI.setCurrentDocumentGroupId(ENavTab.kClassWork, "Workspaces");
  persistentUI.setDocumentGroupPrimaryDocument(ENavTab.kClassWork, "Workspaces", "doc-1");
  render(
    <Provider stores={stores}>
      <SectionDocumentOrBrowser tabSpec={stores.appConfig.navTabs.getNavTabSpec(ENavTab.kClassWork)!}/>
    </Provider>
  );
  return stores;
}

describe("SectionDocumentOrBrowser under the author's fixed start view", () => {

  it("shows the saved open document when no start view is forced", () => {
    setup();
    expect(screen.getByTestId("document-view")).toBeInTheDocument();
  });

  it("shows the thumbnail browser with nothing selected while the tab is forced", () => {
    const stores = setup();
    act(() => stores.persistentUI.applyFixedStartView(ENavTab.kClassWork, kDividerHalf));

    expect(screen.queryByTestId("document-view")).not.toBeInTheDocument();
    // The thumbnail must not read as selected, or the first click on it would close the document
    // instead of opening it.
    expect(screen.getByTestId("document-browser")).toHaveAttribute("data-selected", "");
    // ...and the saved document is untouched.
    expect(stores.persistentUI.tabs.get(ENavTab.kClassWork)
      ?.getDocumentGroup("Workspaces")?.primaryDocumentKey).toBe("doc-1");
  });

  it("gives the document back once the user navigates", () => {
    const stores = setup();
    act(() => stores.persistentUI.applyFixedStartView(ENavTab.kClassWork, kDividerHalf));
    act(() => stores.persistentUI.setActiveNavTab(ENavTab.kClassWork));
    expect(screen.getByTestId("document-view")).toBeInTheDocument();
  });
});

describe("SectionDocumentOrBrowser sub tab under the author's fixed start view", () => {

  // Class Work really does have several sub tabs in the shipped units, and the published thumbnails
  // live in the first one.
  const multiTabSpec = {
    tab: ENavTab.kClassWork,
    label: "Class Work",
    sections: [
      { title: "Workspaces", type: "published-problem-documents" },
      { title: "Bookmarks", type: "starred-problem-documents" }
    ]
  };

  function setupMulti() {
    const stores = specStores();
    stores.appConfig.setConfigs([{ navTabs: { tabSpecs: [multiTabSpec] } } as any]);
    const { persistentUI } = stores;
    persistentUI.setActiveNavTab(ENavTab.kClassWork);
    // The user left off on Bookmarks.
    persistentUI.setCurrentDocumentGroupId(ENavTab.kClassWork, "Bookmarks");
    render(
      <Provider stores={stores}>
        <SectionDocumentOrBrowser tabSpec={stores.appConfig.navTabs.getNavTabSpec(ENavTab.kClassWork)!}/>
      </Provider>
    );
    return stores;
  }

  const selectedSubTabName = () => screen.getByRole("tab", { selected: true }).textContent;

  it("restores the user's own sub tab when no start view is forced", () => {
    setupMulti();
    expect(selectedSubTabName()).toBe("Bookmarks");
  });

  it("opens on the first sub tab while the tab is forced", () => {
    // Otherwise "always start on Class Work so every published thumbnail is visible" lands this user
    // on their bookmarks instead.
    const stores = setupMulti();
    act(() => stores.persistentUI.applyFixedStartView(ENavTab.kClassWork, kDividerHalf));
    expect(selectedSubTabName()).toBe("Workspaces");
    // ...without rewriting what the user had saved.
    expect(stores.persistentUI.tabs.get(ENavTab.kClassWork)?.currentDocumentGroupId).toBe("Bookmarks");
  });

  it("lets the user click through to another sub tab rather than swallowing the click", () => {
    // The pin has to release on the click, or the sub tab the user just clicked stays unselected.
    const stores = setupMulti();
    act(() => stores.persistentUI.applyFixedStartView(ENavTab.kClassWork, kDividerHalf));
    expect(selectedSubTabName()).toBe("Workspaces");

    act(() => { screen.getByRole("tab", { name: "Bookmarks" }).click(); });

    expect(selectedSubTabName()).toBe("Bookmarks");
    expect(stores.persistentUI.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(false);
    // The tab itself is still forced: picking a sub tab is not picking a tab.
    expect(stores.persistentUI.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(true);
  });
});
