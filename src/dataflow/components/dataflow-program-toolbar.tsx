import * as React from "react";
import { NodeTypes } from "../utilities/node";

import "./dataflow-program-toolbar.sass";

interface IProps {
  onNodeCreateClick: (type: string) => void;
  onDeleteClick: () => void;
  isDataStorageDisabled: boolean;
  disabled: boolean;
}

export class DataflowProgramToolbar extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render() {
    return (
      <div className="program-toolbar" data-test="program-toolbar">
        { NodeTypes.map((nt: any, i: any) => (
            this.renderAddNodeButton(nt.name, i)
          ))
        }
        <button onClick={this.props.onDeleteClick}>Delete</button>
      </div>
    );
  }

  public renderAddNodeButton(nodeType: string, i: number) {
    const handleAddNodeButtonClick = () => { this.props.onNodeCreateClick(nodeType); };
    return (
      <button
        disabled={nodeType === "Data Storage" && this.props.isDataStorageDisabled || this.props.disabled}
        key={i}
        onClick={handleAddNodeButtonClick}
      >
        {nodeType}
      </button>
    );
  }

}
