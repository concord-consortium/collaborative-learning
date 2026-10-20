import React from "react";
import { observer } from "mobx-react";

import { DataflowContentModelType } from "../../model/dataflow-content";
import { UIModelType } from "../../../../models/stores/ui";
import { DeviceConnection } from "../../model/device-connection";

import "./dataflow-connect-tutorial.scss";

/** The dialog box inside a tile element, if one is showing. */
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
 * the connect button the dialog refers to, is showing. The focused OK button unmounts with the
 * dialog, so focus that was inside it moves to the tile, which Enter re-enters.
 */
export function acknowledgeConnectTutorial({ connection, ui, tileId, readOnly, tileElt }: IAcknowledgeArgs) {
  const focusWasInDialog = !!getConnectTutorialElement(tileElt)?.contains(document.activeElement);
  connection.dismissConnectTutorial();
  ui.setSelectedTileId(tileId, { readOnly });
  if (focusWasInDialog) tileElt?.focus();
}

interface IDialogProps {
  onDismiss: () => void;
}

/**
 * A dialog drawn over its own tile that tells the student the program needs a real device.
 * It doesn't move focus on mount, because several tiles may show it at once.
 */
export const DataflowConnectTutorial: React.FC<IDialogProps> = ({ onDismiss }) => {
  const id = React.useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  return (
    <div className="dataflow-connect-tutorial">
      <div className="dataflow-connect-tutorial-box" role="dialog"
        aria-labelledby={titleId} aria-describedby={bodyId}>
        <h3 className="dataflow-connect-tutorial-title" id={titleId}>This program uses a real device</h3>
        <p className="dataflow-connect-tutorial-body" id={bodyId}>
          Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the yellow
          ⚡ button in this tile&apos;s toolbar and choose your device.
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
  onDismiss: () => void;
}

/**
 * Shows the tutorial on an editable tile whose program needed a device when it opened, until it is
 * dismissed (by OK on any tile, or by any connection). `connectTutorialDismissed` is the one
 * source: DeviceConnection sets it whenever a device is connected, so no separate check is needed.
 */
export const DataflowConnectTutorialGate: React.FC<IGateProps> = observer(function DataflowConnectTutorialGate(
  { content, connection, readOnly, onDismiss }
) {
  const show = !readOnly && content.showConnectTutorialOnOpen && !connection.connectTutorialDismissed;
  return show ? <DataflowConnectTutorial onDismiss={onDismiss} /> : null;
});
