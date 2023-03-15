import React, { useEffect, useRef, useState } from "react";
import Slider from "rc-slider";
import classNames from "classnames";
import { ProgramDataRate } from "../../model/utilities/node";
import { IconButton } from "../../../../components/utilities/icon-button";
import { SerialDevice } from "../../../../models/stores/serial";
import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import PlayIcon from "../../assets/topbar-buttons/play-icon.svg";
import ClearIcon from "../../assets/topbar-buttons/clear-icon.svg";

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
  programRecordState: number;
  numNodes: number;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const { onSerialRefreshDevices, readOnly, serialDevice, programDataRates,
    dataRate, onRateSelectClick, onRecordDataChange, programRecordState, numNodes } = props;
    // console.log("<DataflowProgramToolbar> \n with props", props);

  const [finished, setFinished] = useState(false);
  const handleFinished = (isFinished: boolean) => isFinished && setFinished(true);



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

        <div className="topbar-center-container">
          <div className="topbar-blank-or-play">
            {
              (programRecordState === 1) && <PlaybackButton/>
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
            finished={finished}
            handleFinished={handleFinished}
          />
          <RecordStopOrClearButton
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

/* ==[ Sampling Rate Selector ] == */
interface IRateSelectorProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  readOnly: boolean;
  programRecordState: number;
  numNodes: number
  finished: boolean;
  handleFinished: (isFinished: boolean)=> void;
  onRecordDataChange: (program: any) => void; //when timer reaches end, we set programRecordState = false

}

const RateSelectorOrPlayBack = (props: IRateSelectorProps) => {
  // console.log("<RateSelectorComponent with props:", props);
  const { onRateSelectClick, readOnly, dataRate, rateOptions, programRecordState, numNodes,
         finished, handleFinished, onRecordDataChange} = props;

  const [counter, setCounter] = useState(0); //seconds that have passed after hitting Record
  const totalRecordingTimeSec = Math.floor((dataRate / 1000) * (totalSamples/numNodes));
  const totalRecordingTimeMin = totalRecordingTimeSec / 60;
  console.log("totalRecordingTimeMin:", totalRecordingTimeMin);



  const startTimer = numNodes > 0 && counter < totalRecordingTimeSec;
  // if(counter >= totalRecordingTimeSec && !finished){ //new
  if(counter >= totalRecordingTimeSec){ //new
    // console.log("this should only run once");
    // onRecordDataChange(false);
    handleFinished(true);
  }


  useEffect(()=>{
    const timer = setInterval(() => {
      startTimer && setCounter(counter + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [counter, startTimer]);

  const railRef = useRef<HTMLDivElement>(null);

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
              max={totalRecordingTimeSec}
              step={1}
              value={counter}
              ref={railRef}
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
            </select> :
            numNodes > 0 &&
            <div className="countdown-timer">
             {`${counter}/ ${totalRecordingTimeSec}`}
            </div>
          }

        </div>
      </div>
    </>
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
  buttonClickHandler: (program: any) => void;
  programRecordState: number;
}

const RecordStopOrClearButton = (props: IRecordStopOrClearProps) => {
  //function being passed in is changing the programRecordState
  //but the click handler should clear data
  const { buttonClickHandler, programRecordState } = props;

  return (
    <div className="record-btn-container">
      <button
        className="record-data-btn"
        onClick={buttonClickHandler}
        //**if this button is clear at the very end and you click it you'll update programRecord
        // to false but you also need to update finished */
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

const PlaybackButton = () => {
  return (
    <div className="playback-btn-container">
      <button
        className="playback-data-btn"
      >
      <div className="playback-data-icon">
        <PlayIcon/>
      </div>
      Play
      </button>
    </div>
  );
};





