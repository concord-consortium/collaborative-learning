import React, { useContext, useEffect, useRef, useState } from "react";
import { Provider } from "mobx-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TileToolbarButton } from "./tile-toolbar-button";
import { registerTileToolbarButtons } from "./toolbar-button-manager";
import { TileToolbar } from "./tile-toolbar";
import { ITileModel, TileModel } from "../../models/tiles/tile-model";
import { defaultTextContent } from "../../models/tiles/text/text-content";
import { specStores } from "../../models/stores/spec-stores";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { TileApiInterface, TileApiInterfaceContext, TileModelContext } from "../tiles/tile-api";

import CopyIcon from "../../../assets/icons/copy/copy-icon-default.svg";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../models/tiles/text/text-registration";

const clickHandler = jest.fn();

function SampleToolbarButtonA() {
  return (
    <TileToolbarButton name="a" title="Test Button A" onClick={clickHandler}>
      <CopyIcon/>
    </TileToolbarButton>);
}

function SampleToolbarButtonB() {
  return (
    <TileToolbarButton name="b" title="Test Button B" onClick={clickHandler}>
      <CopyIcon/>
    </TileToolbarButton>);
}

function SampleDisabledButton() {
  return (
    <TileToolbarButton name="disabled-btn" title="Disabled Action" onClick={clickHandler} disabled={true}>
      <CopyIcon/>
    </TileToolbarButton>);
}

function SampleToggleButton({ selected }: { selected?: boolean }) {
  return (
    <TileToolbarButton name="toggle-btn" title="Toggle" onClick={clickHandler} selected={selected}>
      <CopyIcon/>
    </TileToolbarButton>);
}

const sampleButtons = [
  {
    name: "a",
    component: SampleToolbarButtonA,
  },
  {
    name: "b",
    component: SampleToolbarButtonB,
  }
];

interface ISampleTileProps {
  type: string;
  model: ITileModel;
}

function SampleTile({type, model}: ISampleTileProps) {
  const tileElt = useRef<HTMLDivElement>(null);
  return (
    <TileModelContext.Provider value={model}>
      <div ref={tileElt}>
        Tile content.
      </div>
      <TileToolbar readOnly={false} tileElement={tileElt.current} tileType={type} />
    </TileModelContext.Provider>
  );
}

// Extended SampleTile with TileApiInterface support for keyboard tests
interface ISampleTileWithApiProps {
  type: string;
  model: ITileModel;
  focusableElements?: { contentElement?: HTMLElement; titleElement?: HTMLElement };
}

function SampleTileWithApi({ type, model, focusableElements }: ISampleTileWithApiProps) {
  const tileApiInterface = useContext(TileApiInterfaceContext);
  const [tileElt, setTileElt] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tileApiInterface && focusableElements) {
      tileApiInterface.register(model.id, {
        getFocusableElements: () => focusableElements,
      });
      return () => tileApiInterface.unregister(model.id);
    }
  }, [model.id, tileApiInterface, focusableElements]);

  return (
    <TileModelContext.Provider value={model}>
      <div ref={setTileElt} className="tool-tile" data-tool-id={model.id} tabIndex={-1}
           data-testid="mock-tile-element">
        Tile content.
      </div>
      {tileElt && <TileToolbar readOnly={false} tileElement={tileElt} tileType={type} />}
    </TileModelContext.Provider>
  );
}

// Register once at module level to avoid "overrides previous definition" warnings
registerTileToolbarButtons("test", sampleButtons);

function renderToolbarWithApi(options?: {
  hasContent?: boolean;
  hasTitle?: boolean;
}) {
  const { hasContent = true, hasTitle = true } = options ?? {};

  const contentElement = hasContent ? document.createElement("div") : undefined;
  if (contentElement) {
    contentElement.setAttribute("tabindex", "-1");
    contentElement.setAttribute("data-testid", "mock-content");
    document.body.appendChild(contentElement);
  }

  const titleElement = hasTitle ? document.createElement("input") : undefined;
  if (titleElement) {
    titleElement.setAttribute("data-testid", "mock-title");
    document.body.appendChild(titleElement);
  }

  const model = TileModel.create({ content: defaultTextContent() });
  const stores = specStores({
    appConfig: specAppConfig({
      config: {
        settings: {
          test: { tools: ["a", "b"] }
        }
      }
    })
  });
  stores.ui.setSelectedTileId(model.id);

  const tileApiInterface = new TileApiInterface();

  const result = render(
    <Provider stores={stores}>
      <TileApiInterfaceContext.Provider value={tileApiInterface}>
        <SampleTileWithApi
          type="test"
          model={model}
          focusableElements={{ contentElement, titleElement }}
        />
      </TileApiInterfaceContext.Provider>
    </Provider>
  );

  const tileElement = screen.getByTestId("mock-tile-element");
  const toolbar = screen.getByTestId("tile-toolbar");
  const buttons = toolbar.querySelectorAll("button");

  return {
    stores, model, tileElement, toolbar, buttons,
    contentElement, titleElement,
    cleanup: () => {
      contentElement?.parentNode?.removeChild(contentElement);
      titleElement?.parentNode?.removeChild(titleElement);
    },
    ...result,
  };
}

describe("Tile toolbar button", () => {

  beforeEach(() => {
    clickHandler.mockClear();
  });

  it("can render a button", () => {
    render(
      <TileToolbarButton name="test-button" title="Test Button" onClick={clickHandler}>
        <CopyIcon/>
      </TileToolbarButton>);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toContainHTML("<svg");
    screen.getByRole("button").click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("can read tools list from app configuration", () => {
    const model = TileModel.create({content: defaultTextContent()});
    const stores = specStores({
      appConfig: specAppConfig({
        config: {
          settings: {
            test: {
              tools: ["b"]
            }
          }
        }
        })
      });
    stores.ui.setSelectedTileId(model.id);

    registerTileToolbarButtons("test", sampleButtons);

    render(
      <Provider stores={stores}>
        <SampleTile type="test" model={model}/>
      </Provider>
    );
    expect(screen.getByTestId("tile-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tile-toolbar")).toContainHTML("Test Button B");
    expect(screen.getByTestId("tile-toolbar")).not.toContainHTML("Test Button A");

  });

  // --- Button ARIA attributes ---

  it("button has aria-label from title", () => {
    render(
      <TileToolbarButton name="test-btn" title="Bold" onClick={clickHandler}>
        <CopyIcon/>
      </TileToolbarButton>
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Bold");
  });

  it("disabled button has aria-disabled but not HTML disabled", () => {
    render(<SampleDisabledButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
  });

  it("toggle button has aria-pressed", () => {
    const { rerender } = render(<SampleToggleButton selected={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    rerender(<SampleToggleButton selected={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("non-toggle button has no aria-pressed", () => {
    render(
      <TileToolbarButton name="no-toggle" title="Action" onClick={clickHandler}>
        <CopyIcon/>
      </TileToolbarButton>
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  it("clicking disabled button announces screen reader message", () => {
    render(<SampleDisabledButton />);
    const button = screen.getByRole("button");
    button.click();
    const announcement = screen.getByRole("status");
    expect(announcement).toHaveTextContent("Select something to enable this action");
  });
});

describe("Tile toolbar ARIA and keyboard", () => {

  afterEach(() => {
    // Clean up any appended elements
  });

  // --- Toolbar ARIA ---

  it("toolbar has role='toolbar'", () => {
    const { cleanup } = renderToolbarWithApi();
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    cleanup();
  });

  it("toolbar has tile-type-specific aria-label", () => {
    const { toolbar, cleanup } = renderToolbarWithApi();
    // "test" type has no registered displayName, so falls back to raw type
    expect(toolbar).toHaveAttribute("aria-label", "test tile toolbar");
    cleanup();
  });

  it("toolbar has data-tile-id matching model id", () => {
    const { toolbar, model, cleanup } = renderToolbarWithApi();
    expect(toolbar).toHaveAttribute("data-tile-id", model.id);
    cleanup();
  });

  // --- Tab/Escape from toolbar ---

  it("Tab from toolbar button moves focus to content element", () => {
    const { buttons, contentElement, cleanup } = renderToolbarWithApi();
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab" });
    expect(document.activeElement).toBe(contentElement);
    cleanup();
  });

  it("Shift+Tab from toolbar button moves focus to title element", () => {
    const { buttons, titleElement, cleanup } = renderToolbarWithApi();
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(titleElement);
    cleanup();
  });

  it("Shift+Tab from toolbar goes to content when no title", () => {
    const { buttons, contentElement, cleanup } = renderToolbarWithApi({ hasTitle: false });
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(contentElement);
    cleanup();
  });

  it("Shift+Tab from toolbar skips non-focusable title and goes to content", () => {
    // Simulate a title element that exists but can't receive focus
    // (e.g., .editable-tile-title-text rendered as a plain div)
    const nonFocusableTitle = document.createElement("div");
    nonFocusableTitle.textContent = "Title";
    document.body.appendChild(nonFocusableTitle);

    const contentElement = document.createElement("div");
    contentElement.setAttribute("tabindex", "-1");
    document.body.appendChild(contentElement);

    const model = TileModel.create({ content: defaultTextContent() });
    const stores = specStores({
      appConfig: specAppConfig({
        config: { settings: { test: { tools: ["a", "b"] } } }
      })
    });
    stores.ui.setSelectedTileId(model.id);
    const tileApiInterface = new TileApiInterface();

    render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={tileApiInterface}>
          <SampleTileWithApi
            type="test"
            model={model}
            focusableElements={{
              contentElement,
              titleElement: nonFocusableTitle as unknown as HTMLInputElement,
            }}
          />
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    const buttons = screen.getByTestId("tile-toolbar").querySelectorAll("button");
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    // Should skip the non-focusable title and land on content
    expect(document.activeElement).toBe(contentElement);

    nonFocusableTitle.parentNode?.removeChild(nonFocusableTitle);
    contentElement.parentNode?.removeChild(contentElement);
  });

  it("Escape from toolbar focuses tile element", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi();
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Escape" });
    expect(document.activeElement).toBe(tileElement);
    cleanup();
  });

  it("Escape from toolbar dispatches toolbar-escape event on tile element", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi();
    const escapeHandler = jest.fn();
    tileElement.addEventListener("toolbar-escape", escapeHandler);

    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Escape" });
    expect(escapeHandler).toHaveBeenCalledTimes(1);

    tileElement.removeEventListener("toolbar-escape", escapeHandler);
    cleanup();
  });

  // --- ArrowUp from toolbar ---

  it("ArrowUp from toolbar button focuses tile element", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi();
    (buttons[0] as HTMLElement).focus();
    // ArrowUp is handled by React onKeyDown, so dispatch on toolbar container
    const toolbar = screen.getByRole("toolbar");
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(document.activeElement).toBe(tileElement);
    cleanup();
  });

  it("ArrowUp does not dispatch toolbar-escape (soft exit)", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi();
    const escapeHandler = jest.fn();
    tileElement.addEventListener("toolbar-escape", escapeHandler);

    (buttons[0] as HTMLElement).focus();
    const toolbar = screen.getByRole("toolbar");
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(escapeHandler).not.toHaveBeenCalled();

    tileElement.removeEventListener("toolbar-escape", escapeHandler);
    cleanup();
  });

  // --- Tab fallback when no focusable elements ---

  it("Tab from toolbar falls back to tile element when no content or title", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi({
      hasContent: false, hasTitle: false,
    });
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab" });
    expect(document.activeElement).toBe(tileElement);
    cleanup();
  });

  it("Shift+Tab from toolbar falls back to tile element when no title or content", () => {
    const { buttons, tileElement, cleanup } = renderToolbarWithApi({
      hasContent: false, hasTitle: false,
    });
    (buttons[0] as HTMLElement).focus();
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(tileElement);
    cleanup();
  });
});
