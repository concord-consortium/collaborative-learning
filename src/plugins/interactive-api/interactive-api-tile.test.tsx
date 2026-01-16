import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultInteractiveApiContent } from "./interactive-api-tile-content";
import { InteractiveApiComponent } from "./interactive-api-tile";

// Mock iframe-phone to avoid actual iframe communication in tests
jest.mock("iframe-phone", () => ({
  ParentEndpoint: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    addListener: jest.fn(),
    post: jest.fn()
  }))
}));

// The interactive-api tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./interactive-api-tile-registration";

describe("InteractiveApiComponent", () => {
  const mockRequestRowHeight = jest.fn();
  const mockRegisterTileApi = jest.fn();

  // Create fresh content and model for each test to avoid state leakage
  const createTestProps = () => {
    const content = defaultInteractiveApiContent();
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
    render(<InteractiveApiComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("shows placeholder when no URL is set", () => {
    const props = createTestProps();
    render(<InteractiveApiComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("renders iframe when URL is set", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://example.com/interactive");
  });

  it("registers tile API for export", () => {
    const props = createTestProps();
    render(<InteractiveApiComponent {...props} />);

    expect(mockRegisterTileApi).toHaveBeenCalledWith(
      expect.objectContaining({
        exportContentAsTileJson: expect.any(Function)
      })
    );
  });

  it("exports content as JSON via tile API", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/test");
    render(<InteractiveApiComponent {...props} />);

    const tileApi = mockRegisterTileApi.mock.calls[0][0];
    const json = tileApi.exportContentAsTileJson();

    expect(json).toContain('"type": "InteractiveApi"');
    expect(json).toContain('"url": "https://example.com/test"');
  });

  it("applies configurable iframe permissions", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    props.content.setAllowedPermissions("geolocation; microphone");
    render(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("allow", "geolocation; microphone");
  });

  it("applies sandbox attributes for security", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups allow-downloads");
  });

  it("enables scrolling when enableScroll is true", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    props.content.setEnableScroll(true);
    render(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "yes");
  });

  it("disables scrolling when enableScroll is false", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    props.content.setEnableScroll(false);
    render(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "no");
  });

  it("includes skip to content link for accessibility", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...props} />);

    const skipLink = screen.getByText("Skip to interactive content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#interactive-content");
  });

  it("has proper ARIA attributes", () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...props} />);

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Interactive content");
  });

  it("shows loading spinner after 2 seconds if still loading", async () => {
    const props = createTestProps();
    props.content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...props} />);

    // Initially no spinner
    expect(screen.queryByText("Loading interactive...")).not.toBeInTheDocument();

    // Wait for 2 second timeout
    await waitFor(() => {
      expect(screen.getByText("Loading interactive...")).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it("updates when model URL changes", () => {
    const props = createTestProps();
    const { rerender } = render(<InteractiveApiComponent {...props} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();

    props.content.setUrl("https://example.com/new-interactive");
    rerender(<InteractiveApiComponent {...props} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("src", "https://example.com/new-interactive");
  });
});
