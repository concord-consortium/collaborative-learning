import { getSnapshot } from "mobx-state-tree";
import { DocumentModel } from "./document";
import { DocumentContentModel } from "./document-content";

describe("document model", () => {

  it("uses override values", () => {
    const document = DocumentModel.create({
      uid: "1",
      key: "test",
      createdAt: 1,
      content: DocumentContentModel.create({}),
    });
    expect(getSnapshot(document)).toEqual({
      uid: "1",
      key: "test",
      createdAt: 1,
      content: {
        shared: undefined,
        tiles: []
      },
    });
  });
});
