import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { DocumentGroupComponent } from "./document-group";
import { DocumentGroup } from "../../models/stores/document-group";

jest.mock("../thumbnail/simple-document-item", () => ({
  SimpleDocumentItem: function MockSimpleDocumentItem({ document }: { document: { key: string } }) {
    return <div data-testid="simple-document-item">{document.key}</div>;
  }
}));

function createTestDocumentGroup(docCount: number) {
  const documents = Array.from({ length: docCount }, (_, i) => ({
    key: `doc-${i}`,
    uid: `user-${i}`,
  })) as any;
  return new DocumentGroup({
    label: "Test",
    sortType: "Group",
    documents,
    stores: {} as any
  });
}

describe("DocumentGroupComponent", () => {
  const originalScrollBy = HTMLElement.prototype.scrollBy;

  afterEach(() => {
    jest.restoreAllMocks();
    HTMLElement.prototype.scrollBy = originalScrollBy;
  });

  it("does not render scroll buttons before the container width is measured", () => {
    // In jsdom, offsetWidth is 0, so containerWidth stays 0 and visibleCount = 0.
    // If scroll buttons render in that state, clicking them computes
    // scrollAmount = visibleCount * scrollUnit = 0 — a silent no-op that
    // leaves the arrow-disabled state out of sync with reality.
    const documentGroup = createTestDocumentGroup(10);
    const { queryByTestId } = render(
      <DocumentGroupComponent
        documentGroup={documentGroup}
        secondarySort="None"
        onSelectDocument={() => undefined}
      />
    );
    expect(queryByTestId("scroll-button-left")).not.toBeInTheDocument();
    expect(queryByTestId("scroll-button-right")).not.toBeInTheDocument();
  });

  it("scrolls by the row's current width, not the width it was last measured at", () => {
    // The row is narrower once the scroll buttons take their place beside it, and the measurement
    // that follows that change arrives a render later. A click in between must still scroll by a
    // whole number of the document boxes that fit *now*, or the row lands on an offset the opposite
    // button cannot undo: out by the old width and back by the new one leaves the difference behind,
    // and with it a left arrow that stays enabled but never returns the row to its start.
    const scrollUnit = 16 + 10;           // one document box plus the gap after it
    const widthWhenMeasured = 24 * scrollUnit + 13;
    const widthNow = 22 * scrollUnit + 13;
    const widthSpy = jest.spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(widthWhenMeasured);
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(widthNow);
    // Enough content to scroll through, so the right arrow is not disabled for want of overflow.
    jest.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(50 * scrollUnit);
    const scrollBy = jest.fn();
    HTMLElement.prototype.scrollBy = scrollBy;

    const documentGroup = createTestDocumentGroup(50);
    const { getByTestId } = render(
      <DocumentGroupComponent
        documentGroup={documentGroup}
        secondarySort="None"
        onSelectDocument={() => undefined}
      />
    );
    // The buttons are showing now, and the row has narrowed around them.
    widthSpy.mockReturnValue(widthNow);

    fireEvent.click(getByTestId("scroll-button-right"));
    expect(scrollBy).toHaveBeenCalledWith({ left: 22 * scrollUnit, behavior: "smooth" });
  });
});
