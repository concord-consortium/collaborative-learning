import React from "react";
import { render, screen, within } from "@testing-library/react";
import { SortWorkHeader } from "./sort-work-header";

function makeItems(texts: string[], selectedIndex = 0) {
  return texts.map((text, i) => ({ text, selected: i === selectedIndex, onClick: () => undefined }));
}

describe("SortWorkHeader", () => {
  // CLUE-563: the "Show for" dropdown must display the selected option's label, which carries any
  // term override (e.g. "Model" when contentLevel.problem is overridden), rather than the raw
  // doc-filter id "Problem". Previously the dropdown title was hard-set to the raw filter id.
  it("shows the selected filter's (possibly overridden) label, not the raw filter id", () => {
    render(
      <SortWorkHeader
        docFilterItems={makeItems(["Model", "All"])}
        primarySortItems={makeItems(["Date"])}
        secondarySortItems={makeItems(["None"])}
        showContextFilter={true}
      />
    );
    const filterTrigger = screen.getByTestId("filter-work-menu-header");
    expect(within(filterTrigger).getByText("Model")).toBeInTheDocument();
    expect(within(filterTrigger).queryByText("Problem")).not.toBeInTheDocument();
  });
});
