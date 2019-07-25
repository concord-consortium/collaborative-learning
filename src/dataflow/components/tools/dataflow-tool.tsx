import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataflowContentModelType } from "../../models/tools/dataflow/dataflow-content";
import { DataflowProgram } from "../dataflow-program";

import "./dataflow-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
}
​
@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IState> {

  public static tileHandlesSelection = true;

  public state: IState = {};

  public render() {
    const { model, readOnly } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool ${editableClass}`;
    const program = this.getContent().program;
    return (
      <div className={classes}>
        <DataflowProgram program={program}/>
      </div>
    );
  }

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}
