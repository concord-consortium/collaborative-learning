import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { addAttributeToDataSet, addCasesToDataSet } from "../../models/data/data-set";
import { TileModel } from "../../models/tiles/tile-model";
import * as imageIngest from "../../utilities/image-ingest";
import { defaultDataCardContent } from "./data-card-content";
import { CaseAttribute } from "./components/case-attribute";

// Needed so TileModel.create recognizes the data card content type.
import "./data-card-registration";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const kImageUrlText = "https://example.com/photo.png";

const mockFile = () => new File(["x"], "photo.png", { type: "image/png" });

const makeClipboardData = (opts: { image?: File; text?: string }) => {
  const items: Array<{ type: string; getAsFile: () => File | null }> = [];
  if (opts.image) items.push({ type: "image/png", getAsFile: () => opts.image! });
  if (opts.text !== undefined) items.push({ type: "text/plain", getAsFile: () => null });
  return {
    items,
    types: items.map(item => item.type),
    getData: (format: string) => (format === "text/plain" ? opts.text ?? "" : "")
  };
};

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

// Lets the microtasks chained inside the (async) paste handler settle before we assert.
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const pasteAndFlush = async (textarea: HTMLElement, clipboardData: unknown) => {
  await act(async () => {
    fireEvent.paste(textarea, { clipboardData });
    await flushPromises();
  });
};

describe("CaseAttribute value paste (Data Cards)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("wires the value textarea's paste to clipboardHasImage/ingestClipboardImage and stores the ccimg:// url", async () => {
    const hasImage = jest.spyOn(imageIngest, "clipboardHasImage").mockReturnValue(true);
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteAndFlush(textarea, clipboardData);
    act(() => { fireEvent.blur(textarea); });

    expect(hasImage).toHaveBeenCalledWith(clipboardData);
    expect(ingest).toHaveBeenCalledWith(clipboardData);
    expect(content.dataSet.getValue(caseId, attrKey)).toBe(kCcImgUrl);
  });

  it("stores the ccimg:// url for a pasted image url, never the raw external url", async () => {
    jest.spyOn(imageIngest, "clipboardHasImage").mockReturnValue(true);
    jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ text: kImageUrlText });

    await pasteAndFlush(textarea, clipboardData);
    act(() => { fireEvent.blur(textarea); });

    const storedValue = content.dataSet.getValue(caseId, attrKey);
    expect(storedValue).toBe(kCcImgUrl);
    expect(storedValue).not.toBe(kImageUrlText);
  });

  it("does not ingest plain text pastes", async () => {
    jest.spyOn(imageIngest, "clipboardHasImage").mockReturnValue(false);
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage");
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ text: "just some plain text" });

    await pasteAndFlush(textarea, clipboardData);

    expect(ingest).not.toHaveBeenCalled();
    expect(content.dataSet.getValue(caseId, attrKey)).toBe("");
  });

  it("leaves the value unset when ingestion fails to store the image", async () => {
    jest.spyOn(imageIngest, "clipboardHasImage").mockReturnValue(true);
    jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(undefined);
    const { content, caseId, attrKey } = renderValueEditor();
    const textarea = screen.getByRole("combobox", { name: /value for/i });
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteAndFlush(textarea, clipboardData);
    act(() => { fireEvent.blur(textarea); });

    expect(content.dataSet.getValue(caseId, attrKey)).toBe("");
  });
});
