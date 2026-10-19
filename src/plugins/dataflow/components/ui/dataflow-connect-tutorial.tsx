import React from "react";
import { observer } from "mobx-react";

import { DataflowContentModelType } from "../../model/dataflow-content";
import { DeviceConnection } from "../../model/device-connection";

import "./dataflow-connect-tutorial.scss";

const kTitleId = "dataflow-connect-tutorial-title";

interface IDialogProps {
  onDismiss: () => void;
}

/**
 * A dialog drawn over its own tile that tells the student the program needs a real device.
 * It doesn't move focus on mount, because several tiles may show it at once.
 */
export const DataflowConnectTutorial: React.FC<IDialogProps> = ({ onDismiss }) => {
  return (
    <div className="dataflow-connect-tutorial">
      <div className="dataflow-connect-tutorial-box" role="dialog" aria-labelledby={kTitleId}>
        <h3 className="dataflow-connect-tutorial-title" id={kTitleId}>This program uses a real device</h3>
        <p className="dataflow-connect-tutorial-body">
          Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the flashing
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
 * Shows the tutorial on an editable tile whose program needed a device when it opened, while no
 * device is connected and nobody has dismissed it yet.
 */
export const DataflowConnectTutorialGate: React.FC<IGateProps> = observer(function DataflowConnectTutorialGate(
  { content, connection, readOnly, onDismiss }
) {
  const show = !readOnly && content.showConnectTutorialOnOpen
    && !connection.isConnected && !connection.connectTutorialDismissed;
  return show ? <DataflowConnectTutorial onDismiss={onDismiss} /> : null;
});
