import React, { useRef } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { ProgramDataRate } from "../../model/utilities/node";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";
import RecordIcon from "../../assets/topbar-buttons/record-icon.png";
import StopIcon from "../../assets/topbar-buttons/stop-icon.png";
import PlayIcon from "../../assets/topbar-buttons/play-icon.png";

import "./dataflow-program-topbar.scss";

const totalSamples = 10000;

interface TopbarProps {
  programDataRates: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  onSerialRefreshDevices: () => void;
  readOnly: boolean;
  showRateUI: boolean;
  lastIntervalDuration: number;
  serialDevice: SerialDevice;
  onRecordDataChange: (program: any) => void;
  programRecordState: boolean;
  numNodes: number;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates,
    dataRate, onRateSelectClick, onRecordDataChange, programRecordState, numNodes } = props;
    // console.log("<DataflowProgramToolbar> \n with props", props);

    // console.log("<DataflowProgramToolbar> \n with dataRate", dataRate);
    console.log("<DataflowProgramToolbar> \n with  numNodes", numNodes);

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
      <div className="topbar-icon">
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

      <div className="topbar-blank-or-play">
        {
          programRecordState && <PlaybackButton/>
        }
      </div>
      <RateSelectorOrPlayBack
        rateOptions={programDataRates}
        dataRate={dataRate}
        onRateSelectClick={onRateSelectClick}
        readOnly={readOnly}
        programRecordState={programRecordState}
        numNodes={numNodes}
      />

      <RecordOrStopButton
        programRecordState={programRecordState}
        onRecordDataChange={onRecordDataChange}
      />
      <div className="topbar-right">
        {props.showRateUI && <span className={"rate-ui"}>{`${props.lastIntervalDuration}ms`}</span>}
      </div>
      <div className="topbar-json">
      </div>
    </div>
  );
};

/* ==[ Sampling Rate Selector ] == */
interface IRateSelectorProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  readOnly: boolean;
  programRecordState: boolean;
  numNodes: number
}

const RateSelectorOrPlayBack = (props: IRateSelectorProps) => {

  // console.log("<RateSelectorComponent with props:", props);
  const { onRateSelectClick, readOnly, dataRate, rateOptions, programRecordState, numNodes} = props;

  const railRef = useRef<HTMLDivElement>(null);
  const totalRecordingTimeSec = (dataRate / 1000) * (totalSamples/numNodes);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onRateSelectClick(Number(event.target.value));
  };
  return (
    <>
      <div className="topbar-sampleratetext-or-timeslider">
        {
          programRecordState ?
          <div className="slider-container">
            <Slider
              min={0}
              max={20}
              step={1}
              value={5}
              ref={railRef}
              // className={`${activeNavTab}`}
              // onChange={handleSliderValueChange}
              // onAfterChange={handleSliderAfterChange}
            />
          </div>
          :
          <label className="samplerate-label" htmlFor="rate-select">Sampling Rate</label>
        }
      </div>

      <div className="topbar-datarate-or-timer">
        <div className="datarate-options">
          {
            !programRecordState ?
            <select onChange={handleSelectChange}
              disabled={readOnly}
              value={dataRate.toString()}
              id="rate-select" // TODO: The id needs to be unique to the particular DF tile
            >
              {
                rateOptions.map((rate: ProgramDataRate) => (
                <option key={rate.text} value={rate.val} disabled={rate.disabled}>
                  {rate.text}
                </option>
                ))
              }
            </select> : `sec recorded / ${totalRecordingTimeSec}`
          }

        </div>
      </div>
    </>
  );
};



/* ==[ Record Data Button ] == */
interface IRecordOrStopProps {
  onRecordDataChange: (program: any) => void; //change this to have modes?
  programRecordState: boolean;

}

const RecordOrStopButton = (props: IRecordOrStopProps) => {
  // console.log("RecordDataButton with props:", props);
  const { onRecordDataChange, programRecordState } = props;


  return (
    <div className="record-btn-container">
      <button
        className="record-data-btn"
        onClick={onRecordDataChange}
      >
      <div className="record-data-icon">
        {
          programRecordState ?
          <img className="stop-icon-resize" src={StopIcon}/> :
          <img src={RecordIcon}/>
        }
      </div>
      <div className="record-data-txt">
        {programRecordState ? "Stop" : "Record"}
      </div>
      </button>

    </div>
  );
};


/* ==[ Playback Button ] == */

const PlaybackButton = () => {
  return (
    <div className="playback-btn-container">
      <button
        className="playback-data-btn"
      >
      <div className="playback-data-icon">
        <img src={PlayIcon}/>
      </div>
      Play
      </button>
    </div>
  );
};

