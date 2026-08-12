import { LogEventName } from "../../../lib/logger-types";

const mockCtx: { document: any; storesReady: boolean } = { document: undefined, storesReady: true };
const mockLoggerLog = jest.fn();
jest.mock("../../../lib/logger", () => ({
  Logger: {
    get stores() {
      if (!mockCtx.storesReady) return undefined;
      return {
        documents: { findDocumentOfTile: () => mockCtx.document },
        networkDocuments: { findDocumentOfTile: () => undefined },
      };
    },
    log: (...args: any[]) => mockLoggerLog(...args),
  },
}));

const mockLogDocumentEvent = jest.fn();
jest.mock("../../document/log-document-event", () => ({
  logDocumentEvent: (...args: any[]) => mockLogDocumentEvent(...args),
}));

jest.mock("../../../lib/logger-utils", () => ({
  getTileTitleForLogging: () => "My Tile",
}));

import { logTileFocusEvent } from "./log-tile-focus-event";

describe("logTileFocusEvent", () => {
  beforeEach(() => {
    mockLoggerLog.mockReset();
    mockLogDocumentEvent.mockReset();
    mockCtx.document = undefined;
    mockCtx.storesReady = true;
  });

  it("logs SELECT_TILE with tileType/tileTitle/readOnly via logDocumentEvent (no question side-effect)", () => {
    mockCtx.document = { content: { getTileType: () => "Drawing" } };
    logTileFocusEvent("tile-1", true);
    expect(mockLogDocumentEvent).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      document: mockCtx.document,
      tileId: "tile-1",
      tileType: "Drawing",
      tileTitle: "My Tile",
      readOnly: true,
    });
    expect(mockLoggerLog).not.toHaveBeenCalled();
  });

  it("falls back to a bare Logger.log when the tile is not in a loaded document", () => {
    logTileFocusEvent("tile-2", false);
    expect(mockLoggerLog).toHaveBeenCalledWith(LogEventName.SELECT_TILE, {
      tileId: "tile-2",
      tileType: undefined,
      tileTitle: "My Tile",
      readOnly: false,
    });
    expect(mockLogDocumentEvent).not.toHaveBeenCalled();
  });

  it("is a no-op until the Logger is initialized", () => {
    mockCtx.storesReady = false;
    logTileFocusEvent("tile-3", false);
    expect(mockLoggerLog).not.toHaveBeenCalled();
    expect(mockLogDocumentEvent).not.toHaveBeenCalled();
  });
});
