import * as React from "react";
import { ProgramRunTime } from "../utilities/node";

import "./dataflow-program-topbar.sass";

interface TopbarProps {
  onRunProgramClick: () => void;
  onStopProgramClick: () => void;
  programRunTimes: ProgramRunTime[];
  programDefaultRunTime: number;
  onProgramTimeSelectClick: (type: number) => void;
  isRunEnabled: boolean;
}

export const DataflowProgramTopbar = (props: TopbarProps) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onProgramTimeSelectClick(Number(event.target.value));
  };
  return (
    <div className="program-editor-topbar">
      <div>Duration:</div>
      <select
        onChange={handleSelectChange}
        disabled={props.isRunEnabled}
        defaultValue={props.programDefaultRunTime.toString()}
      >
        { props.programRunTimes.map((rt: ProgramRunTime) => (
            <option key={rt.text} value={rt.val}>
              {rt.text}
            </option>
          ))
        }
      </select>
      <button
        onClick={props.onRunProgramClick}
        disabled={props.isRunEnabled}
      >
        Run
      </button>
      <button
        onClick={props.onStopProgramClick}
        disabled={!props.isRunEnabled}
      >
        Stop
      </button>
    </div>
  );
};
