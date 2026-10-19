import React, { useContext, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
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

import SerialIcon from "../../assets/icons/serialconnection/serial.svg";

import "./dataflow-connect-pane.scss";

const kPaneLabel = "Device connection";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const { busyChoice, isConnected, connectedLabel } = connection;
  const busy = !!busyChoice;

  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>("[role='button']")?.focus();
    // Mount-only: re-running on re-render would yank focus back to the first control.
  }, []);

  // Capture phase is required for Escape: the toolbar's focus-trap exit is a native capture-phase
  // listener on the toolbar container, and React delegates above it, so only a React capture
  // handler runs first. Closing removes the focused control, so hand focus back to the trigger.
  function handleKeyDownCapture(e: React.KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    containerRef.current?.parentElement?.querySelector<HTMLButtonElement>("button.toolbar-button")?.focus();
    onClose();
  }

  const connect = (choice: DeviceChoice) => { void connectDeviceForTile({ connection, content, tileId, choice }); };
  const reconnect = () => { void reconnectDeviceForTile({ connection, content, tileId }); };
  const disconnect = () => { void disconnectDeviceForTile({ connection, content, tileId }); };

  const status = busyChoice
    ? `Connecting to ${kDeviceChoiceLabels[busyChoice]}…`
    : isConnected ? `Connected: ${connectedLabel}` : "Not connected";

  return (
    <div ref={containerRef} className="toolbar-palette dataflow-connect-pane"
        role="group" aria-label={kPaneLabel} onKeyDownCapture={handleKeyDownCapture}>
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
        onClick={() => content?.setConnectPaneOpen(!isOpen)} extraContent={pane}>
      <SerialIcon />
    </TileToolbarButton>
  );
});
