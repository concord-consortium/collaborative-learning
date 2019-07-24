import * as React from "react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import { observer, inject } from "mobx-react";
import { NodeTypes } from "../utilities/node";

import "./dataflow-program-toolbar.sass";

interface IProps extends IBaseProps {
  onNodeCreateClick: (type: string) => void;
  onDeleteClick: () => void;
  onResetClick: () => void;
  onClearClick: () => void;
}
interface IState {}

@inject("stores")
@observer
export class DataflowProgramToolbar extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      showSettings: false,
    };
  }

  public render() {
    return (
      <div className="program-toolbar" data-test="program-toolbar">
        { NodeTypes.map((nt: any, i: any) => (
            this.renderAddNodeButton(nt.name, i)
          ))
        }
        <button onClick={this.props.onDeleteClick}>Delete</button>
        <button onClick={this.props.onResetClick}>Reset</button>
        <button onClick={this.props.onClearClick}>Clear</button>
      </div>
    );
  }

  public renderAddNodeButton(nodeType: string, i: number) {
    const handleAddNodeButtonClick = () => { this.props.onNodeCreateClick(nodeType); };
    return (
      <button
        key={i}
        onClick={handleAddNodeButtonClick}
      >
        {nodeType}
      </button>
    );
  }

}
