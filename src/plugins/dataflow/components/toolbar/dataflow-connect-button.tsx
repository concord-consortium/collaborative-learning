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
import { useAnnounce } from "../../../../utilities/use-announce";
import { kStallKinds, problemHeadline } from "../../model/connect-failures";
import { DataflowContentModelType } from "../../model/dataflow-content";
import {
  DeviceChoice, DeviceConnection, getDeviceConnection, kDeviceChoiceLabels, kDeviceChoiceOrder
} from "../../model/device-connection";
import { connectButtonState, connectButtonTooltip } from "../../utilities/connect-button-state";
import { connectionStatusInput, connectPaletteStatus } from "../../utilities/connect-palette-status";
import {
  connectDeviceForTile, disconnectDeviceForTile, reconnectDeviceForTile
} from "../../utilities/device-actions";

import ConnectIcon from "../../assets/icons/connect-icon.svg";

import "./dataflow-connect-palette.scss";

// How long a failure announcement stays in its live region before it is cleared.
const kFailureAnnounceMs = 5000;

// How each navigation key moves focus: by a signed number of controls, or to the first or last one.
const kFocusSteps: Record<string, number | "first" | "last"> = {
  ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: "first", End: "last"
};

// The palette renders as the trigger's sibling (extraContent) inside the Tooltip's wrapper. Closing
// the palette removes the focused control, so each close path hands focus back to the trigger found
// here.
function findTrigger(palette: Element | null | undefined) {
  return palette?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button.connect") ?? null;
}

interface IPaletteControlProps {
  // The accessible name, when the visible text alone doesn't say enough
  label?: string;
  text: string;
  busy: boolean;
  onActivate: () => void;
}

// `div role="button"`, not a real button, for the reason given at PanPalette's arrows
// (dataflow-zoom-pan-buttons.tsx).
function PaletteControl({ label, text, busy, onActivate }: IPaletteControlProps) {
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

interface IConnectPaletteProps {
  connection: DeviceConnection;
  content: DataflowContentModelType;
  tileId: string;
  // The palette that is showing now. A slow attempt can outlive the palette that started it, when
  // the user closes and reopens the palette, so its result reads the live palette from here.
  paletteRef: React.MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}

const ConnectPalette = observer(function ConnectPalette(
    { connection, content, tileId, paletteRef, onClose }: IConnectPaletteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { busyChoice, paletteView, actionsEnabled, check } = connection;
  const busy = !!busyChoice;
  const headingId = useId();

  // TileToolbarButton doesn't expose a ref, and the palette has to stay beside the button in the
  // DOM, so the trigger is found from the palette (findTrigger).
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
    paletteRef.current = el;
    setFloating(el);
  }, [paletteRef, setFloating]);

  useLayoutEffect(() => {
    setTriggerElement(findTrigger(containerRef.current));
  }, []);

  useEffect(() => {
    // preventScroll: the first render sits at an unpositioned spot, and focus() would scroll to it.
    containerRef.current?.querySelector<HTMLElement>("[role='button']")?.focus({ preventScroll: true });
    // Mount-only, as in PanPalette.
  }, []);

  // Swapping the device list for the connected actions, or back, unmounts the focused control and
  // drops focus to <body>. If the palette held focus, move it to the palette's first control.
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
  }, [paletteView]);

  function handleFocus() {
    holdsFocus.current = true;
  }

  // A removed element fires no blur with a relatedTarget, so only a move to an element outside the
  // palette counts as leaving.
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

  // A successful action closes the palette; the trigger's name and color then report the result.
  // The palette may have been closed and reopened during the attempt, so this closes whichever one
  // is showing, and moves focus to the trigger only if that palette held it.
  function closeAfterSuccess() {
    if (!isAlive(content)) return;
    const live = paletteRef.current;
    const paletteHadFocus = !!live && live.contains(document.activeElement);
    const trigger = findTrigger(live);
    onClose();
    if (paletteHadFocus) trigger?.focus();
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

  const { line1, line2, announce } = connectPaletteStatus(connectionStatusInput(connection, content.connectFailure));
  const actionsBusy = busy || !actionsEnabled;

  // Line 2 always renders, empty when there is nothing to say, so the area never changes height.
  // Only a problem goes in the live region; steps and the progress bar are not announced.
  const detail = (
    <div className={classNames("connect-detail", line2?.tone)}>
      {line2?.progress !== undefined &&
        <div className="connect-progress" role="progressbar" aria-label="Firmware update"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={line2.progress}>
          <div className="connect-progress-fill" style={{ width: `${line2.progress}%` }} />
        </div>}
      <span className="connect-detail-text">{line2?.text}</span>
    </div>
  );

  return (
    <div ref={setContainer} className="toolbar-palette dataflow-connect-palette" style={floatingStyles}
        role="group" aria-labelledby={headingId} onKeyDownCapture={handleKeyDownCapture}
        onFocus={handleFocus} onBlur={handleBlur}>
      <div className="connect-heading" id={headingId}>Device connection</div>
      <div className="connect-status">
        <div role="status">
          <div className="connect-status-line">{line1}</div>
          {announce && detail}
        </div>
        {!announce && detail}
      </div>
      {paletteView === "actions"
        ? <div className="connect-actions">
            <PaletteControl text="Reconnect" busy={actionsBusy} onActivate={reconnect} />
            <PaletteControl text="Disconnect" busy={actionsBusy} onActivate={disconnect} />
            {connection.canIdentify &&
              <PaletteControl text="Is it alive?" busy={actionsBusy || check === "checking"}
                  onActivate={() => { void connection.identify(); }} />}
          </div>
        : <div className="connect-devices">
            {kDeviceChoiceOrder.map(choice => (
              <div key={choice} className="connect-device-row">
                <span className="connect-device-label">{kDeviceChoiceLabels[choice]}</span>
                <PaletteControl label={`Connect ${kDeviceChoiceLabels[choice]}`} text="Connect" busy={busy}
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
  const isOpen = !!content?.connectPaletteOpen;
  const paletteRef = useRef<HTMLDivElement | null>(null);

  // Pulses when a device goes away while this toolbar is showing, not for a loss from before it
  // mounted. The class stays until the next connect attempt clears the loss.
  const lossAtMount = useRef(connection.lossAt).current;
  const lossPulse = connection.lossAt !== undefined && connection.lossAt !== lossAtMount;

  // A failure recorded while the palette is closed is announced politely, since nothing on screen
  // is being watched. A failure already unseen at mount was announced, or missed, before this
  // mounted.
  const { announcement, announce } = useAnnounce(kFailureAnnounceMs);
  const failure = content?.connectFailure;
  const unseenError = !!content?.unseenConnectError;
  const announcedFailure = useRef(failure);
  useEffect(() => {
    if (unseenError && failure && failure !== announcedFailure.current) {
      announce(problemHeadline(failure.kind, failure.choice));
      announcedFailure.current = failure;
    }
  }, [unseenError, failure, announce]);

  // Deselecting the tile unmounts the toolbar; the model volatile would otherwise stay open. Deleting
  // the tile destroys the content before this runs.
  useEffect(() => () => {
    if (content && isAlive(content)) content.setConnectPaletteOpen(false);
  }, [content]);

  // Clicking anywhere outside the trigger or the palette closes it, handing focus back to the
  // trigger if the palette held it, as PanButton does for its palette
  // (dataflow-zoom-pan-buttons.tsx).
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(".toolbar-button.connect, .dataflow-connect-palette")) return;
      findTrigger(document.activeElement?.closest(".dataflow-connect-palette"))?.focus();
      content?.setConnectPaletteOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, content]);

  // Failures that no longer count are ignored (see `currentFailure`).
  const lastFailure = connection.currentFailure(connection.lastFailure);
  const staleTileStall = !!failure && !connection.currentFailure(failure);
  const stateInput = {
    connected: connection.isConnected,
    needsDevice: !!content?.needsDevice,
    unseenError: unseenError && !staleTileStall,
    notResponding: connection.notResponding,
    stalled: !!lastFailure && kStallKinds.includes(lastFailure.kind),
    dataReceived: connection.dataReceived
  };
  const attempt = connection.attempt;
  const state = connectButtonState(stateInput);
  const title = connectButtonTooltip({
    ...stateInput,
    connectedLabel: connection.connectedLabel
      ?? (lastFailure ? kDeviceChoiceLabels[lastFailure.choice] : undefined),
    stallKind: lastFailure?.kind,
    lossMessage: connection.lossMessage,
    connecting: attempt && (!attempt.ended || connection.updateResumed)
      ? kDeviceChoiceLabels[attempt.choice] : undefined
  });

  const palette = isOpen && content && model
    ? <ConnectPalette connection={connection} content={content} tileId={model.id} paletteRef={paletteRef}
        onClose={() => content.setConnectPaletteOpen(false)} />
    : undefined;

  // The live region sits beside the palette, not in it, so it exists while the palette is closed.
  // It stays mounted and only its text changes, since a region inserted already holding text is
  // often missed.
  const extraContent = (
    <>
      {palette}
      <span role="status" aria-live="polite" className="visually-hidden">{announcement}</span>
    </>
  );

  return (
    <TileToolbarButton name={name} title={title} expanded={isOpen}
        colorClass={classNames(`connect-${state}`, { "connect-loss-pulse": lossPulse })}
        dataTestId="connect-device-button" disabled={readOnly || !content}
        disabledMessage="Connecting a device isn't available in a read-only view"
        onClick={() => content?.setConnectPaletteOpen(!isOpen)} extraContent={extraContent}>
      <ConnectIcon />
    </TileToolbarButton>
  );
});
