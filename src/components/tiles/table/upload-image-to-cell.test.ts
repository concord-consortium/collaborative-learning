import { SharedDataSet } from "../../../models/shared/shared-data-set";
import * as imageIngest from "../../../utilities/image-ingest";
import { uploadImageToCell, writeCellValue } from "./upload-image-to-cell";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const mockFile = () => new File(["x"], "photo.png", { type: "image/png" });

const makeDataSet = () => {
  const shared = SharedDataSet.create({ dataSet: { attributes: [{ id: "attr1", name: "photo" }] } });
  const { dataSet } = shared;
  dataSet.addCanonicalCasesWithIDs([
    { __id__: "case1", attr1: "" },
    { __id__: "case2", attr1: "" }
  ]);
  return dataSet;
};

describe("uploadImageToCell", () => {
  afterEach(() => jest.restoreAllMocks());

  it("writes the ingested reference into the selected cell", async () => {
    const dataSet = makeDataSet();
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);
    jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);

    const onUpdateRow = jest.fn();
    await uploadImageToCell(dataSet, onUpdateRow, mockFile());

    expect(onUpdateRow).toHaveBeenCalledWith({ __id__: "case1", attr1: kCcImgUrl });
  });

  it("writes to the cell selected at click time, not the one selected later", async () => {
    const dataSet = makeDataSet();
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);

    let resolveIngest: (v: string) => void = () => undefined;
    jest.spyOn(imageIngest, "ingestImage")
        .mockReturnValue(new Promise<string>(res => { resolveIngest = res; }));

    const onUpdateRow = jest.fn();
    const pending = uploadImageToCell(dataSet, onUpdateRow, mockFile());

    // The student clicks a different cell while the upload is still in flight.
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case2" }]);
    resolveIngest(kCcImgUrl);
    await pending;

    expect(onUpdateRow).toHaveBeenCalledWith({ __id__: "case1", attr1: kCcImgUrl });
  });

  it("does nothing when no cell is selected", async () => {
    const dataSet = makeDataSet();
    const ingest = jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);

    const onUpdateRow = jest.fn();
    await uploadImageToCell(dataSet, onUpdateRow, mockFile());

    expect(ingest).not.toHaveBeenCalled();
    expect(onUpdateRow).not.toHaveBeenCalled();
  });

  it("does not write when the image could not be stored", async () => {
    const dataSet = makeDataSet();
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);
    jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(undefined);

    const onUpdateRow = jest.fn();
    await uploadImageToCell(dataSet, onUpdateRow, mockFile());

    expect(onUpdateRow).not.toHaveBeenCalled();
  });
});

describe("writeCellValue", () => {
  it("creates a case when the target is the input row", () => {
    const onAddRows = jest.fn();
    const onUpdateRow = jest.fn();
    const caseValues = { __id__: "input-row-id", attr1: "value" };

    const created = writeCellValue(caseValues, "input-row-id", { onAddRows, onUpdateRow });

    expect(onAddRows).toHaveBeenCalledWith([caseValues]);
    expect(onUpdateRow).not.toHaveBeenCalled();
    expect(created).toBe(true);
  });

  it("updates an existing case when the target is not the input row", () => {
    const onAddRows = jest.fn();
    const onUpdateRow = jest.fn();
    const caseValues = { __id__: "case1", attr1: "value" };

    const created = writeCellValue(caseValues, "input-row-id", { onAddRows, onUpdateRow });

    expect(onUpdateRow).toHaveBeenCalledWith(caseValues);
    expect(onAddRows).not.toHaveBeenCalled();
    expect(created).toBe(false);
  });
});
