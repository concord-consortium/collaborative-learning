import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { addAttributeToDataSet, addCasesToDataSet } from "../../models/data/data-set";
import { TileModel } from "../../models/tiles/tile-model";
import * as imageIngest from "../../utilities/image-ingest";
import {
  kCcImgUrl, kImageUrlText, makeClipboardData, mockFile, pasteAndFlush
} from "../../test/clipboard-image-test-utils";
import { defaultDataCardContent } from "./data-card-content";
import { CaseAttribute } from "./components/case-attribute";

// Needed so TileModel.create recognizes the data card content type.
import "./data-card-registration";

// Builds a CaseAttribute already in edit mode for its value field, with a real (unattached)
// dataset so getValue/setAttValue and friends all work without a full document tree.
function renderValueEditor() {
  const content = defaultDataCardContent();
  const dataSet = content.dataSet;
  addAttributeToDataSet(dataSet, { name: "value" });
  addCasesToDataSet(dataSet, [{ value: "" }]);
  const attrKey = dataSet.attrFromName("value")!.id;
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

  return { content, dataSet, attrKey, caseId };
}

describe("CaseAttribute value paste (Data Cards)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ingests a pasted image, suppresses the default paste, and calls blur() itself to commit", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const blurSpy = jest.spyOn(textarea, "blur");
    const clipboardData = makeClipboardData({ image: mockFile() });

    const notPrevented = await pasteAndFlush(textarea, clipboardData);

    expect(notPrevented).toBe(false);
    expect(ingest).toHaveBeenCalledWith(clipboardData);
    // handleValuePaste calls targetElement.blur() itself on success; React 18 batches the
    // setValueCandidate() update from this async callback, so that first blur's own onBlur
    // handler still closes over the pre-paste value. Re-firing blur (as focus loss naturally
    // would) now that the component has re-rendered is what actually commits it.
    expect(blurSpy).toHaveBeenCalled();
    act(() => { fireEvent.blur(textarea); });
    expect(content.dataSet.getValue(caseId, attrKey)).toBe(kCcImgUrl);
  });

  it("stores the ccimg:// url for a pasted image url, never the raw external url", async () => {
    jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const blurSpy = jest.spyOn(textarea, "blur");
    const clipboardData = makeClipboardData({ text: kImageUrlText });

    const notPrevented = await pasteAndFlush(textarea, clipboardData);

    expect(notPrevented).toBe(false);
    expect(blurSpy).toHaveBeenCalled();
    act(() => { fireEvent.blur(textarea); });
    const storedValue = content.dataSet.getValue(caseId, attrKey);
    expect(storedValue).toBe(kCcImgUrl);
    expect(storedValue).not.toBe(kImageUrlText);
  });

  it("does not ingest plain text pastes, and does not suppress the default paste", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage");
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ text: "just some plain text" });

    const notPrevented = await pasteAndFlush(textarea, clipboardData);

    expect(notPrevented).toBe(true);
    expect(ingest).not.toHaveBeenCalled();
    expect(content.dataSet.getValue(caseId, attrKey)).toBe("");
  });

  it("suppresses the default paste but leaves the value unset when ingestion fails to store the image", async () => {
    jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(undefined);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ image: mockFile() });

    const notPrevented = await pasteAndFlush(textarea, clipboardData);

    expect(notPrevented).toBe(false);
    expect(content.dataSet.getValue(caseId, attrKey)).toBe("");
  });
});
