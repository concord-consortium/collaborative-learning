import React from "react";
import { RateSelectorOrPlayBack } from "./dataflow-rateselector-playback";
import { ProgramDataRate } from "../../model/utilities/node";
import { SerialDevice } from "../../../../models/stores/serial";
import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import PlayIcon from "../../assets/topbar-buttons/play-icon.svg";
import ClearIcon from "../../assets/topbar-buttons/clear-icon.svg";
import { DataflowSerialConnectButton } from "./dataflow-serial-connect-button";

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
  onRecordDataChange: () => void;
  programRecordState: number;
  numNodes: number;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates,
    dataRate, onRateSelectClick, onRecordDataChange, programRecordState, numNodes } = props;
  console.log("<dataflow ProgramToolbar> with readOnly", readOnly);

  const disableRecordButton = readOnly && programRecordState === 0; //hides RecordButton on leftside read only docs

  return (
    <div className="program-editor-topbar">

        <DataflowSerialConnectButton
          onSerialRefreshDevices={onSerialRefreshDevices}
          readOnly={readOnly}
          serialDevice={serialDevice}
        />

        <div className="topbar-center-container">
          <div className="topbar-blank-or-play">
            {
              (programRecordState === 1 || programRecordState === 2) &&
              <PlaybackButton programRecordState={programRecordState}/>
            }
          </div>
          <RateSelectorOrPlayBack
            rateOptions={programDataRates}
            dataRate={dataRate}
            onRateSelectClick={onRateSelectClick}
            readOnly={readOnly}
            programRecordState={programRecordState}
            numNodes={numNodes}
            onRecordDataChange={onRecordDataChange}
          />
          <RecordStopOrClearButton
            disabled={disableRecordButton}
            programRecordState={programRecordState}
            buttonClickHandler={onRecordDataChange}
          />
        </div>

        <div className="topbar-right">
          {props.showRateUI && <span className={"rate-ui"}>{`${props.lastIntervalDuration}ms`}</span>}
        </div>

    </div>
  );
};

/* ==[ Record Data Button ] == */
enum Mode { //button text
  "Record",
  "Stop",
  "Clear"
}
const iconArr = [ //button icon
  <RecordIcon key={`recordIconKey`}/>,
  <StopIcon key={`stopIconKey`}/>,
  <ClearIcon key={`clearIconKey`}/>
];

interface IRecordStopOrClearProps {
  disabled: boolean;
  buttonClickHandler: (program: any) => void;
  programRecordState: number;
}

const RecordStopOrClearButton = (props: IRecordStopOrClearProps) => {
  const { disabled, buttonClickHandler, programRecordState } = props;
  return (
    <div className="record-btn-container">
      <button
        className="record-data-btn"
        onClick={buttonClickHandler}
        disabled={disabled}
      >
        <div className="record-data-icon">
          {iconArr[programRecordState]}
        </div>
        <div className="record-data-txt">
          {Mode[programRecordState]}
        </div>
      </button>
    </div>
  );
};


/* ==[ Playback Button ] == */
interface IPlaybackProps {
  programRecordState: number;
}

const PlaybackButton = (props: IPlaybackProps) => {
  const {programRecordState} = props;

  return (
    <div className="playback-btn-container">
      <button
        className="playback-data-btn"
        disabled={programRecordState === 1}
      >
        <div className="playback-data-icon">
          <PlayIcon/>
        </div>
        <div className="playback-data-txt">
          Play
        </div>
      </button>
    </div>
  );
};
