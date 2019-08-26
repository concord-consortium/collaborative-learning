import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { BaseComponent } from "../../../components/base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataflowContentModelType } from "../../models/tools/dataflow/dataflow-content";
import { DataflowProgram } from "../dataflow-program";
import { cloneDeep } from "lodash";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { DocumentModel } from "../../../models/document/document";
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
                onStartProgram={this.handleStartProgram}
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

  private handleStartProgram = async (title: string, id: string, startTime: number, endTime: number) => {
    const {documents, db, ui} = this.stores;
    const {problemWorkspace} = ui;
    // get the currently loaded document, we're going to spawn a new document based on it
    if (problemWorkspace.primaryDocumentKey) {
      const primaryDocument = documents.getDocument(problemWorkspace.primaryDocumentKey);
      if (primaryDocument) {
        // get snapshot of DocumentModel
        const primaryDocumentSnapshot = cloneDeep(getSnapshot(primaryDocument));
        // make a new DocumentModel from the snapshot
        const programRunDocument = DocumentModel.create(primaryDocumentSnapshot);
        // find the program tile (should only be 1) and apply the program run info
        programRunDocument.content.tileMap.forEach(tile => {
          const programContent = tile.content as DataflowContentModelType;
          if (programContent.program) {
            programContent.setProgramRunId(id);
            programContent.setProgramStartEndTime(startTime, endTime);
          }
        });
        // create and load the new document
        const newPersonalDocument = await db.createPersonalDocument(title || id, programRunDocument);
        if (newPersonalDocument) {
          problemWorkspace.setAvailableDocument(newPersonalDocument);
          ui.contractAll();
        }
      }
    }
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
