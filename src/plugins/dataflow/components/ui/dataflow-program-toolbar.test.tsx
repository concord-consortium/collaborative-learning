import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import { specStores } from "../../../../models/stores/spec-stores";
import { DataflowProgramToolbar } from "./dataflow-program-toolbar";
import { NodeTypes } from "../../model/utilities/node";

// Required so the dataflow tile is registered before any rendering pulls in
// dataflow-types side effects.
import "../../dataflow-registration";

interface IRenderOptions {
  disabled?: boolean;
  isTesting?: boolean;
}

interface IRenderResult {
  container: HTMLElement;
  onNodeCreateClick: jest.Mock<void, [string]>;
  onClearClick: jest.Mock<void, []>;
  toolbar: HTMLElement;
  buttons: HTMLButtonElement[];
}

function renderToolbar(opts: IRenderOptions = {}): IRenderResult {
  const stores = specStores();
  const onNodeCreateClick = jest.fn();
  const onClearClick = jest.fn();
  const utils = render(
    <Provider stores={stores}>
      <DataflowProgramToolbar
        disabled={opts.disabled ?? false}
        isTesting={opts.isTesting ?? false}
        onClearClick={onClearClick}
        onNodeCreateClick={onNodeCreateClick}
        tileId="test-tile"
      />
    </Provider>
  );
  const toolbar = utils.container.querySelector('[role="toolbar"]') as HTMLElement;
  // Filter to the Add-Block buttons only (excludes the test-only Clear button).
  const buttons = Array.from(
    utils.container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Add "]')
  );
  return { container: utils.container, onNodeCreateClick, onClearClick, toolbar, buttons };
}

describe("DataflowProgramToolbar accessibility (CLUE-455)", () => {
  it("renders as a toolbar with aria-orientation=vertical and an aria-label", () => {
    const { toolbar } = renderToolbar();
    expect(toolbar).not.toBeNull();
    expect(toolbar.getAttribute("aria-orientation")).toBe("vertical");
    expect(toolbar.getAttribute("aria-label")).toBe("Add block");
  });

  it("renders one Add-Block button per NodeType with an aria-label", () => {
    const { buttons } = renderToolbar();
    expect(buttons).toHaveLength(NodeTypes.length);
    NodeTypes.forEach((nt, i) => {
      const expected = `Add ${nt.displayName ?? nt.name} block`;
      expect(buttons[i].getAttribute("aria-label")).toBe(expected);
    });
  });

  it("makes only the first button a tab stop (roving tabindex)", () => {
    const { buttons } = renderToolbar();
    expect(buttons[0].getAttribute("tabindex")).toBe("0");
    buttons.slice(1).forEach(b => {
      expect(b.getAttribute("tabindex")).toBe("-1");
    });
  });
});

describe("DataflowProgramToolbar keyboard navigation (CLUE-455)", () => {
  it("ArrowDown advances the roving tabindex to the next button", () => {
    const { toolbar, buttons } = renderToolbar();
    buttons[0].focus();
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(buttons[1].getAttribute("tabindex")).toBe("0");
    expect(buttons[0].getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("ArrowUp from the first button stays on the first (no-wrap behavior)", () => {
    const { toolbar, buttons } = renderToolbar();
    buttons[0].focus();
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(buttons[0].getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("ArrowDown from the last button stays on the last (no-wrap behavior)", () => {
    const { toolbar, buttons } = renderToolbar();
    const last = buttons.length - 1;
    fireEvent.keyDown(toolbar, { key: "End" });
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(buttons[last].getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(buttons[last]);
  });

  it("Home jumps to the first button", () => {
    const { toolbar, buttons } = renderToolbar();
    fireEvent.keyDown(toolbar, { key: "End" });
    fireEvent.keyDown(toolbar, { key: "Home" });
    expect(buttons[0].getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("End jumps to the last button", () => {
    const { toolbar, buttons } = renderToolbar();
    fireEvent.keyDown(toolbar, { key: "End" });
    expect(buttons[buttons.length - 1].getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});

describe("DataflowProgramToolbar activation (CLUE-455)", () => {
  it("clicking a button calls onNodeCreateClick with that node type", () => {
    const { buttons, onNodeCreateClick } = renderToolbar();
    fireEvent.click(buttons[0]);
    expect(onNodeCreateClick).toHaveBeenCalledWith(NodeTypes[0].name);
  });

  it("does not call onNodeCreateClick when the toolbar is disabled", () => {
    const { buttons, onNodeCreateClick } = renderToolbar({ disabled: true });
    fireEvent.click(buttons[0]);
    expect(onNodeCreateClick).not.toHaveBeenCalled();
  });

  it("announces 'Added X block' via the aria-live region on activation", () => {
    const { container, buttons } = renderToolbar();
    const live = container.querySelector<HTMLDivElement>('[aria-live="polite"]');
    expect(live).not.toBeNull();
    fireEvent.click(buttons[0]);
    // Wait for the 150ms setTimeout in announce() (clear-then-set timing for SR pollers).
    return new Promise<void>(resolve => setTimeout(() => {
      const expected = `Added ${NodeTypes[0].displayName ?? NodeTypes[0].name} block`;
      expect(live!.textContent).toBe(expected);
      resolve();
    }, 200));
  });
});
