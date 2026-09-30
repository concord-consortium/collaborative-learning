import React from "react";
import { render, waitFor } from "@testing-library/react";
import { addAttributeToDataSet, addCasesToDataSet } from "../../models/data/data-set";
import { TileModel } from "../../models/tiles/tile-model";
import { EntryStatus, gImageMap, ImageMapEntry } from "../../models/image-map";
import { defaultDataCardContent } from "./data-card-content";
import { SortCardAttribute } from "./components/sort-card-attribute";

import "./data-card-registration";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";

const readyEntry = () => ImageMapEntry.create({
  contentUrl: kCcImgUrl, displayUrl: "blob:http://localhost/abc-123",
  retries: 0, status: EntryStatus.Ready
});

function renderSortedImageAttribute() {
  const content = defaultDataCardContent();
  const dataSet = content.dataSet;
  addAttributeToDataSet(dataSet, { name: "photo" });
  addCasesToDataSet(dataSet, [{ photo: kCcImgUrl }]);
  const attr = dataSet.attrFromName("photo")!;
  const caseId = dataSet.caseIDFromIndex(0)!;
  const model = TileModel.create({ content });

  render(<SortCardAttribute model={model} caseId={caseId} attr={attr} />);
}

describe("SortCardAttribute image lookup", () => {
  afterEach(() => jest.restoreAllMocks());

  // The sort view renders every case at once, so a lookup keyed on render rather than on the
  // value would spin once per card on screen.
  it("looks the image up once, not once per render", async () => {
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    renderSortedImageAttribute();

    await waitFor(() => expect(getImage).toHaveBeenCalledWith(kCcImgUrl));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(getImage.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
