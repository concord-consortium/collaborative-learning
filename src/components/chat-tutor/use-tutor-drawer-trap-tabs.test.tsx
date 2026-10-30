import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useTutorDrawerTrap } from "./use-tutor-drawer-trap";

// Uses the real useFocusTrap, so Tab and Escape go through the trap's own key handling.
const Harness: React.FC<{ onEscape: () => void }> = ({ onEscape }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drawerTabsRef = useRef<HTMLDivElement>(null);
  useTutorDrawerTrap({ containerRef, bodyRef, onEscape, active: true, drawerTabsRef });
  return (
    <div>
      <div ref={drawerTabsRef}>
        <button>Ada</button>
        <button>Connection help</button>
      </div>
      <div ref={containerRef} tabIndex={-1}>
        <div ref={bodyRef}>
          <button>Copy</button>
          <textarea className="chat-input" aria-label="Message" />
        </div>
      </div>
    </div>
  );
};

function pressTab(shiftKey = false) {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab", shiftKey });
  });
}

describe("useTutorDrawerTrap with the drawer's tab buttons", () => {
  it("lets Tab and Shift+Tab reach the tab buttons, and Escape there still closes Ada", () => {
    const onEscape = jest.fn();
    render(<Harness onEscape={onEscape} />);
    const message = screen.getByRole("textbox", { name: "Message" });
    const ada = screen.getByRole("button", { name: "Ada" });
    const help = screen.getByRole("button", { name: "Connection help" });
    expect(document.activeElement).toBe(message);

    pressTab();
    expect(document.activeElement).toBe(ada);
    pressTab();
    expect(document.activeElement).toBe(help);
    pressTab();
    expect(document.activeElement).toBe(message);

    act(() => screen.getByRole("button", { name: "Copy" }).focus());
    pressTab(true);
    expect(document.activeElement).toBe(help);

    act(() => {
      fireEvent.keyDown(help, { key: "Escape" });
    });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
