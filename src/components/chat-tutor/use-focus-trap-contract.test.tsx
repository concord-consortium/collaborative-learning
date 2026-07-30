// Regression guard for the useFocusTrap behavioral contract the tutor drawer depends on
// (use-tutor-drawer-trap.ts). The contract is version-fragile: it was verified against the
// installed @concord-consortium/accessibility-tools@0.1.0-pre.1 dist (older releases never
// invoke escapeHandlers, so Escape-to-close silently wouldn't fire).

import React, { useRef } from "react";
import { render, act, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@concord-consortium/accessibility-tools/hooks";

// A minimal drawer: a launcher OUTSIDE the trap, a container with a body ("content") slot
// that holds a composer + a button. `open` toggles the config so config-gating is assertable.
function Drawer(props: {
  open: boolean;
  onExit?: () => void;
  escapeHandled?: () => void;        // if set, escapeHandlers[content] returns "handled" and calls this
  apiRef: React.MutableRefObject<any>;
}) {
  const { open, onExit, escapeHandled, apiRef } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const strategy = {
    getElements: () => ({ content: bodyRef.current ?? undefined }),
    contentSlot: "content",
    cycleOrder: ["content"],
    // enterTrap focuses the *slot*, not the composer, so the strategy must place
    // initial focus on the composer explicitly.
    focusContent: () => { composerRef.current?.focus(); return true; },
    onExit,
    escapeHandlers: escapeHandled
      ? { content: () => { escapeHandled(); return "handled" as const; } }
      : undefined
  };

  apiRef.current = useFocusTrap(open ? { containerRef, strategy } : undefined);

  return (
    <div>
      <button data-testid="launcher">Open tutor</button>
      {open && (
        <div data-testid="container" ref={containerRef} tabIndex={-1}>
          <div data-testid="body" ref={bodyRef}>
            <button data-testid="drawer-btn">A control</button>
            <textarea data-testid="composer" ref={composerRef} />
          </div>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap contract for the tutor drawer", () => {
  it("is config-gated: useFocusTrap(undefined) returns null while the drawer is closed", () => {
    const apiRef: React.MutableRefObject<any> = { current: undefined };
    render(<Drawer open={false} apiRef={apiRef} />);
    expect(apiRef.current).toBeNull();
  });

  it("mount sets descendants non-tabbable; enterTrap() restores them AND focuses the composer", () => {
    const apiRef: React.MutableRefObject<any> = { current: undefined };
    const { getByTestId } = render(<Drawer open apiRef={apiRef} />);
    const drawerBtn = getByTestId("drawer-btn");
    const composer = getByTestId("composer");

    // On mount (before enterTrap) setChildrenNonTabbable has run.
    expect(drawerBtn.getAttribute("tabindex")).toBe("-1");
    expect(composer.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).not.toBe(composer);

    act(() => apiRef.current.enterTrap());

    // Tabbability restored and initial focus placed on the composer.
    expect(drawerBtn.getAttribute("tabindex")).toBeNull();
    expect(document.activeElement).toBe(composer);
  });

  it("with no escapeHandlers, Escape runs onExit but container.focus() clobbers a launcher restore", () => {
    const apiRef: React.MutableRefObject<any> = { current: undefined };
    const { getByTestId } = render(
      // onExit naively tries to restore focus to the launcher...
      <Drawer open apiRef={apiRef} onExit={() => getByTestId("launcher").focus()} />
    );
    const container = getByTestId("container");
    const launcher = getByTestId("launcher");
    const composer = getByTestId("composer");

    act(() => apiRef.current.enterTrap());
    expect(document.activeElement).toBe(composer);

    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });

    // ...but the hook's unconditional container.focus() wins: focus is on the
    // container, NOT the launcher — which is why the drawer must not rely on onExit.
    expect(document.activeElement).toBe(container);
    expect(document.activeElement).not.toBe(launcher);
  });

  it("escapeHandlers[content] returning 'handled' skips container.focus(), allowing a launcher restore", () => {
    const apiRef: React.MutableRefObject<any> = { current: undefined };
    const { getByTestId } = render(
      <Drawer
        open
        apiRef={apiRef}
        escapeHandled={() => getByTestId("launcher").focus()}
      />
    );
    const container = getByTestId("container");
    const launcher = getByTestId("launcher");

    act(() => apiRef.current.enterTrap());
    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });

    // "handled" suppressed the trap's exit + container.focus(); our restore stands.
    expect(document.activeElement).toBe(launcher);
    expect(document.activeElement).not.toBe(container);
  });
});
