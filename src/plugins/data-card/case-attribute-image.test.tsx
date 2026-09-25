import React from "react";
import { render, waitFor } from "@testing-library/react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { addAttributeToDataSet, addCasesToDataSet } from "../../models/data/data-set";
import { TileModel } from "../../models/tiles/tile-model";
import { EntryStatus, gImageMap, ImageMapEntry } from "../../models/image-map";
import { defaultDataCardContent } from "./data-card-content";
import { CaseAttribute } from "./components/case-attribute";

import "./data-card-registration";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const kBlobUrl = "blob:http://localhost/abc-123";

const readyEntry = () => ImageMapEntry.create({
  contentUrl: kCcImgUrl, displayUrl: kBlobUrl, retries: 0, status: EntryStatus.Ready
});

function renderImageAttribute() {
  const content = defaultDataCardContent();
  const dataSet = content.dataSet;
  addAttributeToDataSet(dataSet, { name: "photo" });
  addCasesToDataSet(dataSet, [{ photo: kCcImgUrl }]);
  const attrKey = dataSet.attrFromName("photo")!.id;
  const caseId = dataSet.caseIDFromIndex(0)!;
  const model = TileModel.create({ content });

  render(
    <ModalProvider>
      <CaseAttribute
        model={model}
        caseId={caseId}
        attrKey={attrKey}
        currEditAttrId={attrKey}
        currEditFacet="value"
        setImageUrlToAdd={() => undefined}
        setCurrEditAttrId={() => undefined}
        setCurrEditFacet={() => undefined}
      />
    </ModalProvider>
  );
}

describe("CaseAttribute image lookup", () => {
  afterEach(() => jest.restoreAllMocks());

  // Resolving the image from the render body schedules a state update on every render, and
  // React renders once more before bailing out on an unchanged value — so the component spins
  // forever. The lookup has to be keyed on the value, not run per render.
  it("looks the image up once, not once per render", async () => {
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    renderImageAttribute();

    await waitFor(() => expect(getImage).toHaveBeenCalledWith(kCcImgUrl));
    // Settle any follow-up renders before counting.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(getImage.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
