import {screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultTextContent } from "../../../models/tiles/text/text-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { specTextTile } from "./spec-text-tile";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../../models/tiles/text/text-registration";

describe("TextToolComponent", () => {

  it("renders successfully", () => {
    specTextTile({});
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("ccrte-editor")).toBeInTheDocument();
  });

  it("sets the editor on the content after rendering", () => {
    const content = defaultTextContent();
    const tileModel = TileModel.create({content});
    expect(content.editor).toBeUndefined();
    specTextTile({tileModel});
    expect(content.editor).toBeDefined();
  });

  it("renders its toolbar", () => {
    specTextTile({});
    userEvent.click(screen.getByTestId("ccrte-editor"));
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

});
