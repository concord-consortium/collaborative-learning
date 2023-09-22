import React from "react";
import { RateSelectorOrPlayBack } from "./dataflow-rateselector-playback";
import { ProgramDataRate } from "../../model/utilities/node";
import { SerialDevice } from "../../../../models/stores/serial";
import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import PlayIcon from "../../assets/topbar-buttons/play-icon.svg";
import PauseIcon from "../../assets/topbar-buttons/pause-icon.svg";
import ClearIcon from "../../assets/topbar-buttons/clear-icon.svg";
import { DataflowSerialConnectButton } from "./dataflow-serial-connect-button";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { ProgramMode } from "../types/dataflow-tile-types";
import { useCautionAlert } from "../../../../components/utilities/use-caution-alert";

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
  handleChangeOfProgramMode: () => void;
  programMode: ProgramMode;
  playBackIndex: number;
  isPlaying: boolean;
  handleChangeIsPlaying: () => void;
  tileContent: DataflowContentModelType;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates, dataRate, onRateSelectClick,
          handleChangeOfProgramMode, programMode, playBackIndex, isPlaying,
          handleChangeIsPlaying, tileContent } = props;

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
              (programMode === ProgramMode.Recording || programMode === ProgramMode.Done) &&
              <PlaybackButton
                isPlaying={isPlaying}
                handleChangeIsPlaying={handleChangeIsPlaying}
                programMode={programMode}
              />
            }
          </div>
          <RateSelectorOrPlayBack
            rateOptions={programDataRates}
            dataRate={dataRate}
            onRateSelectClick={onRateSelectClick}
            readOnly={readOnly}
            programMode={programMode}
            playBackIndex={playBackIndex}
            tileContent={tileContent}
          />
          <RecordStopOrClearButton
            disabled={readOnly}
            programMode={programMode}
            handleChangeOfProgramMode={handleChangeOfProgramMode}
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
  handleChangeOfProgramMode: () => void;
  programMode: number;
}

const RecordStopOrClearButton = (props: IRecordStopOrClearProps) => {

  const { disabled, handleChangeOfProgramMode, programMode } = props;

  /* ==[ Clear Data - Confirmation Modal ] == */
  const AlertContent = () => {
    return (
      <p> Remove the program&#39;s recorded data and any linked displays of this data? This action is not undoable.</p>
    );
  };

  const [showAlert] = useCautionAlert({
    title: "Clear Data",
    content: AlertContent,
    confirmLabel: "Clear",
    onConfirm: handleChangeOfProgramMode
  });

  const onClickHandler = () => {
    if (!disabled && programMode === ProgramMode.Done){
      showAlert();
    }
    else {
      handleChangeOfProgramMode();
    }
  };

  return (
    <div className="record-btn-container">
      <button
        className="record-data-btn"
        onClick={onClickHandler}
        disabled={disabled}
      >
        <div className="record-data-icon">
          {iconArr[programMode]}
        </div>
        <div className="record-data-txt">
          {Mode[programMode]}
        </div>
      </button>
    </div>
  );
};


/* ==[ Playback Button ] == */
interface IPlaybackProps {
  programMode: number;
  isPlaying: boolean;
  handleChangeIsPlaying: () => void;
}

const PlaybackButton = (props: IPlaybackProps) => {
  const { programMode, isPlaying, handleChangeIsPlaying } = props;
  return (
    <div className="playback-btn-container">
      <button
        className="playback-data-btn"
        disabled={programMode === ProgramMode.Recording}
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
