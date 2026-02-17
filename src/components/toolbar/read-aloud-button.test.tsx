import { render, screen } from "@testing-library/react";
import { runInAction } from "mobx";
import React from "react";
import { Provider } from "mobx-react";
import { ToolbarButtonModel } from "../../models/tiles/toolbar-button";
import { ReadAloudButton } from "./read-aloud-button";
import { resetReadAloudService, getReadAloudService } from "../../models/services/read-aloud-service";
import { specStores } from "../../models/stores/spec-stores";
import { IStores } from "../../models/stores/stores";

// Mock speechSynthesis — minimal stub sufficient for button rendering tests.
// The service test (read-aloud-service.test.ts) uses a richer mock that captures utterances.
const mockSpeechSynthesis = {
  speak: jest.fn(),
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

class MockUtterance {
  text: string;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}
(global as any).SpeechSynthesisUtterance = MockUtterance;

// Mock the logger
jest.mock("../../models/tiles/log/log-toolbar-event", () => ({
  logToolbarEvent: jest.fn()
}));

describe("ReadAloudButton", () => {
  let stores: IStores;

  const buttonConfig = {
    id: "readAloud",
    title: "Read Aloud",
    iconId: "icon-read-aloud-tool",
    isTileTool: false as const
  };
  const toolButton = ToolbarButtonModel.create(buttonConfig);

  const mockProps = {
    toolButton,
    isActive: false,
    isDisabled: false,
    onSetToolActive: jest.fn(),
    onClick: jest.fn(),
    onDragStart: jest.fn(),
    onShowDropHighlight: jest.fn(),
    onHideDropHighlight: jest.fn(),
  };

  beforeEach(() => {
    stores = specStores();
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
  });

  afterEach(() => {
    resetReadAloudService();
  });

  it("renders with correct test id", () => {
    render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="right" />
      </Provider>
    );
    expect(screen.getByTestId("tool-readaloud")).toBeInTheDocument();
  });

  it("has correct ARIA attributes when inactive", () => {
    render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="right" />
      </Provider>
    );
    const button = screen.getByTestId("tool-readaloud");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Read Aloud: Off");
    expect(button.tagName).toBe("BUTTON");
  });

  it("has active class and aria-pressed when service is active on same pane", () => {
    const { rerender } = render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="right" />
      </Provider>
    );

    // Start the service on right pane by using the service directly
    const service = getReadAloudService(stores);
    runInAction(() => {
      service.state = "reading";
      service.activePane = "right";
    });

    rerender(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="right" />
      </Provider>
    );

    const button = screen.getByTestId("tool-readaloud");
    expect(button.classList.contains("active")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not show active when service is active on different pane", () => {
    render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="left" />
      </Provider>
    );

    const service = getReadAloudService(stores);
    runInAction(() => {
      service.state = "reading";
      service.activePane = "right";
    });

    const button = screen.getByTestId("tool-readaloud");
    // The button for the left pane should not be active
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows disabled styling when disabled", () => {
    render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} isDisabled={true} pane="right" />
      </Provider>
    );
    const button = screen.getByTestId("tool-readaloud");
    expect(button.classList.contains("disabled")).toBe(true);
  });

  it("renders nothing when speechSynthesis is not supported", () => {
    // Temporarily remove speechSynthesis from window
    const origDescriptor = Object.getOwnPropertyDescriptor(window, "speechSynthesis");
    delete (window as any).speechSynthesis;
    resetReadAloudService();

    const { container } = render(
      <Provider stores={stores}>
        <ReadAloudButton {...mockProps} pane="right" />
      </Provider>
    );
    expect(container.firstChild).toBeNull();

    // Restore
    if (origDescriptor) {
      Object.defineProperty(window, "speechSynthesis", origDescriptor);
    }
    resetReadAloudService();
  });
});
