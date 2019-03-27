import { getSnapshot } from "mobx-state-tree";
import { DocumentModel, SectionDocument, DocumentModelType } from "./document";
import { DocumentContentModel } from "./document-content";
import { createSingleTileContent } from "../../utilities/test-utils";
import { TextContentModelType } from "../tools/text/text-content";

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
      comments: {},
      stars: [],
      content: {
        rowMap: {},
        rowOrder: [],
        tileMap: {}
      },
    });
  });

  it("can set content", () => {
    const content = createSingleTileContent({ type: "Text", text: "test" });
    document.setContent(DocumentContentModel.create(content));
    expect(document.content.tileMap.size).toBe(1);
    document.content.tileMap.forEach(tile => {
      const textContent = tile.content as TextContentModelType;
      expect(textContent.type).toBe("Text");
      expect(textContent.text).toBe("test");
    });
  });

  it("allows the tools to be added", () => {
    expect(document.content.tileMap.size).toBe(0);
    document.addTile("text");
    expect(document.content.tileMap.size).toBe(1);
    // adding geometry tool adds sidecar text tool
    document.addTile("geometry", true);
    expect(document.content.tileMap.size).toBe(3);
  });

  it("allows tiles to be deleted", () => {
    const result = document.addTile("text");
    const tileId = result && result.tileId;
    expect(document.content.tileMap.size).toBe(1);
    document.deleteTile(tileId!);
    expect(document.content.tileMap.size).toBe(0);
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
