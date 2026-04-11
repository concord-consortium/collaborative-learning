import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "../curriculum/problem";
import { SectionModel } from "../curriculum/section";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { specStores } from "./spec-stores";

// The method under test uses tileMap.has(tileId), so we need tiles registered
// for document content to parse them. However, for our tests we only need
// the tileMap to contain entries — we can use unknown/generic tile content
// snapshots with a "type" that won't be validated strictly in the map.

describe("Stores.findContentOfTile", () => {

  function makeTileMapEntry(tileId: string) {
    return {
      [tileId]: {
        id: tileId,
        content: { type: "Unknown" }
      }
    };
  }

  it("finds tile in user document", () => {
    const stores = specStores();
    const tileId = "tile-in-doc";
    const doc = createDocumentModel({
      type: ProblemDocument,
      uid: "user1",
      key: "doc1",
      createdAt: 1,
      content: {
        tileMap: makeTileMapEntry(tileId)
      }
    });
    stores.documents.add(doc);

    const result = stores.findContentOfTile(tileId);
    expect(result).toBe(doc.content);
  });

  it("falls back to problem sections", () => {
    const tileId = "tile-in-section";
    const sectionContent = DocumentContentModel.create({
      tileMap: makeTileMapEntry(tileId)
    });
    const section = SectionModel.create({
      type: "introduction",
      content: getSnapshot(sectionContent)
    });
    const problem = ProblemModel.create({ ordinal: 1, title: "Test Problem" });
    problem.sections.push(section);

    const stores = specStores({ problem });

    const result = stores.findContentOfTile(tileId);
    expect(result).toBe(section.content);
  });

  it("returns undefined for missing tile", () => {
    const stores = specStores();
    const result = stores.findContentOfTile("nonexistent-tile");
    expect(result).toBeUndefined();
  });

  it("user doc takes priority over problem section", () => {
    const tileId = "shared-tile-id";

    // Set up problem section with the tile
    const sectionContent = DocumentContentModel.create({
      tileMap: makeTileMapEntry(tileId)
    });
    const section = SectionModel.create({
      type: "introduction",
      content: getSnapshot(sectionContent)
    });
    const problem = ProblemModel.create({ ordinal: 1, title: "Test Problem" });
    problem.sections.push(section);

    const stores = specStores({ problem });

    // Set up user document with the same tile ID
    const doc = createDocumentModel({
      type: ProblemDocument,
      uid: "user1",
      key: "doc1",
      createdAt: 1,
      content: {
        tileMap: makeTileMapEntry(tileId)
      }
    });
    stores.documents.add(doc);

    const result = stores.findContentOfTile(tileId);
    // User document should take priority
    expect(result).toBe(doc.content);
  });
});
