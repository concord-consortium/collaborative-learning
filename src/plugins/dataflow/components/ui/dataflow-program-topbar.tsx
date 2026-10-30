import React from "react";
import { observer } from "mobx-react";
import { DataflowSamplingRate } from "./dataflow-sampling-rate";
import { ProgramDataRate } from "../../model/utilities/node";
import { SerialDevice } from "../../../../models/stores/serial";
import { DeviceChoice, DeviceConnection } from "../../model/device-connection";
import { DataflowSerialConnectButton } from "./dataflow-serial-connect-button";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { useSettingFromStores } from "../../../../hooks/use-stores";
import { toolbarShowsConnect } from "../../utilities/connect-button-state";

import "./dataflow-program-topbar.scss";

interface TopbarProps {
  programDataRates: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  onConnectDevice: (choice: DeviceChoice) => void;
  onReconnectDevice: () => void;
  onDisconnectDevice: () => void;
  showRateUI: boolean;
  lastIntervalDuration: number;
  serialDevice: SerialDevice;
  connection: DeviceConnection;
  tileContent: DataflowContentModelType;
}

export const DataflowProgramTopbar = observer(function DataflowProgramTopbar(props: TopbarProps) {
  const { onConnectDevice, onReconnectDevice, onDisconnectDevice, serialDevice, connection,
          programDataRates, dataRate, onRateSelectClick, tileContent } = props;
  // The toolbar's connect button replaces this one. A unit whose own tools list leaves it out keeps
  // this one, so students there can still connect.
  const showConnectButton = !toolbarShowsConnect(useSettingFromStores("tools", "dataflow"));

  return (
    <div className="program-editor-topbar">
        {showConnectButton && <DataflowSerialConnectButton
          onConnectDevice={onConnectDevice}
          onReconnectDevice={onReconnectDevice}
          onDisconnectDevice={onDisconnectDevice}
          serialDevice={serialDevice}
          connection={connection}
          needsDevice={tileContent.needsDevice}
        />}
        <div className="topbar-center-container">
          <DataflowSamplingRate
            rateOptions={programDataRates}
            dataRate={dataRate}
            onRateSelectClick={onRateSelectClick}
            tileContent={tileContent}
          />
        </div>

        <div className="topbar-right">
          {props.showRateUI && <span className={"rate-ui"}>{`${props.lastIntervalDuration}ms`}</span>}
        </div>
    </div>
  );
});
