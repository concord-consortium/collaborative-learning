import React, { useRef } from "react";
import Slider from "rc-slider";
import { observer } from "mobx-react";
import { ProgramDataRate } from "../../model/utilities/node";
import { DataflowContentModelType, formatTime } from "../../model/dataflow-content";
import { ProgramMode } from "../types/dataflow-tile-types";

import "./dataflow-rateselector-playback.scss";

/* ==[ Sampling Rate Selector ] == */
interface IRateSelectorProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  readOnly: boolean;
  programMode: number;
  playBackIndex: number;
  tileContent: DataflowContentModelType;
}

export const RateSelectorOrPlayBack = observer(function RateSelectorOrPlayBack(props: IRateSelectorProps) {
  const { onRateSelectClick, readOnly, dataRate, rateOptions, programMode, playBackIndex,
          tileContent } = props;

  /* Max Recording Duration: */
  const maxRecordingDuration = Math.floor((dataRate / 1000) * tileContent.maxRecordableCases);
  const maxRecordingDurationFormatted = formatTime(maxRecordingDuration);

  const { durationOfRecording: lengthOfRecording } = tileContent;

  /* Playback Time based on playBackIndex */
  const playBackTime = tileContent.getTimeAtRecordedIndex(playBackIndex);
  const playBackFormattedTime = formatTime(playBackTime);

  /* ==[ Timer - Enable ] == */
  const isRecording = programMode === ProgramMode.Recording;

  const sliderMaxValue = isRecording ? maxRecordingDuration: lengthOfRecording;
  const sliderSec = isRecording ? lengthOfRecording : playBackTime;

  const railRef = useRef<HTMLDivElement>(null);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onRateSelectClick(Number(event.target.value));
  };

  return (
    <>
      <div className="topbar-sampleratetext-or-timeslider">
        {
          programMode ?
          <div className="slider-container">
            <Slider
              min={0}
              max={sliderMaxValue}
              step={1}
              value={sliderSec}
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
            !programMode ?
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
            <div className="countdown-timer">
              {
                programMode === ProgramMode.Recording
                  ? `${tileContent.durationOfRecordingFormatted} / ${maxRecordingDurationFormatted}`
                  : `${playBackFormattedTime} / ${tileContent.durationOfRecordingFormatted}`
              }
            </div>
          }
        </div>
      </div>
    </>
  );
});
