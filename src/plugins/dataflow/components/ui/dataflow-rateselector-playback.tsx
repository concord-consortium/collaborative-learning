import React, { useEffect, useRef } from "react";
import Slider from "rc-slider";
import { ProgramDataRate } from "../../model/utilities/node";

import "./dataflow-rateselector-playback.scss";

const totalSamples = 10000;

/* ==[ Sampling Rate Selector ] == */
interface IRateSelectorProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  readOnly: boolean;
  programRecordState: number;
  numNodes: number;
  onRecordDataChange: () => void;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const formattedMinutes = minutes.toString().padStart(3, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
}

export const RateSelectorOrPlayBack = (props: IRateSelectorProps) => {
  const { onRateSelectClick, readOnly, dataRate, rateOptions, programRecordState,
          numNodes, onRecordDataChange} = props;

  /* ==[ Total Recording Time  - Calculate] format as "MMM:SS" */
  const totalTimeSec = Math.floor((dataRate / 1000) * (totalSamples/numNodes));
  const totalTimeFormatted = formatTime(totalTimeSec);

  /* ==[ Timer Recording Time  - Calculate] format as "MMM:SS" */
  const timerMin = useRef(0);
  const sliderSec = useRef(0); //this does not wrap around 60 and is used for the slider/total seconds
  const timerSec = useRef(0); //seconds that have passed after hitting Record
  const formattedMin = timerMin.current.toString().padStart(3, "0");
  const formattedSec = timerSec.current.toString().padStart(2, "0");
  const formattedTime = `${formattedMin}:${formattedSec}`;

  /* ==[ Timer - Enable ] == */
  const startTimer = numNodes > 0 && sliderSec.current < totalTimeSec && (programRecordState === 1);

  useEffect(()=>{
    if (startTimer){
      const timer = setInterval(() => {
        startTimer && timerSec.current++;
        startTimer && sliderSec.current++;
        if (timerSec.current === 60){
          timerMin.current++;
          timerSec.current = 0;
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timerSec, startTimer, sliderSec]);

  /* ==[ Timer - Reset ] == */
  if (programRecordState === 0) {
    timerSec.current = 0;
    timerMin.current = 0;
    sliderSec.current = 0;
  }

  if(sliderSec.current === totalTimeSec && programRecordState === 1){
    onRecordDataChange();
  }

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
              max={totalTimeSec}
              step={1}
              value={sliderSec.current}
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
             {`${formattedTime} / ${totalTimeFormatted}`}
            </div>
          }

        </div>
      </div>
    </>
  );
};
