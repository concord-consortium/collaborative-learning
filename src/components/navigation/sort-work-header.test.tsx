import React from "react";
import { render, screen, within } from "@testing-library/react";
import { SortWorkHeader } from "./sort-work-header";

// Control the measured header width so we can test the responsive hide of the secondary sort.
let mockWidth: number | undefined;
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({ width: mockWidth, ref: { current: null } }),
}));

function makeItems(texts: string[], selectedIndex = 0) {
  return texts.map((text, i) => ({ text, selected: i === selectedIndex, onClick: () => undefined }));
}

function renderHeader() {
  return render(
    <SortWorkHeader
      docFilterItems={makeItems(["Model", "All"])}
      primarySortItems={makeItems(["Date"])}
      secondarySortItems={makeItems(["None"])}
      showContextFilter={true}
    />
  );
}

describe("SortWorkHeader", () => {
  beforeEach(() => {
    mockWidth = undefined;
  });

  it("shows the selected filter's (possibly overridden) label, not the raw filter id", () => {
    renderHeader();
    const filterTrigger = screen.getByTestId("filter-work-menu-header");
    expect(within(filterTrigger).getByText("Model")).toBeInTheDocument();
    expect(within(filterTrigger).queryByText("Problem")).not.toBeInTheDocument();
  });

  it("shows the secondary 'then' sort when the header is wide enough", () => {
    mockWidth = 800;
    renderHeader();
    expect(screen.getByText("then")).toBeInTheDocument();
  });

  it("hides the secondary 'then' sort when the header is too narrow to fit all fields", () => {
    mockWidth = 400;
    renderHeader();
    expect(screen.queryByText("then")).not.toBeInTheDocument();
    // The filter menu (which was being clipped) is still present.
    expect(screen.getByTestId("filter-work-menu-header")).toBeInTheDocument();
  });
});
