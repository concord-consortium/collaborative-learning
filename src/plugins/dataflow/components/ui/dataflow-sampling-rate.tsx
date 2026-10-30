import React from "react";
import { observer } from "mobx-react";
import { ProgramDataRate } from "../../model/utilities/node";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";

import "./dataflow-sampling-rate.scss";

interface ISamplingRateProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  tileContent: DataflowContentModelType;
}

/**
 * The rate stays visible but disabled during a run, so a student can still see what they are
 * recording at.
 */
export const DataflowSamplingRate = observer(function DataflowSamplingRate(props: ISamplingRateProps) {
  const { onRateSelectClick, dataRate, rateOptions, tileContent } = props;
  const readOnly = useReadOnlyContext();
  const recording = tileContent.isRecording;

  return (
    <>
      <div className="topbar-sampleratetext">
        <label className="samplerate-label" htmlFor="rate-select">Sampling Rate</label>
      </div>
      <div className="topbar-datarate">
        <select
          onChange={e => onRateSelectClick(Number(e.target.value))}
          disabled={readOnly || recording}
          value={dataRate.toString()}
          id="rate-select" // TODO: The id needs to be unique to the particular DF tile
          data-testid="rate-select"
        >
          {rateOptions.map((rate: ProgramDataRate) => (
            <option key={rate.text} value={rate.val} disabled={rate.disabled}>{rate.text}</option>
          ))}
        </select>
      </div>
      {recording &&
        <div className="recording-elapsed" data-testid="recording-elapsed">
          {tileContent.durationOfRecordingFormatted}
        </div>}
    </>
  );
});
