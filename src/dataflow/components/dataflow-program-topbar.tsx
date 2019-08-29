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
  readOnly: boolean;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onProgramTimeSelectClick(Number(event.target.value));
  };
  return (
    <div className="program-editor-topbar">
      <div className="duration">
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
        onClick={props.onRunProgramClick}
        disabled={!props.isRunEnabled || props.readOnly}
      >
        <div className="icon run" />
        <div className="text">Run</div>
      </button>
      <button
        className="program-state-button"
        onClick={props.onStopProgramClick}
        disabled={!props.runningProgram || !props.readOnly}
      >
        <div className="icon stop" />
        <div className="text">Stop</div>
      </button>
    </div>
  );

};
