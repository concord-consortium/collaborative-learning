import React, { useState } from "react";
import { RateSelectorOrPlayBack } from "./dataflow-rateselector-playback";
import { ProgramDataRate } from "../../model/utilities/node";
import { SerialDevice } from "../../../../models/stores/serial";
import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import PlayIcon from "../../assets/topbar-buttons/play-icon.svg";
import PauseIcon from "../../assets/topbar-buttons/pause-icon.svg";
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
  isPlaying: boolean;
  handleChangeIsPlaying: () => void;
  // playBackIndex: number | null;
  numNodes: number;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates, dataRate, onRateSelectClick,
          onRecordDataChange, programRecordState, isPlaying, handleChangeIsPlaying, numNodes } = props;

  const disableRecordButton = readOnly && programRecordState === 0; //hides RecordButton on leftside read only docs
  //create a piece of state
  const [playBackReset, setPlayBackReset] = useState(false);

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
              <PlaybackButton
                isPlaying={isPlaying}
                handleChangeIsPlaying={handleChangeIsPlaying}
                programRecordState={programRecordState}
              />
            }
          </div>
          <RateSelectorOrPlayBack
            rateOptions={programDataRates}
            dataRate={dataRate}
            onRateSelectClick={onRateSelectClick}
            readOnly={readOnly}
            programRecordState={programRecordState}
            isPlaying={isPlaying}
            handleChangeIsPlaying={handleChangeIsPlaying}
            numNodes={numNodes}
            onRecordDataChange={onRecordDataChange}
          />
          <RecordStopOrClearButton
            disabled={disableRecordButton}
            programRecordState={programRecordState}
            onRecordDataChange={onRecordDataChange}
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
  onRecordDataChange: (program: any) => void;
  programRecordState: number;
}

const RecordStopOrClearButton = (props: IRecordStopOrClearProps) => {
  const { disabled, onRecordDataChange, programRecordState } = props;
  if (programRecordState === 2){ //stop button pressed
  }
  return (
    <div className="record-btn-container">
      <button
        className="record-data-btn"
        onClick={onRecordDataChange}
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
  isPlaying: boolean;
  handleChangeIsPlaying: () => void;
}

const PlaybackButton = (props: IPlaybackProps) => {
  const {programRecordState, isPlaying, handleChangeIsPlaying} = props;
  return (
    <div className="playback-btn-container">
      <button
        className="playback-data-btn"
        disabled={programRecordState === 1}
        onClick={handleChangeIsPlaying}
      >
        <div className="playback-data-icon">
          {isPlaying ? <PauseIcon/> : <PlayIcon/>}
        </div>
        <div className="playback-data-txt">
          { isPlaying ? "Pause" : "Play"}
        </div>
      </button>
    </div>
  );
};
