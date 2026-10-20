import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { autoUpdate, flip, getOverflowAncestors, offset, shift, useFloating } from "@floating-ui/react";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { useTileToolbarTileElement } from "../../../../components/toolbar/tile-toolbar-context";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { useStores } from "../../../../hooks/use-stores";
import { DataflowContentModelType } from "../../model/dataflow-content";
import {
  DeviceChoice, DeviceConnection, getDeviceConnection, kDeviceChoiceLabels, kDeviceChoiceOrder
} from "../../model/device-connection";
import { connectButtonState, connectButtonTooltip } from "../../utilities/connect-button-state";
import {
  connectDeviceForTile, disconnectDeviceForTile, reconnectDeviceForTile
} from "../../utilities/device-actions";

import ConnectIcon from "../../assets/icons/connect-icon.svg";

import "./dataflow-connect-pane.scss";

const kPaneLabel = "Device connection";

// How each navigation key moves focus: by a signed number of controls, or to the first or last one.
const kFocusSteps: Record<string, number | "first" | "last"> = {
  ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: "first", End: "last"
};

interface IPaneControlProps {
  label: string;
  text: string;
  busy: boolean;
  onActivate: () => void;
}

// `div role="button"`, not a real button: the toolbar's roving tabindex sweeps
// querySelectorAll("button"), which would pull the pane's controls into its Left/Right cycle.
function PaneControl({ label, text, busy, onActivate }: IPaneControlProps) {
  function activate(e: React.SyntheticEvent) {
    e.stopPropagation();
    if ("key" in e) (e as React.KeyboardEvent).preventDefault();
    if (!busy) onActivate();
  }
  return (
    <div role="button" tabIndex={0} aria-label={label} aria-disabled={busy || undefined}
        className={classNames("connect-control", { disabled: busy })}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") activate(e);
        }}>
      {text}
    </div>
  );
}

interface IConnectPaneProps {
  connection: DeviceConnection;
  content: DataflowContentModelType;
  tileId: string;
  onClose: () => void;
}

const ConnectPane = observer(function ConnectPane({ connection, content, tileId, onClose }: IConnectPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { busyChoice, isConnected, connectedLabel } = connection;
  const busy = !!busyChoice;

  // The trigger button is the pane's previous sibling in the toolbar; TileToolbarButton doesn't
  // expose a ref, and the pane has to stay beside the button in the DOM.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  // Opens below the trigger and flips above it when there is no room left below. The room that
  // matters is the visible part of the tile's scroll containers (the document's scroll area). The
  // toolbar is portaled outside that area, so neither the pane's nor the trigger's own ancestors
  // include it; the boundary comes from the tile's ancestors instead. The tile itself clips, but
  // the toolbar sits outside it on purpose, and <body> and <html> are left to the viewport check.
  const tileElement = useTileToolbarTileElement();
  const boundary = useMemo(() => {
    const scrollers = tileElement
      ? getOverflowAncestors(tileElement).filter((a): a is Element =>
          a instanceof Element && a !== document.body && a !== document.documentElement)
      : [];
    return scrollers.length ? scrollers : "clippingAncestors";
  }, [tileElement]);
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(1),
      flip({ fallbackPlacements: ["top-start"], boundary }),
      shift({ boundary })
    ],
    elements: { reference: triggerElement }
  });
  const { setFloating } = refs;
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setFloating(el);
  }, [setFloating]);

  useLayoutEffect(() => {
    setTriggerElement(containerRef.current?.parentElement?.querySelector<HTMLElement>("button.toolbar-button")
      ?? null);
  }, []);

  useEffect(() => {
    // preventScroll: the first render sits at an unpositioned spot, and focus() would scroll to it.
    containerRef.current?.querySelector<HTMLElement>("[role='button']")?.focus({ preventScroll: true });
    // Mount-only: re-running on re-render would yank focus back to the first control.
  }, []);

  // Swapping between the device list and the connected actions unmounts the focused control, which
  // drops focus to <body> where the pane's Escape handler can no longer hear it. Track whether the
  // pane holds focus and, if the swap orphaned it, move it to the pane's first control.
  const holdsFocus = useRef(false);
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const active = document.activeElement;
    if (holdsFocus.current && (!active || active === document.body)) {
      containerRef.current?.querySelector<HTMLElement>("[role='button']")?.focus({ preventScroll: true });
    }
  }, [isConnected]);

  function handleFocus() {
    holdsFocus.current = true;
  }

  // A removed element fires no blur with a relatedTarget, so only a move to an element outside the
  // pane counts as leaving.
  function handleBlur(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && !containerRef.current?.contains(next)) holdsFocus.current = false;
  }

  // Arrow keys and Home/End move focus among the pane's controls, wrapping at the ends. Capture phase
  // is required: the toolbar's focus-trap exit (Escape) is a native capture-phase listener on the
  // toolbar container, and React delegates above it, so only a React capture handler runs first. The
  // arrows are stopped here too, because they would otherwise reach the toolbar's roving tabindex
  // (bubble) and the tile's window-level arrow handling. Tab is left to the toolbar's focus routing.
  // Closing on Escape removes the focused control, so hand focus back to the trigger.
  function handleKeyDownCapture(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      containerRef.current?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button")?.focus();
      onClose();
      return;
    }
    const step = kFocusSteps[e.key];
    if (step === undefined) return;
    e.stopPropagation();
    e.preventDefault();
    const controls = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[role='button']") ?? []);
    if (!controls.length) return;
    const current = controls.indexOf(document.activeElement as HTMLElement);
    const next = step === "first" ? 0
      : step === "last" ? controls.length - 1
      : (current + step + controls.length) % controls.length;
    controls[next].focus({ preventScroll: true });
  }

  // A successful action closes the pane; the trigger's name and color then report the result. A failed
  // or canceled attempt leaves it open. Closing removes the focused control, so if the pane held
  // focus, it moves to the trigger. If the user already closed the pane during a slow attempt,
  // the container is gone and closing again is harmless.
  function closeAfterSuccess() {
    const container = containerRef.current;
    const paneHadFocus = !!container && container.contains(document.activeElement);
    const trigger = container?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button");
    onClose();
    if (paneHadFocus) trigger?.focus();
  }

  const connect = (choice: DeviceChoice) => {
    void connectDeviceForTile({ connection, content, tileId, choice })
      .then(result => { if (result === "connected") closeAfterSuccess(); });
  };
  const reconnect = () => {
    void reconnectDeviceForTile({ connection, content, tileId })
      .then(result => { if (result === "connected") closeAfterSuccess(); });
  };
  const disconnect = () => {
    void disconnectDeviceForTile({ connection, content, tileId }).then(closeAfterSuccess);
  };

  const status = busyChoice
    ? `Connecting to ${kDeviceChoiceLabels[busyChoice]}…`
    : isConnected ? `Connected: ${connectedLabel}` : "Not connected";

  return (
    <div ref={setContainer} className="toolbar-palette dataflow-connect-pane" style={floatingStyles}
        role="group" aria-label={kPaneLabel} onKeyDownCapture={handleKeyDownCapture}
        onFocus={handleFocus} onBlur={handleBlur}>
      <div className="connect-heading">{kPaneLabel}</div>
      <div className="connect-status" role="status">
        <div className="connect-status-line">{status}</div>
        {!isConnected && content.connectError &&
          <div className="connect-error">{content.connectError}</div>}
      </div>
      {isConnected
        ? <div className="connect-actions">
            <PaneControl label="Reconnect" text="Reconnect" busy={busy} onActivate={reconnect} />
            <PaneControl label="Disconnect" text="Disconnect" busy={busy} onActivate={disconnect} />
          </div>
        : <div className="connect-devices">
            {kDeviceChoiceOrder.map(choice => (
              <div key={choice} className="connect-device-row">
                <span className="connect-device-label">{kDeviceChoiceLabels[choice]}</span>
                <PaneControl label={`Connect ${kDeviceChoiceLabels[choice]}`} text="Connect" busy={busy}
                    onActivate={() => connect(choice)} />
              </div>
            ))}
          </div>}
    </div>
  );
});

export const ConnectDeviceButton = observer(function ConnectDeviceButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = model?.content as DataflowContentModelType | undefined;
  const { serialDevice } = useStores();
  const readOnly = useReadOnlyContext();
  const connection = getDeviceConnection(serialDevice);
  const isOpen = !!content?.connectPaneOpen;

  // Deselecting the tile unmounts the toolbar; the model volatile would otherwise stay open.
  useEffect(() => () => content?.setConnectPaneOpen(false), [content]);

  // Clicking anywhere outside the trigger or the pane closes it (capture phase, so a click that
  // something else swallows still closes it).
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(".toolbar-button.connect, .dataflow-connect-pane")) return;
      // Closing unmounts the focused control; hand focus back to the trigger so it doesn't fall to <body>.
      const focusedPane = document.activeElement?.closest(".dataflow-connect-pane");
      focusedPane?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button")?.focus();
      content?.setConnectPaneOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, content]);

  const stateInput = {
    connected: connection.isConnected,
    needsDevice: !!content?.needsDevice,
    unseenError: !!content?.unseenConnectError
  };
  const state = connectButtonState(stateInput);
  const title = connectButtonTooltip({ ...stateInput, connectedLabel: connection.connectedLabel });

  const pane = isOpen && content && model
    ? <ConnectPane connection={connection} content={content} tileId={model.id}
        onClose={() => content.setConnectPaneOpen(false)} />
    : undefined;

  return (
    <TileToolbarButton name={name} title={title} colorClass={`connect-${state}`}
        dataTestId="connect-device-button" disabled={readOnly || !content}
        disabledMessage="Connecting a device isn't available in a read-only view"
        onClick={() => content?.setConnectPaneOpen(!isOpen)} extraContent={pane}>
      <ConnectIcon />
    </TileToolbarButton>
  );
});
