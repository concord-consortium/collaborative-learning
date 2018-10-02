import { getSnapshot } from "mobx-state-tree";
import { DocumentModel, SectionDocument, DocumentModelType } from "./document";
import { DocumentContentModel } from "./document-content";

describe("document model", () => {
  let document: DocumentModelType;

  beforeEach(() => {
    document = DocumentModel.create({
      type: SectionDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      content: {},
      visibility: "public"
    });
  });

  it("uses override values", () => {
    expect(getSnapshot(document)).toEqual({
      type: SectionDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      groupId: undefined,
      sectionId: undefined,
      title: undefined,
      visibility: "public",
      groupUserConnections: {},
      content: {
        shared: undefined,
        tiles: []
      },
    });
  });

  it("can set content", () => {
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

  it("allows the tools to be added", () => {
    expect(document.content.tiles.length).toBe(0);
    document.addTile("text");
    expect(document.content.tiles.length).toBe(1);
    document.addTile("geometry");
    expect(document.content.tiles.length).toBe(2);
  });

  it("allows tiles to be deleted", () => {
    document.addTile("text");
    expect(document.content.tiles.length).toBe(1);
    document.deleteTile(document.content.tiles[0].id);
    expect(document.content.tiles.length).toBe(0);
  });

  it("allows the visibility to be toggled", () => {
    document.toggleVisibility();
    expect(document.visibility).toBe("private");
    document.toggleVisibility();
    expect(document.visibility).toBe("public");
  });

  it("allows the visibility to be explicity set", () => {
    document.toggleVisibility("public");
    expect(document.visibility).toBe("public");
    document.toggleVisibility("private");
    expect(document.visibility).toBe("private");
  });
});
