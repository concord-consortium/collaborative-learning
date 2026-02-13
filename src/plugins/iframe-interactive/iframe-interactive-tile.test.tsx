import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultIframeInteractiveContent } from "./iframe-interactive-tile-content";
import { IframeInteractiveComponent } from "./iframe-interactive-tile";

// Mock iframe-phone to avoid actual iframe communication in tests
jest.mock("iframe-phone", () => ({
  ParentEndpoint: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    addListener: jest.fn(),
    post: jest.fn()
  }))
}));

// Mock stores hooks to avoid needing full stores context
const mockIsSelectedTile = jest.fn(() => false);
jest.mock("../../hooks/use-stores", () => ({
  useSettingFromStores: jest.fn(() => "geolocation; microphone; camera; bluetooth"),
  useStores: jest.fn(() => ({
    ui: {
      isSelectedTile: mockIsSelectedTile
    }
  }))
}));

// Mock container context for selection handling
jest.mock("../../components/document/container-context", () => ({
  useContainerContext: jest.fn(() => ({ model: undefined }))
}));

// Mock userSelectTile to avoid needing full UI store
jest.mock("../../models/stores/ui", () => ({
  userSelectTile: jest.fn()
}));

// The iframe-interactive tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./iframe-interactive-tile-registration";

describe("IframeInteractiveComponent", () => {
  const mockRequestRowHeight = jest.fn();
  const mockRegisterTileApi = jest.fn();

  // Create fresh content and model for each test to avoid state leakage
  const createTestProps = () => {
    const content = defaultIframeInteractiveContent();
    const model = TileModel.create({ content });

    return {
      tileElt: null,
      context: "",
      docId: "",
      documentContent: null,
      isUserResizable: true,
      model,
      content,
      onResizeRow: jest.fn(),
      onSetCanAcceptDrop: jest.fn(),
      onRequestRowHeight: mockRequestRowHeight,
      onRequestUniqueTitle: jest.fn(),
      onRegisterTileApi: mockRegisterTileApi,
      onUnregisterTileApi: jest.fn()
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders successfully", () => {
    const props = createTestProps();
    render(<IframeInteractiveComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("shows placeholder when no URL is set", () => {
    const props = createTestProps();
    render(<IframeInteractiveComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("renders iframe when URL is set", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://example.com/interactive");
  });

  it("registers tile API for export", () => {
    const props = createTestProps();
    render(<IframeInteractiveComponent {...props} />);

    expect(mockRegisterTileApi).toHaveBeenCalledWith(
      expect.objectContaining({
        exportContentAsTileJson: expect.any(Function)
      })
    );
  });

  it("exports content as JSON via tile API", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/test");
    render(<IframeInteractiveComponent {...props} />);

    const tileApi = mockRegisterTileApi.mock.calls[0][0];
    const json = tileApi.exportContentAsTileJson();

    expect(json).toContain('"type": "IframeInteractive"');
    expect(json).toContain('"url": "https://example.com/test"');
  });

  it("applies sandbox attributes for security", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups allow-downloads");
  });

  it("enables scrolling when enableScroll is true", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    props.content.setEnableScroll(true);
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "yes");
  });

  it("disables scrolling when enableScroll is false", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    props.content.setEnableScroll(false);
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "no");
  });

  it("includes skip to content link for accessibility", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const skipLink = screen.getByText("Skip to interactive content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#interactive-content");
  });

  it("has proper ARIA attributes", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Interactive content");
  });

  it("shows loading spinner after 2 seconds if still loading", async () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    // Initially no spinner
    expect(screen.queryByText("Loading interactive...")).not.toBeInTheDocument();

    // Wait for 2 second timeout
    await waitFor(() => {
      expect(screen.getByText("Loading interactive...")).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it("updates when model URL changes", () => {
    const props = createTestProps();
    const { rerender } = render(<IframeInteractiveComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();

    props.content.setUrl("https://example.com/new-interactive");
    rerender(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("src", "https://example.com/new-interactive");
  });

  it("applies selected class to tile-content when tile is selected", () => {
    mockIsSelectedTile.mockReturnValue(true);
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const wrapper = screen.getByTitle("Interactive Content").closest(".tile-content");
    expect(wrapper).toHaveClass("selected");
    mockIsSelectedTile.mockReturnValue(false);
  });

  it("does not apply selected class when tile is not selected", () => {
    mockIsSelectedTile.mockReturnValue(false);
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const wrapper = screen.getByTitle("Interactive Content").closest(".tile-content");
    expect(wrapper).not.toHaveClass("selected");
  });

  it("calls userSelectTile when clicking on the tile-content wrapper", () => {
    const { userSelectTile: mockUserSelectTile } = require("../../models/stores/ui");
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const wrapper = screen.getByTitle("Interactive Content").closest(".tile-content")!;
    fireEvent.mouseDown(wrapper);
    expect(mockUserSelectTile).toHaveBeenCalled();
  });

  it("attaches selection listeners when tileElt is provided", () => {
    const { userSelectTile: mockUserSelectTile } = require("../../models/stores/ui");
    const tileElt = document.createElement("div");
    const props = createTestProps();
    (props as any).tileElt = tileElt;
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    // Dispatch a mousedown directly on the tileElt (simulating clicking the tile edge)
    const event = new MouseEvent("mousedown", { bubbles: false });
    // Make currentTarget === target by dispatching directly on the element
    tileElt.dispatchEvent(event);
    expect(mockUserSelectTile).toHaveBeenCalled();
  });

  it("cleans up tileElt listeners on unmount", () => {
    const tileElt = document.createElement("div");
    const removeSpy = jest.spyOn(tileElt, "removeEventListener");
    const props = createTestProps();
    (props as any).tileElt = tileElt;
    props.content.setUrl("https://example.com/interactive");
    const { unmount } = render(<IframeInteractiveComponent {...props} />);

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("selects tile when iframe gains focus via window blur", async () => {
    const { userSelectTile: mockUserSelectTile } = require("../../models/stores/ui");
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    // Simulate the iframe being the active element when window blurs
    Object.defineProperty(document, "activeElement", {
      get: () => iframe,
      configurable: true
    });

    mockUserSelectTile.mockClear();
    window.dispatchEvent(new Event("blur"));

    // The handler uses setTimeout(0), so wait for it
    await waitFor(() => {
      expect(mockUserSelectTile).toHaveBeenCalled();
    });

    // Restore activeElement
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true
    });
  });

  it("does not select tile on window blur when iframe is not active", async () => {
    const { userSelectTile: mockUserSelectTile } = require("../../models/stores/ui");
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    // activeElement is not the iframe
    Object.defineProperty(document, "activeElement", {
      get: () => document.body,
      configurable: true
    });

    mockUserSelectTile.mockClear();
    window.dispatchEvent(new Event("blur"));

    // Wait a tick for the setTimeout(0)
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockUserSelectTile).not.toHaveBeenCalled();
  });

  it("skip-to-content link focuses the iframe on click", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content") as HTMLIFrameElement;
    const focusSpy = jest.spyOn(iframe, "focus");
    const skipLink = screen.getByText("Skip to interactive content");
    fireEvent.click(skipLink);
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("skip-to-content link responds to Enter key", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<IframeInteractiveComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content") as HTMLIFrameElement;
    const focusSpy = jest.spyOn(iframe, "focus");
    const skipLink = screen.getByText("Skip to interactive content");
    fireEvent.keyDown(skipLink, { key: "Enter" });
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("applies selected class to placeholder when tile is selected", () => {
    mockIsSelectedTile.mockReturnValue(true);
    const props = createTestProps();
    // No URL set — shows placeholder
    render(<IframeInteractiveComponent {...props} />);

    const wrapper = screen.getByText("No URL configured in authoring").closest(".tile-content");
    expect(wrapper).toHaveClass("selected");
    mockIsSelectedTile.mockReturnValue(false);
  });
});
