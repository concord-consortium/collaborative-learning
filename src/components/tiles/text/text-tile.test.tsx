import {screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reaction } from "mobx";
import { defaultTextContent } from "../../../models/tiles/text/text-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { kHighlightFormat } from "../../../plugins/text/highlights-plugin";
import { ITileApi } from "../tile-api";
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

  it("renders its toolbar with heading button", () => {
    specTextTile({});
    userEvent.click(screen.getByTestId("ccrte-editor"));
    const buttons = screen.getAllByRole("button");
    const headingButton = buttons.find(b => b.getAttribute("aria-label") === "Heading");
    expect(headingButton).toBeDefined();
  });

});

describe("TextToolComponent highlight bbox cache", () => {

  it("reports the registered bbox for a known highlight id", () => {
    let tileApi: ITileApi | undefined;
    const { textTile } = specTextTile({
      onRegisterTileApi: (api) => { tileApi = api; }
    });
    const box = { left: 1, top: 2, width: 10, height: 20 };
    (textTile as any).handleUpdateHighlightBoxCache("abc", box);
    expect(tileApi?.getObjectBoundingBox?.("abc", kHighlightFormat)).toEqual(box);
  });

  it("returns no bbox for unknown highlight ids", () => {
    let tileApi: ITileApi | undefined;
    specTextTile({
      onRegisterTileApi: (api) => { tileApi = api; }
    });
    expect(tileApi?.getObjectBoundingBox?.("unknown-id", kHighlightFormat)).toBeUndefined();
  });

  it("editable and read-only views of the same tile have independent bbox caches", () => {
    // Models a problem doc open on both sides of the app rendering two Text tile instances, one editable, one
    // read-only. A bbox written by the editable view must not appear in the read-only view's cache.
    const tileModel = TileModel.create({ content: defaultTextContent() });
    let editableApi: ITileApi | undefined;
    let readOnlyApi: ITileApi | undefined;
    const editable = specTextTile({ tileModel, onRegisterTileApi: (api) => { editableApi = api; } });
    specTextTile({ tileModel, readOnly: true, onRegisterTileApi: (api) => { readOnlyApi = api; } });
    const box = { left: 1, top: 2, width: 3, height: 4 };
    (editable.textTile as any).handleUpdateHighlightBoxCache("shared-id", box);
    expect(editableApi?.getObjectBoundingBox?.("shared-id", kHighlightFormat)).toEqual(box);
    expect(readOnlyApi?.getObjectBoundingBox?.("shared-id", kHighlightFormat)).toBeUndefined();
  });

  it("bumps the observable tick when a bbox is written", () => {
    let tileApi: ITileApi | undefined;
    const { textTile } = specTextTile({
      onRegisterTileApi: (api) => { tileApi = api; }
    });
    const observed: Array<unknown> = [];
    const dispose = reaction(
      () => tileApi?.getObjectBoundingBox?.("tick-id", kHighlightFormat),
      (value) => { observed.push(value); }
    );
    try {
      const box = { left: 1, top: 2, width: 3, height: 4 };
      (textTile as any).handleUpdateHighlightBoxCache("tick-id", box);
      expect(observed).toEqual([box]);
    } finally {
      dispose();
    }
  });

});
