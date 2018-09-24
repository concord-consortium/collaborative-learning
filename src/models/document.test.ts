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

  it("can set content", () => {
    const document = DocumentModel.create({
      uid: "1",
      key: "test",
      createdAt: 1,
      content: DocumentContentModel.create({}),
    });
    document.setContent(DocumentContentModel.create({
      tiles: [{
        content: {
          type: "Text",
          text: "test"
        }
      }]
    }));
    expect(getSnapshot(document.content).tiles[0].content).toEqual({
      format: undefined,
      text: "test",
      type: "Text"
    });
  });
});
