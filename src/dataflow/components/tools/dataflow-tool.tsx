import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataflowContentModelType } from "../../models/tools/dataflow/dataflow-content";
import { DataflowProgram } from "../dataflow-program";
import { SizeMe, SizeMeProps } from "react-sizeme";

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
    const { readOnly } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programRunId, programStartTime, programEndTime, programRunTime, programZoom } = this.getContent();
    return (
      <div className={classes}>
        <SizeMe monitorHeight={true}>
          {({ size }: SizeMeProps) => {
            return (
              <DataflowProgram
                readOnly={readOnly}
                program={program}
                onProgramChange={this.handleProgramChange}
                onSetProgramRunId={this.handleSetProgramRunId}
                programRunId={programRunId}
                onSetProgramStartTime={this.handleSetProgramStartTime}
                programStartTime={programStartTime}
                onSetProgramEndTime={this.handleSetProgramEndTime}
                programEndTime={programEndTime}
                onSetProgramStartEndTime={this.handleSetProgramStartEndTime}
                programRunTime={programRunTime}
                onProgramRunTimeChange={this.handleProgramRunTimeChange}
                programZoom={programZoom}
                onZoomChange={this.handleProgramZoomChange}
                size={size}
              />
            );
          }}
        </SizeMe>
      </div>
    );
  }

  private handleProgramChange = (program: any) => {
    this.getContent().setProgram(program);
  }

  private handleSetProgramRunId = (id: string) => {
    this.getContent().setProgramRunId(id);
  }

  private handleSetProgramStartTime = (time: number) => {
    this.getContent().setProgramStartTime(time);
  }

  private handleSetProgramEndTime = (time: number) => {
    this.getContent().setProgramEndTime(time);
  }

  private handleSetProgramStartEndTime = (startTime: number, endTime: number) => {
    this.getContent().setProgramStartEndTime(startTime, endTime);
  }

  private handleProgramRunTimeChange = (program: any) => {
    this.getContent().setProgramRunTime(program);
  }

  private handleProgramZoomChange = (dx: number, dy: number, scale: number) => {
    this.getContent().setProgramZoom(dx, dy, scale);
  }

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}
