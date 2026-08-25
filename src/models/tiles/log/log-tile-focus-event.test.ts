import { LogEventName } from "../../../lib/logger-types";

// The real logger-utils helpers run against this fake store, so the enrichment they do
// (document lookup, curriculum section lookup, the "<no title>" fallback) is under test.
const mockCtx: { document: any; section: any; guideSection: any; storesReady: boolean } =
  { document: undefined, section: undefined, guideSection: undefined, storesReady: true };
const mockLoggerLog = jest.fn();
jest.mock("../../../lib/logger", () => ({
  Logger: {
    get stores() {
      if (!mockCtx.storesReady) return undefined;
      return {
        documents: { getDocument: () => undefined, findDocumentOfTile: () => mockCtx.document },
        networkDocuments: { getDocument: () => undefined, findDocumentOfTile: () => undefined },
        problem: { sections: mockCtx.section ? [mockCtx.section] : [] },
        teacherGuide: { sections: mockCtx.guideSection ? [mockCtx.guideSection] : [] },
      };
    },
    log: (...args: any[]) => mockLoggerLog(...args),
  },
}));

// getSectionPath walks the section's MST ancestry; the fake sections below carry the path they
// should produce so the real ancestry walk doesn't have to be reconstructed here.
jest.mock("../../curriculum/unit", () => ({
  getSectionPath: (section: any) => section.sectionPath,
}));

const mockLogDocumentEvent = jest.fn();
jest.mock("../../document/log-document-event", () => ({
  logDocumentOrCurriculumEvent: (...args: any[]) => mockLogDocumentEvent(...args),
}));

import { logTileFocusEvent } from "./log-tile-focus-event";

// Minimal stand-ins for the pieces of a document / curriculum section the helpers read.
function fakeDocument(tileId: string, title: string, type: string) {
  return {
    content: {
      getTile: () => ({ computedTitle: title }),
      getTileType: (id: string) => (id === tileId ? type : undefined),
      getSectionIdForTile: () => "section-1",
    }
  };
}

function fakeSection(tileId: string, title: string, type: string, sectionPath = "msa/1/2/introduction") {
  return {
    type: "introduction",
    sectionPath,
    content: {
      tileMap: new Map([[tileId, {}]]),
      getTile: () => ({ computedTitle: title }),
      getTileType: (id: string) => (id === tileId ? type : undefined),
    }
  };
}

describe("logTileFocusEvent", () => {
  beforeEach(() => {
    mockLoggerLog.mockReset();
    mockLogDocumentEvent.mockReset();
    mockCtx.document = undefined;
    mockCtx.section = undefined;
    mockCtx.guideSection = undefined;
    mockCtx.storesReady = true;
  });

  it("logs SELECT_TILE with tileType/tileTitle/readOnly for a tile in one of the user's documents", () => {
    mockCtx.document = fakeDocument("tile-1", "My Tile", "Drawing");
    logTileFocusEvent("tile-1", true);
    expect(mockLogDocumentEvent).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      document: mockCtx.document,
      tileId: "tile-1",
      tileType: "Drawing",
      tileTitle: "My Tile",
      sectionId: "section-1",
      readOnly: true,
    });
    expect(mockLoggerLog).not.toHaveBeenCalled();
  });

  it("routes a resource-panel tile through curriculum logging with its section path", () => {
    mockCtx.section = fakeSection("tile-c", "Curriculum Tile", "Text");
    logTileFocusEvent("tile-c", true);
    expect(mockLogDocumentEvent).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      curriculum: "msa/1/2/introduction",
      tileId: "tile-c",
      tileType: "Text",
      tileTitle: "Curriculum Tile",
      readOnly: true,
    });
    expect(mockLoggerLog).not.toHaveBeenCalled();
  });

  it("routes a teacher guide tile through curriculum logging with the guide facet in its path", () => {
    mockCtx.guideSection = fakeSection("tile-g", "Guide Tile", "Text", "msa:guide/1/2/introduction");
    logTileFocusEvent("tile-g", true);
    expect(mockLogDocumentEvent).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      curriculum: "msa:guide/1/2/introduction",
      tileId: "tile-g",
      tileType: "Text",
      tileTitle: "Guide Tile",
      readOnly: true,
    });
  });

  it("falls back to a bare Logger.log when the tile is in neither a document nor curriculum", () => {
    logTileFocusEvent("tile-2", false);
    expect(mockLoggerLog).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      tileId: "tile-2",
      tileType: undefined,
      tileTitle: "<no title>",
      readOnly: false,
    });
    expect(mockLogDocumentEvent).not.toHaveBeenCalled();
  });

  it("falls back to a bare Logger.log when the Logger is not yet initialized", () => {
    // Logger.log queues the event for delivery after initializeLogger runs; it is not a no-op.
    mockCtx.storesReady = false;
    logTileFocusEvent("tile-3", false);
    expect(mockLoggerLog).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      tileId: "tile-3",
      tileType: undefined,
      tileTitle: "<no title>",
      readOnly: false,
    });
    expect(mockLogDocumentEvent).not.toHaveBeenCalled();
  });
});
