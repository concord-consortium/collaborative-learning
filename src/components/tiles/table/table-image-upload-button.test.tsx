import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileModel, TileModel } from "../../../models/tiles/tile-model";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModelContext } from "../tile-api";
import { TableToolbarContext, ITableToolbarContext } from "./table-toolbar-context";
import { TableImageUploadButton } from "./table-toolbar-registration";
import { defaultTableContent } from "../../../models/tiles/table/table-content";
// Registers "Table" with the tile content type union so TileModel.create resolves it.
import "../../../models/tiles/table/table-registration";

// getTileDataSet walks the tile's shared models via the shared model manager. Stubbing it is
// far cheaper here than standing up a full container; table-content.test.ts:44-95 shows the
// full-fidelity version if this ever needs to be more realistic.
let mockDataSet: any;
jest.mock("../../../models/shared/shared-data-utils", () => ({
  ...jest.requireActual("../../../models/shared/shared-data-utils"),
  getTileDataSet: () => mockDataSet
}));

const makeDataSet = (withSelection: boolean) => {
  const shared = SharedDataSet.create({ dataSet: { attributes: [{ id: "attr1", name: "photo" }] } });
  const { dataSet } = shared;
  dataSet.addCanonicalCasesWithIDs([{ __id__: "case1", attr1: "" }]);
  if (withSelection) dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);
  return dataSet;
};

const renderButton = (withSelection: boolean, overrides: Partial<ITableToolbarContext> = {}) => {
  mockDataSet = makeDataSet(withSelection);
  const context = {
    showExpressionsDialog: jest.fn(),
    deleteSelected: jest.fn(),
    importData: jest.fn(),
    uploadImage: jest.fn(),
    ...overrides
  } as ITableToolbarContext;
  const tile: ITileModel = TileModel.create({ content: defaultTableContent() });
  render(
    <TileModelContext.Provider value={tile}>
      <TableToolbarContext.Provider value={context}>
        <TableImageUploadButton name="image-upload" />
      </TableToolbarContext.Provider>
    </TileModelContext.Provider>
  );
  return context;
};

describe("TableImageUploadButton", () => {
  it("is disabled when no cell is selected", () => {
    renderButton(false);
    expect(screen.getByRole("button", { name: /upload image/i }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("is enabled when a cell is selected", () => {
    renderButton(true);
    expect(screen.getByRole("button", { name: /upload image/i }))
      .not.toHaveAttribute("aria-disabled");
  });

  it("makes the file input inert when no cell is selected", () => {
    renderButton(false);
    expect(document.querySelector("input[type=file]")).toBeDisabled();
  });

  it("calls uploadImage with the chosen file", async () => {
    const uploadImage = jest.fn();
    renderButton(true, { uploadImage });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(uploadImage).toHaveBeenCalledWith(file);
  });
});
