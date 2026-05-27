import { render } from "@testing-library/react";
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
});
