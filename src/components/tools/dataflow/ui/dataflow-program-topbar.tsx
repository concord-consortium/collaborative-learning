import React from "react";
import { ProgramRunTime } from "../../../../models/tools/dataflow/utilities/node";
import { HTMLSelect } from "@blueprintjs/core";
import { IconButton } from "../../../utilities/icon-button";

import "./dataflow-program-topbar.sass";

interface TopbarProps {
  onRunProgramClick: () => void;
  onStopProgramClick: () => void;
  programRunTimes: ProgramRunTime[];
  programDefaultRunTime: number;
  onProgramTimeSelectClick: (type: number) => void;
  onRefreshDevices: () => void;
  isRunEnabled: boolean;
  runningProgram: boolean;
  remainingTimeInSeconds: number;
  readOnly: boolean;
}

const kProgressWidth = 76;

interface CountdownTimerProps {
  duration: string;
  width: number;
  hours: string;
  minutes: string;
  seconds: string;
}
const CountdownTimerComponent: React.SFC<CountdownTimerProps> = (props: CountdownTimerProps) => {
  return (
    <div className="running-container countdown">
      <div className="total">
        {`Duration: ${props.duration}`}
      </div>
      <div className="remaining">
        <div className="progress-bar" style={{width: props.width.toString() + "px"}}/>
        <div className="progress-time">
        {`${props.hours}:${props.minutes}:${props.seconds}`}
        </div>
      </div>
    </div>
  );
};

interface DurationSelectorProps {
  onRunProgramClick: () => void;
  programRunTimes: ProgramRunTime[];
  programDefaultRunTime: number;
  onProgramTimeSelectClick: (type: number) => void;
  isRunEnabled: boolean;
  readOnly: boolean;
}

const DurationSelectorComponent: React.SFC<DurationSelectorProps> = (props: DurationSelectorProps) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onProgramTimeSelectClick(Number(event.target.value));
  };
  return (
    <div className="running-container">
      <div className="duration" title="Set Program Duration">
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
                <option key={rt.text} value={rt.val} disabled={rt.disabled}>
                  {rt.text}
                </option>
              ))
            }
          </HTMLSelect>
        </div>
      </div>
      <button
        className="program-state-button"
        title="Run Program"
        onClick={props.onRunProgramClick}
        disabled={!props.isRunEnabled || props.readOnly}
      >
        <div className="icon run" />
        <div className="text">Run</div>
      </button>
    </div>
  );
};

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const runTime = props.programRunTimes.find( (rt: ProgramRunTime) => rt.val === props.programDefaultRunTime );
  const remainingHours = Math.floor(props.remainingTimeInSeconds / 3600);
  const remainingMinutes = Math.floor((props.remainingTimeInSeconds - remainingHours * 3600) / 60);
  const remainingSeconds = (props.remainingTimeInSeconds - (remainingHours * 3600) - (remainingMinutes * 60) ) % 60;
  const completedTimeInSeconds = props.programDefaultRunTime - props.remainingTimeInSeconds;
  const progressWidth = (kProgressWidth * completedTimeInSeconds / props.programDefaultRunTime);
  const hoursString = String(remainingHours).padStart(2, "0");
  const minutesString = String(remainingMinutes).padStart(2, "0");
  const secondsString = String(remainingSeconds).padStart(2, "0");
  return (
    <div className="program-editor-topbar">
      <div className="refresh">
        <IconButton icon="refresh" key="refresh" className={"icon-refresh"}
                  onClickButton={props.onRefreshDevices} title="Refresh Devices" />
      </div>
      { props.runningProgram
        ? <CountdownTimerComponent
            duration={runTime ? runTime.text.toString() : ""}
            width={progressWidth}
            hours={hoursString}
            minutes={minutesString}
            seconds={secondsString}
            />
        : <DurationSelectorComponent
            onRunProgramClick={props.onRunProgramClick}
            programRunTimes={props.programRunTimes}
            programDefaultRunTime={props.programDefaultRunTime}
            onProgramTimeSelectClick={props.onProgramTimeSelectClick}
            isRunEnabled={props.isRunEnabled}
            readOnly={props.readOnly}
          />
      }
      <button
        className="program-state-button"
        title="Stop Program"
        onClick={props.onStopProgramClick}
        disabled={!props.runningProgram || !props.readOnly}
      >
        <div className="icon stop" />
        <div className="text">Stop</div>
      </button>
    </div>
  );

};
