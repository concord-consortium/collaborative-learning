import React from "react";
import { observer } from "mobx-react";

import { DataflowContentModelType } from "../../model/dataflow-content";
import { UIModelType } from "../../../../models/stores/ui";
import { DeviceConnection } from "../../model/device-connection";

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
  connection.dismissConnectTutorial();
  ui.setSelectedTileId(tileId, { readOnly });
  if (focusWasInDialog) tileElt?.focus();
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
  return (
    <div className="dataflow-connect-tutorial">
      <div className="dataflow-connect-tutorial-box" role="dialog"
        aria-labelledby={titleId} aria-describedby={bodyId}>
        <h3 className="dataflow-connect-tutorial-title" id={titleId}>This program needs a real device</h3>
        <p className="dataflow-connect-tutorial-body" id={bodyId}>
          Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the {connectInToolbar
            ? <>yellow ⚡ Connect button in this tile&apos;s toolbar</>
            : <>⚡ button at the top of this tile</>} and choose your device.
        </p>
        <button className="dataflow-connect-tutorial-ok" onClick={onDismiss}>OK</button>
      </div>
    </div>
  );
};

interface IGateProps {
  content: DataflowContentModelType;
  connection: DeviceConnection;
  readOnly?: boolean;
  connectInToolbar?: boolean;
  onDismiss: () => void;
}

/**
 * Shows the tutorial on an editable tile whose program needed a device when it opened, until it is
 * dismissed (by OK on any tile, or by any connection). `connectTutorialDismissed` is the one
 * source: DeviceConnection sets it whenever a device is connected, so no separate check is needed.
 */
export const DataflowConnectTutorialGate: React.FC<IGateProps> = observer(function DataflowConnectTutorialGate(
  { content, connection, readOnly, connectInToolbar, onDismiss }
) {
  const show = !readOnly && content.showConnectTutorialOnOpen && !connection.connectTutorialDismissed;
  return show ? <DataflowConnectTutorial connectInToolbar={connectInToolbar} onDismiss={onDismiss} /> : null;
});
