import * as React from "react";
import { ProgramRunTime } from "../utilities/node";
import { HTMLSelect } from "@blueprintjs/core";

import "./dataflow-program-topbar.sass";

interface TopbarProps {
  onRunProgramClick: () => void;
  onStopProgramClick: () => void;
  programRunTimes: ProgramRunTime[];
  programDefaultRunTime: number;
  onProgramTimeSelectClick: (type: number) => void;
  isRunEnabled: boolean;
  runningProgram: boolean;
  remainingTime: number;
  readOnly: boolean;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onProgramTimeSelectClick(Number(event.target.value));
  };
  const runTime = props.programRunTimes.find( (rt: ProgramRunTime) => rt.val === props.programDefaultRunTime );
  const remainingHours = Math.floor(props.remainingTime / 3600);
  const remainingMinutes = Math.floor((props.remainingTime - remainingHours * 3600) / 60);
  const remainingSeconds = (props.remainingTime - (remainingHours * 3600) - (remainingMinutes * 60) ) % 60;
  const progressWidth = (76 * props.remainingTime / props.programDefaultRunTime).toString() + "px";
  const hoursString = String(remainingHours).padStart(2, "0");
  const minutesString = String(remainingMinutes).padStart(2, "0");
  const secondsString = String(remainingSeconds).padStart(2, "0");
  return (
    <div className="program-editor-topbar">
      { props.runningProgram
        ? <div className="running-container countdown">
            <div className="total">
              {`Duration: ${runTime?.text.toString()}`}
            </div>
            <div className="remaining">
              <div className="progress-bar" style={{width: progressWidth}}/>
              <div className="progress-time">
              {`${hoursString}:${minutesString}:${secondsString}`}
              </div>
            </div>
          </div>
        : <div className="running-container">
            <div className="duration" title="Duration">
              <div className="label-back">
                <div className="label">Duration</div>
              </div>
              <div className="duration-options-back">
                <HTMLSelect className="duration-options"
                  onChange={handleSelectChange}
                  disabled={!props.isRunEnabled || props.readOnly}
                  value={props.programDefaultRunTime.toString()}
                >
                  { props.programRunTimes.map((rt: ProgramRunTime) => (
                      <option key={rt.text} value={rt.val}>
                        {rt.text}
                      </option>
                    ))
                  }
                </HTMLSelect>
              </div>
            </div>
            <button
              className="program-state-button"
              title="Run"
              onClick={props.onRunProgramClick}
              disabled={!props.isRunEnabled || props.readOnly}
            >
              <div className="icon run" />
              <div className="text">Run</div>
            </button>
          </div>
      }
      <button
        className="program-state-button"
        title="Stop"
        onClick={props.onStopProgramClick}
        disabled={!props.runningProgram || !props.readOnly}
      >
        <div className="icon stop" />
        <div className="text">Stop</div>
      </button>
    </div>
  );

};
