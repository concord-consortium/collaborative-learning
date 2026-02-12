import { registerTileTypes } from "../../register-tile-types";
import { specStores } from "../stores/spec-stores";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { IStores } from "../stores/stores";
import { LogEventName } from "../../lib/logger-types";
import {
  ReadAloudService, getReadAloudService, resetReadAloudService
} from "./read-aloud-service";

// Mock the logger
const mockLogToolbarEvent = jest.fn();
jest.mock("../tiles/log/log-toolbar-event", () => ({
  logToolbarEvent: (...args: any[]) => mockLogToolbarEvent(...args)
}));

// Mock SpeechSynthesisUtterance
class MockUtterance {
  text: string;
  onend: (() => void) | null = null;
  onerror: ((event?: any) => void) | null = null;
  constructor(text: string) { this.text = text; }
}
(global as any).SpeechSynthesisUtterance = MockUtterance;

// Mock speechSynthesis — richer than the button test mock: captures utterances
// via lastUtterance so tests can simulate onend/onerror callbacks.
const mockSpeechSynthesis = {
  speak: jest.fn((utterance: MockUtterance) => {
    // Store the utterance so tests can fire events on it
    lastUtterance = utterance;
  }),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  speaking: false,
  paused: false,
  pending: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getVoices: jest.fn(() => []),
  onvoiceschanged: null,
  dispatchEvent: jest.fn(),
};

Object.defineProperty(window, "speechSynthesis", {
  value: mockSpeechSynthesis,
  writable: true,
  configurable: true,
});

let lastUtterance: MockUtterance | null = null;

// Helper to create a document content snapshot with multiple tiles
function createDocumentContent(tiles: Array<{ id: string; type: string; title?: string; text?: string }>) {
  const rowMap: Record<string, any> = {};
  const tileMap: Record<string, any> = {};
  const rowOrder: string[] = [];

  tiles.forEach((tile, index) => {
    const rowId = `row-${index}`;
    rowOrder.push(rowId);
    rowMap[rowId] = { id: rowId, tiles: [{ tileId: tile.id }] };

    const content: any = { type: tile.type };
    if (tile.type === "Text" && tile.text != null) {
      content.text = tile.text;
    }

    tileMap[tile.id] = {
      id: tile.id,
      title: tile.title,
      content
    };
  });

  const snapshot: DocumentContentSnapshotType = { rowMap, rowOrder, tileMap };
  return DocumentContentModel.create(snapshot);
}

describe("ReadAloudService", () => {
  let stores: IStores;
  let service: ReadAloudService;

  beforeAll(async () => {
    await registerTileTypes(["Text"]);
  });

  beforeEach(() => {
    stores = specStores();
    service = getReadAloudService(stores);
    lastUtterance = null;
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
    mockSpeechSynthesis.pause.mockClear();
    mockSpeechSynthesis.resume.mockClear();
    mockSpeechSynthesis.speaking = false;
    mockLogToolbarEvent.mockClear();
  });

  afterEach(() => {
    resetReadAloudService();
  });

  // Helper: create document content and start reading in one step
  function startWithTiles(
    tiles: Array<{ id: string; type: string; title?: string; text?: string }>,
    selectedIds: string[] = [],
    pane: "left" | "right" = "right"
  ) {
    const content = createDocumentContent(tiles);
    service.start(pane, content, selectedIds, { document: undefined });
    return content;
  }

  describe("isSupported", () => {
    it("reports supported when speechSynthesis is available", () => {
      expect(service.isSupported).toBe(true);
    });
  });

  describe("singleton", () => {
    it("returns the same instance for multiple calls", () => {
      const service2 = getReadAloudService(stores);
      expect(service2).toBe(service);
    });

    it("returns a new instance after reset", () => {
      resetReadAloudService();
      const service2 = getReadAloudService(stores);
      expect(service2).not.toBe(service);
    });
  });

  describe("start/stop", () => {
    it("reads all tiles in order when no tile is selected", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "First", text: "Hello" },
        { id: "t2", type: "Text", title: "Second", text: "World" }
      ]);

      expect(service.state).toBe("reading");
      expect(service.activePane).toBe("right");
      expect(service.currentTileId).toBe("t1");
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it("reads only the selected tile when one is selected", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "First", text: "Hello" },
        { id: "t2", type: "Text", title: "Second", text: "World" }
      ], ["t2"]);

      expect(service.state).toBe("reading");
      expect(service.currentTileId).toBe("t2");
    });

    it("reads multiple selected tiles in document order", () => {
      // Pass in reverse order — service should still read in doc order
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" },
        { id: "t3", type: "Text", title: "C", text: "c" }
      ], ["t3", "t1"]);

      expect(service.state).toBe("reading");
      expect(service.currentTileId).toBe("t1");
    });

    it("filters out selected tile IDs not in the document", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" }
      ], ["t1", "nonexistent"]);
      expect(service.state).toBe("reading");
      expect(service.currentTileId).toBe("t1");
    });

    it("immediately stops when there are no tiles", () => {
      startWithTiles([]);
      expect(service.state).toBe("idle");
    });

    it("toggles off when clicking while reading on the same pane", () => {
      const content = startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      expect(service.state).toBe("reading");

      // Start again on same pane — should toggle off
      service.start("right", content, [], { document: undefined });
      expect(service.state).toBe("idle");
    });

    it("stops other pane when starting on a different pane", () => {
      const content = startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ], [], "left");
      expect(service.state).toBe("reading");
      expect(service.activePane).toBe("left");

      service.start("right", content, [], { document: undefined });
      expect(service.state).toBe("reading");
      expect(service.activePane).toBe("right");
    });

    it("stops and resets state", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.stop("user");

      expect(service.state).toBe("idle");
      expect(service.activePane).toBeNull();
      expect(service.currentTileId).toBeNull();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it("stop is a no-op when already idle", () => {
      service.stop("user");
      expect(service.state).toBe("idle");
    });
  });

  describe("tile advancement", () => {
    it("advances to the next tile after utterance ends", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" }
      ]);
      expect(service.currentTileId).toBe("t1");

      // Simulate utterance ending
      lastUtterance?.onend?.();
      expect(service.currentTileId).toBe("t2");
    });

    it("stops after the last tile finishes", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" }
      ]);

      lastUtterance?.onend?.();
      expect(service.state).toBe("idle");
    });
  });

  describe("pause/resume", () => {
    it("pauses when reading", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.pause();

      expect(service.state).toBe("paused");
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    });

    it("resumes when paused and speech is still active", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.pause();

      mockSpeechSynthesis.speaking = true;
      service.resume();

      expect(service.state).toBe("reading");
      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    it("resumes by speaking next chunk when paused between chunks", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.pause();

      // Speech is not active (paused between chunks)
      mockSpeechSynthesis.speaking = false;
      const speakCountBefore = mockSpeechSynthesis.speak.mock.calls.length;
      service.resume();

      expect(service.state).toBe("reading");
      expect(mockSpeechSynthesis.speak.mock.calls.length).toBeGreaterThan(speakCountBefore);
    });

    it("toggles off when clicking button while paused", () => {
      const content = startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.pause();

      // Clicking the button again while paused stops (toggle off on same pane)
      service.start("right", content, [], { document: undefined });
      expect(service.state).toBe("idle");
    });

    it("pause is a no-op when not reading", () => {
      service.pause();
      expect(service.state).toBe("idle");
    });

    it("resume is a no-op when not paused", () => {
      service.resume();
      expect(service.state).toBe("idle");
    });
  });

  describe("keyboard controls", () => {
    it("spacebar pauses when reading", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      document.dispatchEvent(event);

      expect(service.state).toBe("paused");
    });

    it("spacebar resumes when paused", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      service.pause();

      mockSpeechSynthesis.speaking = true;
      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      document.dispatchEvent(event);

      expect(service.state).toBe("reading");
    });

    it("escape stops when reading", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      document.dispatchEvent(event);

      expect(service.state).toBe("idle");
    });

    it("keyboard events are ignored when idle", () => {
      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
      document.dispatchEvent(event);
      expect(service.state).toBe("idle");
    });

    it("keyboard events are suppressed with modifier keys", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      const event = new KeyboardEvent("keydown", { key: " ", ctrlKey: true, bubbles: true });
      document.dispatchEvent(event);

      // Should still be reading (not paused) because Ctrl was held
      expect(service.state).toBe("reading");
    });

    it("keyboard events are suppressed in editable elements", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      const input = window.document.createElement("input");
      window.document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
      Object.defineProperty(event, "target", { value: input });
      document.dispatchEvent(event);

      // Should still be reading because focus is in an input
      expect(service.state).toBe("reading");

      window.document.body.removeChild(input);
    });
  });

  describe("error handling", () => {
    it("stops on utterance error", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      lastUtterance?.onerror?.();
      expect(service.state).toBe("idle");
    });
  });

  describe("text composition", () => {
    // TODO: enable when hiddenTitle check is enabled in prepareTile
    // it("reads only content for text tiles (hidden title)", () => {
    //   startWithTiles([
    //     { id: "t1", type: "Text", title: "My Title", text: "My content" }
    //   ]);
    //
    //   const spokenText = lastUtterance?.text;
    //   expect(spokenText).not.toContain("My Title");
    //   expect(spokenText).toBe("My content");
    // });

    it("reads title and content for text tiles with both", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "My Title", text: "My content" }
      ]);

      const spokenText = lastUtterance?.text;
      expect(spokenText).toContain("My Title");
      expect(spokenText).toContain("My content");
    });

    it("announces tile type and title for non-text tiles", () => {
      startWithTiles([
        { id: "t1", type: "Geometry", title: "My Shape" }
      ]);

      expect(lastUtterance?.text).toMatch(/tile: My Shape$/);
    });

    it("announces just tile type for tiles with no title or content", () => {
      startWithTiles([
        { id: "t1", type: "Geometry" }
      ]);

      expect(lastUtterance?.text).toMatch(/tile$/);
    });
  });

  describe("text chunking", () => {
    it("keeps short text as a single chunk", () => {
      startWithTiles([
        { id: "t1", type: "Text", text: "Short text." }
      ]);

      // Only one speak call for a short chunk
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it("splits long text into multiple chunks at sentence boundaries", () => {
      const longText = "This is sentence one. This is sentence two. This is sentence three. " +
        "This is sentence four. This is sentence five. This is sentence six. " +
        "This is sentence seven. This is sentence eight. This is sentence nine. " +
        "This is sentence ten with some extra words to fill up the text.";
      startWithTiles([
        { id: "t1", type: "Text", text: longText }
      ]);

      // Should have at least 2 speak calls once chunks advance
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

      // Simulate first chunk ending — should trigger next chunk
      lastUtterance?.onend?.();
      expect(mockSpeechSynthesis.speak.mock.calls.length).toBeGreaterThan(1);
    });

    it("handles text with no sentence-ending punctuation", () => {
      startWithTiles([
        { id: "t1", type: "Text", text: "Text without any punctuation" }
      ]);

      expect(lastUtterance?.text).toBe("Text without any punctuation");
    });
  });

  describe("stale callback guard", () => {
    it("ignores stale onend callbacks after stop", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" }
      ]);

      const staleUtterance = lastUtterance;
      service.stop("user");

      // Simulate the stale callback firing — should not crash or change state
      staleUtterance?.onend?.();
      expect(service.state).toBe("idle");
    });
  });

  describe("logging", () => {
    it("logs start event", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);

      expect(mockLogToolbarEvent).toHaveBeenCalledWith(
        LogEventName.TOOLBAR_READ_ALOUD_START,
        expect.any(Object),
        expect.objectContaining({ pane: "right", tileId: "t1", trigger: "user" })
      );
    });

    it("logs stop event", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "Test", text: "Hello" }
      ]);
      mockLogToolbarEvent.mockClear();

      service.stop("user");

      expect(mockLogToolbarEvent).toHaveBeenCalledWith(
        LogEventName.TOOLBAR_READ_ALOUD_STOP,
        expect.any(Object),
        expect.objectContaining({ pane: "right", reason: "user" })
      );
    });

    it("logs tile transition events", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" }
      ]);

      expect(mockLogToolbarEvent).toHaveBeenCalledWith(
        LogEventName.TOOLBAR_READ_ALOUD_TILE_TRANSITION,
        expect.any(Object),
        expect.objectContaining({ tileId: "t1" })
      );
    });
  });

  describe("tile selection reaction", () => {
    it("switches to newly selected tile in the same pane", async () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" }
      ]);
      expect(service.currentTileId).toBe("t1");

      // Simulate user selecting a different tile
      stores.ui.setSelectedTileId("t2");

      // MobX reactions run synchronously
      expect(service.currentTileId).toBe("t2");
      expect(service.state).toBe("reading");
    });

    it("prepares but does not speak when tile is selected while paused", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" },
        { id: "t2", type: "Text", title: "B", text: "b" }
      ]);
      expect(service.currentTileId).toBe("t1");

      service.pause();
      expect(service.state).toBe("paused");
      mockSpeechSynthesis.speak.mockClear();

      // Simulate user selecting a different tile while paused
      stores.ui.setSelectedTileId("t2");

      // Should update the target tile but remain paused
      expect(service.currentTileId).toBe("t2");
      expect(service.state).toBe("paused");
      // Should NOT have called speak — that waits for resume()
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it("stops when tile is selected in other pane", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" }
      ]);

      // Select a tile that's NOT in this document (simulates other pane)
      stores.ui.setSelectedTileId("unknown-tile-in-other-pane");

      expect(service.state).toBe("idle");
    });

    it("stops left pane reading when active nav tab changes", () => {
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" }
      ], [], "left");
      expect(service.state).toBe("reading");

      // Simulate switching the active nav tab
      stores.persistentUI.setActiveNavTab("my-work");

      expect(service.state).toBe("idle");
    });

    it("stops left pane reading when curriculum section changes", () => {
      // Set an initial tab so currentDocumentGroupId is observable
      stores.persistentUI.setActiveNavTab("problems");
      startWithTiles([
        { id: "t1", type: "Text", title: "A", text: "a" }
      ], [], "left");
      expect(service.state).toBe("reading");

      // Simulate switching the section within the active tab
      stores.persistentUI.setCurrentDocumentGroupId("problems", "section-2");

      expect(service.state).toBe("idle");
    });
  });
});
