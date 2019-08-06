import * as React from "react";
import { ProgramRunTime, ProgramRunTimes } from "../utilities/node";

import "./dataflow-program-topbar.sass";

interface IProps {
  onRunProgramClick: () => void;
  onStopProgramClick: () => void;
  onProgramTimeSelectClick: (type: number) => void;
  isRunEnabled: boolean;
}

export class DataflowProgramTopbar extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    return (
      <div className="program-editor-topbar">
        <div>Duration:</div>
        <select
          onChange={this.handleSelectChange}
          disabled={this.props.isRunEnabled}
        >
          { ProgramRunTimes.map((rt: ProgramRunTime, i: number) => (
              <option key={i} value={rt.val}>
                {rt.text}
              </option>
            ))
          }
        </select>
        <button
          onClick={this.props.onRunProgramClick}
          disabled={this.props.isRunEnabled}
        >
          Run
        </button>
        <button
          onClick={this.props.onStopProgramClick}
          disabled={!this.props.isRunEnabled}
        >
          Stop
        </button>
      </div>
    );
  }

  private handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.props.onProgramTimeSelectClick(Number(event.target.value));
  }

}
