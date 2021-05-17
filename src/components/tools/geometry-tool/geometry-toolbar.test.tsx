import React from "react";
import { render, screen } from "@testing-library/react";
import { GeometryToolbar } from "./geometry-toolbar";
import { GeometryContentModel, GeometryMetadataModel } from "../../../models/tools/geometry/geometry-content";

describe("GeometryToolbar", () => {
  const content = GeometryContentModel.create();
  const metadata = GeometryMetadataModel.create({ id: "test-metadata" });
  content.doPostCreate(metadata);

  it("renders successfully", () => {
    render(<div className="document-content" data-testid="document-content"/>);
    const documentContent = screen.getByTestId("document-content");

    render(
      <GeometryToolbar content={content} documentContent={documentContent} onIsEnabled={() => true}
        onRegisterToolApi={() => null} onUnregisterToolApi={() => null} />
    );
    expect(screen.getByTestId("geometry-toolbar")).toBeInTheDocument();
  });
});
