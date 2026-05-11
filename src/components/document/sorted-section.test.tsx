import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";

import { SortedSection } from "./sorted-section";
import { specStores } from "../../models/stores/spec-stores";
import { DocumentGroup } from "../../models/stores/document-group";

jest.mock("../../assets/icons/arrow/arrow.svg", () => function ArrowIconMock(props: object) {
  return <svg data-testid="arrow-icon" {...props} />;
});

jest.mock("../thumbnail/decorated-document-thumbnail-item", () => ({
  DecoratedDocumentThumbnailItem: () => <div data-testid="mock-thumb" />,
}));

jest.mock("./document-group", () => ({
  DocumentGroupComponent: () => <div data-testid="mock-group" />,
}));

jest.mock("../../lib/logger", () => ({
  Logger: { log: jest.fn() },
}));

function renderSection({ expanded = false }: { expanded?: boolean } = {}) {
  const stores = specStores();
  if (expanded) {
    stores.ui.setExpandedSortWorkSections("Group A", true);
  }
  const documentGroup = new DocumentGroup({
    label: "Group A",
    sortType: "Group",
    documents: [],
    stores: {
      groups: stores.groups,
      class: stores.class,
      appConfig: stores.appConfig,
      bookmarks: stores.bookmarks,
    },
  });
  const result = render(
    <Provider stores={stores}>
      <SortedSection
        docFilter="Problem"
        documentGroup={documentGroup}
        idx={0}
        secondarySort="None"
        primarySortBy="Problem"
        secondarySortBy="None"
      />
    </Provider>
  );
  const toggleButton = within(result.container).getByRole("button", { name: /toggle/i });
  return { ...result, stores, toggleButton, documentGroup };
}

describe("SortedSection header toggle", () => {
  it("sets aria-expanded='false' when the section is collapsed", () => {
    const { toggleButton } = renderSection({ expanded: false });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
  });

  it("sets aria-expanded='true' when the section is expanded", () => {
    const { toggleButton } = renderSection({ expanded: true });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });

  it("sets aria-controls to the id of the documents-list element", () => {
    const { container, toggleButton } = renderSection();
    const documentsList = container.querySelector('[data-testid="section-document-list"]');
    expect(documentsList).not.toBeNull();
    expect(documentsList!.id).toBeTruthy();
    expect(toggleButton.getAttribute("aria-controls")).toBe(documentsList!.id);
  });

  it("marks the arrow icon with aria-hidden so screen readers announce only the button label", () => {
    const { toggleButton } = renderSection();
    const arrow = within(toggleButton).getByTestId("arrow-icon");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
  });

  it("uses an aria-label that is identical when expanded vs collapsed", () => {
    const collapsedLabel = renderSection({ expanded: false }).toggleButton.getAttribute("aria-label");
    const expandedLabel = renderSection({ expanded: true }).toggleButton.getAttribute("aria-label");
    expect(collapsedLabel).toBeTruthy();
    expect(collapsedLabel).toBe(expandedLabel);
  });

  it("expands the section when Enter is pressed on the toggle button", async () => {
    const user = userEvent.setup();
    const { toggleButton, stores } = renderSection({ expanded: false });
    toggleButton.focus();
    await user.keyboard("{Enter}");
    expect(stores.ui.expandedSortWorkSections.includes("Group A")).toBe(true);
  });

  it("collapses the section when Enter is pressed while expanded", async () => {
    const user = userEvent.setup();
    const { toggleButton, stores } = renderSection({ expanded: true });
    toggleButton.focus();
    await user.keyboard("{Enter}");
    expect(stores.ui.expandedSortWorkSections.includes("Group A")).toBe(false);
  });
});
