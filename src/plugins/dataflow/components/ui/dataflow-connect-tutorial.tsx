import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";

import { DataflowContentModelType } from "../../model/dataflow-content";
import { UIModelType } from "../../../../models/stores/ui";
import { ConnectTutorialDismissal, DeviceConnection } from "../../model/device-connection";
import { LogEventName } from "../../../../lib/logger-types";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";

import "./dataflow-connect-tutorial.scss";

/** The connect tutorial's box inside a tile element, if one is showing. */
export function getConnectTutorialElement(tileElt: HTMLElement | null | undefined) {
  return tileElt?.querySelector<HTMLElement>(".dataflow-connect-tutorial-box") ?? null;
}

interface IAcknowledgeArgs {
  connection: DeviceConnection;
  ui: Pick<UIModelType, "setSelectedTileId">;
  tileId: string;
  readOnly?: boolean;
  tileElt: HTMLElement | null | undefined;
}

/**
 * Acknowledging the tutorial dismisses it on every tile. The tile is selected so its toolbar, with
 * the connect button the tutorial refers to, is showing. The focused OK button unmounts with the
 * tutorial, so focus that was inside it moves to the tile, which Enter re-enters.
 */
export function acknowledgeConnectTutorial({ connection, ui, tileId, readOnly, tileElt }: IAcknowledgeArgs) {
  const focusWasInDialog = !!getConnectTutorialElement(tileElt)?.contains(document.activeElement);
  connection.dismissConnectTutorial({ by: "ok", tileId });
  ui.setSelectedTileId(tileId, { readOnly });
  if (focusWasInDialog) tileElt?.focus();
}

// How a tile's tutorial was dismissed, from that tile's point of view.
function dismissTrigger(dismissal: ConnectTutorialDismissal, tileId: string) {
  if (dismissal.by === "connection") return "connection";
  return dismissal.tileId === tileId ? "ok" : "okInAnotherTile";
}

function logConnectTutorialEvent(tileId: string, operation: string, trigger?: string) {
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: { targetType: "connectTutorial", ...(trigger && { trigger }) }
  });
}

interface IDialogProps {
  // Whether the tile's toolbar has the connect button. A unit whose own tools list leaves it out
  // has the older connect button at the top of the tile instead, which doesn't turn yellow.
  connectInToolbar?: boolean;
  onDismiss: () => void;
}

/**
 * A dialog drawn over its own tile that tells the student the program needs a real device.
 * It doesn't move focus on mount, because several tiles may show it at once.
 */
export const DataflowConnectTutorial: React.FC<IDialogProps> = ({ connectInToolbar = true, onDismiss }) => {
  const id = React.useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  // Screen readers would read the ⚡ as "high voltage".
  const bolt = <span aria-hidden="true">⚡</span>;
  return (
    <div className="dataflow-connect-tutorial">
      <div className="dataflow-connect-tutorial-box" role="dialog"
        aria-labelledby={titleId} aria-describedby={bodyId}>
        <h3 className="dataflow-connect-tutorial-title" id={titleId}>This program needs a real device</h3>
        <p className="dataflow-connect-tutorial-body" id={bodyId}>
          Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the {connectInToolbar
            ? <>yellow {bolt} Connect button in this tile&apos;s toolbar</>
            : <>{bolt} button at the top of this tile</>} and choose your device.
        </p>
        <button className="dataflow-connect-tutorial-ok" onClick={onDismiss}>OK</button>
      </div>
    </div>
  );
};

interface IGateProps {
  content: DataflowContentModelType;
  connection: DeviceConnection;
  tileId: string;
  readOnly?: boolean;
  connectInToolbar?: boolean;
  onDismiss: () => void;
}

/**
 * Shows on an editable tile whose program needed a device when it opened, until
 * `connectTutorialDismissed` (OK on any tile, or any connection). Logs when it shows on this tile and
 * when it is dismissed here, since it blocks the program while it shows.
 */
export const DataflowConnectTutorialGate: React.FC<IGateProps> = observer(function DataflowConnectTutorialGate(
  { content, connection, tileId, readOnly, connectInToolbar, onDismiss }
) {
  const show = !readOnly && content.showConnectTutorialOnOpen && !connection.connectTutorialDismissed;
  const shown = useRef(false);
  useEffect(() => {
    if (show) {
      shown.current = true;
      logConnectTutorialEvent(tileId, "showConnectTutorial");
    } else if (shown.current) {
      shown.current = false;
      const dismissal = connection.connectTutorialDismissal;
      if (dismissal) logConnectTutorialEvent(tileId, "dismissConnectTutorial", dismissTrigger(dismissal, tileId));
    }
  }, [show, connection, tileId]);
  return show ? <DataflowConnectTutorial connectInToolbar={connectInToolbar} onDismiss={onDismiss} /> : null;
});
