import { render, waitFor } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultInteractiveApiContent } from "./interactive-api-tile-content";
import { InteractiveApiComponent } from "./interactive-api-tile";

// Import registration to ensure tile type is registered
import "./interactive-api-tile-registration";

describe("InteractiveApiComponent Integration Tests", () => {
  const mockIframePhone = {
    disconnect: jest.fn(),
    addListener: jest.fn(),
    post: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock iframe-phone with access to listeners
    const listeners: Record<string, (data: any) => void> = {};
    mockIframePhone.addListener.mockImplementation((type: string, handler: (data: any) => void) => {
      listeners[type] = handler;
    });

    // Provide access to trigger listeners in tests
    (mockIframePhone as any).triggerListener = (type: string, data: any) => {
      if (listeners[type]) {
        listeners[type](data);
      }
    };

    jest.doMock("iframe-phone", () => ({
      ParentEndpoint: jest.fn().mockImplementation((iframe, callback) => {
        // Call initInteractive callback after setup
        setTimeout(callback, 0);
        return mockIframePhone;
      })
    }));
  });

  const createDefaultProps = () => {
    const content = defaultInteractiveApiContent();
    content.setUrl("https://example.com/interactive");
    const model = TileModel.create({ content });

    return {
      tileElt: null,
      context: "",
      docId: "",
      documentContent: null,
      isUserResizable: true,
      readOnly: false,
      model,
      onResizeRow: jest.fn(),
      onSetCanAcceptDrop: jest.fn(),
      onRequestRowHeight: jest.fn(),
      onRequestUniqueTitle: jest.fn(),
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn()
    };
  };

  it("sends initInteractive message on mount", async () => {
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    await waitFor(() => {
      expect(mockIframePhone.post).toHaveBeenCalledWith(
        "initInteractive",
        expect.objectContaining({
          version: 1,
          mode: "runtime"
        })
      );
    });
  });

  it("sends report mode in read-only", async () => {
    const props = createDefaultProps();
    props.readOnly = true;
    render(<InteractiveApiComponent {...props} />);

    await waitFor(() => {
      expect(mockIframePhone.post).toHaveBeenCalledWith(
        "initInteractive",
        expect.objectContaining({
          mode: "report"
        })
      );
    });
  });

  it("updates interactive state when received from iframe", async () => {
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    const newState = { answer: "42", submitted: true };

    await waitFor(() => {
      (mockIframePhone as any).triggerListener("interactiveState", newState);
    });

    // Wait for debounce (500ms)
    await waitFor(() => {
      const content = props.model.content as any;
      expect(content.interactiveState).toEqual(newState);
    }, { timeout: 1000 });
  });

  it("polls for interactive state every 2 seconds", async () => {
    jest.useFakeTimers();
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    // Clear initial calls
    mockIframePhone.post.mockClear();

    // Advance 2 seconds
    jest.advanceTimersByTime(2000);
    expect(mockIframePhone.post).toHaveBeenCalledWith("getInteractiveState");

    // Advance another 2 seconds
    jest.advanceTimersByTime(2000);
    expect(mockIframePhone.post).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
