import React, {
  useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState
} from "react";
import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
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

// How long the pulse after a lost device runs: connect-loss-pulse's animation, three 1.5 s cycles.
export const kLossPulseMs = 4500;

// How each navigation key moves focus: by a signed number of controls, or to the first or last one.
const kFocusSteps: Record<string, number | "first" | "last"> = {
  ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: "first", End: "last"
};

// The pane renders as the trigger's sibling (extraContent) inside the Tooltip's wrapper. Closing the
// pane removes the focused control, so each close path hands focus back to the trigger found here.
function findTrigger(pane: Element | null | undefined) {
  return pane?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button.connect") ?? null;
}

interface IPaneControlProps {
  // The accessible name, when the visible text alone doesn't say enough
  label?: string;
  text: string;
  busy: boolean;
  onActivate: () => void;
}

// `div role="button"`, not a real button, for the reason given at PanPalette's arrows
// (dataflow-zoom-pan-buttons.tsx).
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
  // The pane that is showing now. A slow attempt can outlive the pane that started it, when the
  // user closes and reopens the pane, so its result reads the live pane from here.
  paneRef: React.MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}

const ConnectPane = observer(function ConnectPane(
    { connection, content, tileId, paneRef, onClose }: IConnectPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { busyChoice, isConnected, connectedLabel } = connection;
  const busy = !!busyChoice;
  const headingId = useId();

  // TileToolbarButton doesn't expose a ref, and the pane has to stay beside the button in the DOM,
  // so the trigger is found from the pane (findTrigger).
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  // Opens below the trigger, flipping above it when there's no room below. The room is within the
  // tile's scroll ancestors, since the toolbar is portaled outside them. The tile itself isn't one:
  // the toolbar sits outside it on purpose. <body> and <html> are left to the viewport check.
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
    paneRef.current = el;
    setFloating(el);
  }, [paneRef, setFloating]);

  useLayoutEffect(() => {
    setTriggerElement(findTrigger(containerRef.current));
  }, []);

  useEffect(() => {
    // preventScroll: the first render sits at an unpositioned spot, and focus() would scroll to it.
    containerRef.current?.querySelector<HTMLElement>("[role='button']")?.focus({ preventScroll: true });
    // Mount-only, as in PanPalette.
  }, []);

  // Swapping the device list for the connected actions, or back, unmounts the focused control and
  // drops focus to <body>. If the pane held focus, move it to the pane's first control.
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

  // Arrow keys and Home/End move among the controls, wrapping; Tab is left to the toolbar. Capture
  // phase and stopPropagation for the reasons in PanPalette's handleKeyDownCapture.
  function handleKeyDownCapture(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      findTrigger(containerRef.current)?.focus();
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

  // A successful action closes the pane; the trigger's name and color then report the result. The
  // pane may have been closed and reopened during the attempt, so this closes whichever one is
  // showing, and moves focus to the trigger only if that pane held it.
  function closeAfterSuccess() {
    if (!isAlive(content)) return;
    const live = paneRef.current;
    const paneHadFocus = !!live && live.contains(document.activeElement);
    const trigger = findTrigger(live);
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
        role="group" aria-labelledby={headingId} onKeyDownCapture={handleKeyDownCapture}
        onFocus={handleFocus} onBlur={handleBlur}>
      <div className="connect-heading" id={headingId}>Device connection</div>
      <div className="connect-status" role="status">
        <div className="connect-status-line">{status}</div>
        {!isConnected && content.connectError &&
          <div className="connect-error">{content.connectError}</div>}
      </div>
      {isConnected
        ? <div className="connect-actions">
            <PaneControl text="Reconnect" busy={busy} onActivate={reconnect} />
            <PaneControl text="Disconnect" busy={busy} onActivate={disconnect} />
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
  const paneRef = useRef<HTMLDivElement | null>(null);

  // Pulses once when a device is lost while this toolbar is showing. A loss from before it mounted
  // doesn't pulse; the pane still explains it.
  const { lossAt } = connection;
  const seenLossAt = useRef(lossAt);
  const [lossPulse, setLossPulse] = useState(false);
  useEffect(() => {
    if (lossAt === undefined || lossAt === seenLossAt.current) return;
    seenLossAt.current = lossAt;
    setLossPulse(true);
    const timer = setTimeout(() => setLossPulse(false), kLossPulseMs);
    return () => {
      clearTimeout(timer);
      setLossPulse(false);
    };
  }, [lossAt]);

  // Deselecting the tile unmounts the toolbar; the model volatile would otherwise stay open. Deleting
  // the tile destroys the content before this runs.
  useEffect(() => () => {
    if (content && isAlive(content)) content.setConnectPaneOpen(false);
  }, [content]);

  // Clicking anywhere outside the trigger or the pane closes it, handing focus back to the trigger
  // if the pane held it, as PanButton does for its palette (dataflow-zoom-pan-buttons.tsx).
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(".toolbar-button.connect, .dataflow-connect-pane")) return;
      findTrigger(document.activeElement?.closest(".dataflow-connect-pane"))?.focus();
      content?.setConnectPaneOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, content]);

  const stateInput = {
    connected: connection.isConnected,
    needsDevice: !!content?.needsDevice,
    unseenError: !!content?.unseenConnectError,
    notResponding: connection.notResponding
  };
  const state = connectButtonState(stateInput);
  const title = connectButtonTooltip({ ...stateInput, connectedLabel: connection.connectedLabel });

  const pane = isOpen && content && model
    ? <ConnectPane connection={connection} content={content} tileId={model.id} paneRef={paneRef}
        onClose={() => content.setConnectPaneOpen(false)} />
    : undefined;

  return (
    <TileToolbarButton name={name} title={title} expanded={isOpen}
        colorClass={classNames(`connect-${state}`, { "connect-loss-pulse": lossPulse })}
        dataTestId="connect-device-button" disabled={readOnly || !content}
        disabledMessage="Connecting a device isn't available in a read-only view"
        onClick={() => content?.setConnectPaneOpen(!isOpen)} extraContent={pane}>
      <ConnectIcon />
    </TileToolbarButton>
  );
});
