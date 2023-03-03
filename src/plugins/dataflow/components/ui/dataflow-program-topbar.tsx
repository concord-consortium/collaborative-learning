import React, { useState } from "react";
import classNames from "classnames";
import { ProgramDataRate } from "../../model/utilities/node";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";

import "./dataflow-program-topbar.scss";

interface TopbarProps {
  programDataRates: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  onSerialRefreshDevices: () => void;
  readOnly: boolean;
  showRateUI: boolean;
  lastIntervalDuration: number;
  serialDevice: SerialDevice;
  onRecordDataChange: (program: any) => void; //change this to have modes?
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates,
    dataRate, onRateSelectClick, onRecordDataChange } = props;
  // Of the boards tested, only authentic Arduinos (usbProductId === 67) raise the browser `connect` event
  // Which we use to track physical connection independently of port state
  // So we only warn of a lack of physical connection when using an known board
  const knownBoard = serialDevice.deviceInfo?.usbProductId === 67;
  const lastMsg = localStorage.getItem("last-connect-message");
  const classes = classNames(
    "icon-serial",
    { "physical-connection": lastMsg === "connect"},
    { "no-physical-connection": lastMsg === "disconnect" && knownBoard},
    serialDevice.serialNodesCount > 0 ? "nodes-in-need" : "no-serial-needed",
    serialDevice.hasPort() ? "has-port" : "no-port"
  );

  function serialMessage(){
    // nodes that use serial, but no device physically connected
    if (lastMsg !== "connect" && serialDevice.serialNodesCount > 0){
      return knownBoard ? "connect a device" : "";
    }
    // physical connection has been made but user action needed
    if (lastMsg === "connect"
        && !serialDevice.hasPort()
        && serialDevice.serialNodesCount > 0
    ){
      return "click to finish connecting";
    }
    else {
      return "";
    }
  }

  return (
    <div className="program-editor-topbar">
      <div className="topbar-left">
        {<IconButton
          icon="serial"
          key="serial"
          onClickButton={onSerialRefreshDevices}
          title="Refresh Serial Connection"
          disabled={readOnly}
          className={classes}
        />}
        <div className="serial-message">
          { serialMessage() }
        </div>
      </div>
      <div className="topbar-center">
        <RateSelectorComponent
          rateOptions={programDataRates}
          dataRate={dataRate}
          onRateSelectClick={onRateSelectClick}
          readOnly={readOnly}
        />
        <RecordDataButton
          onRecordDataChange={onRecordDataChange}
        />
      </div>
      <div className="topbar-right">
        {props.showRateUI && <span className={"rate-ui"}>{`${props.lastIntervalDuration}ms`}</span>}
      </div>
    </div>
  );
};

interface IRateSelectorProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  readOnly: boolean;
}

const RateSelectorComponent = (props: IRateSelectorProps) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onRateSelectClick(Number(event.target.value));
  };
  return (
    <div className="datarate" title="Set Program Sampling Rate">
      <div className="label-back">
        <label className="label" htmlFor="rate-select">Sampling Rate</label>
      </div>
      <div className="datarate-options-back">
        <div className="datarate-options">
          <select onChange={handleSelectChange}
            disabled={props.readOnly}
            value={props.dataRate.toString()}
            id="rate-select" // TODO: The id needs to be unique to the particular DF tile
          >
            { props.rateOptions.map((rate: ProgramDataRate) => (
              <option key={rate.text} value={rate.val} disabled={rate.disabled}>
                {rate.text}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};


enum Mode {
  "Record Data",
  "Stop",
  "Clear Data"
}

interface IRecordDataProps {
  onRecordDataChange: (program: any) => void; //change this to have modes?
}


const RecordDataButton = (props: IRecordDataProps) => {
  const { onRecordDataChange } = props;

  const [mode, setMode] = useState(0);

  return (
    <div className="record-data-button">
      <button
        onClick={() => onRecordDataChange(mode)}
      >
      {Mode[mode]}
      </button>

    </div>
  );
};
