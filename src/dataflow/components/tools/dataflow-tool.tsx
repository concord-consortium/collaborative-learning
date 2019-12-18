import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { BaseComponent } from "../../../components/base";
import { ICreateOtherDocumentParams } from "../../../lib/db";
import { IDocumentProperties } from "../../../lib/db-types";
import { DocumentModelType } from "../../../models/document/document";
import { DocumentContentModel } from "../../../models/document/document-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataflowContentModelType } from "../../models/tools/dataflow/dataflow-content";
import { DataflowProgram } from "../dataflow-program";
import { getLocalTimeStamp } from "../../utilities/time";
import { cloneDeep } from "lodash";
import { SizeMe, SizeMeProps } from "react-sizeme";
import "./dataflow-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
  height?: number;
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
    const { model, readOnly, height } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programRunId, programIsRunning, programStartTime, programEndTime, programRunTime, programZoom }
      = this.getContent();
    return (
      <div className={classes}>
        <SizeMe monitorHeight={true}>
          {({ size }: SizeMeProps) => {
            return (
              <DataflowProgram
                modelId={model.id}
                readOnly={readOnly}
                program={program}
                onProgramChange={this.handleProgramChange}
                onShowOriginalProgram={this.handleShowOriginalProgram}
                onStartProgram={this.handleStartProgram}
                onSetProgramRunId={this.handleSetProgramRunId}
                programRunId={programRunId}
                programIsRunning={programIsRunning}
                onCheckProgramRunState={this.handleCheckProgramRunState}
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
                tileHeight={height}
              />
            );
          }}
        </SizeMe>
      </div>
    );
  }

  private getDocument() {
    const { documents, ui: { problemWorkspace: { primaryDocumentKey } } } = this.stores;
    return primaryDocumentKey && documents.getDocument(primaryDocumentKey);
  }

  private switchToDocument(document: DocumentModelType) {
    if (document) {
      const { ui: { problemWorkspace } } = this.stores;
      problemWorkspace.toggleComparisonVisible({ override: false });
      problemWorkspace.setPrimaryDocument(document);
    }
  }

  private handleStartProgram = async (datasetName: string, id: string, startTime: number, endTime: number) => {
    const { db } = this.stores;
    // get the currently loaded document, we're going to spawn a new document based on it
    const document = this.getDocument();
    if (document) {
      // get snapshot of DocumentContent
      const contentSnapshot = cloneDeep(getSnapshot(document.content));
      // make a new DocumentContentModel from the snapshot
      const documentContent = DocumentContentModel.create(contentSnapshot);
      // find the program tile (should only be 1) and apply the program run info
      documentContent.tileMap.forEach(tile => {
        if (tile.content.type === "Dataflow") {
          const programContent = tile.content as DataflowContentModelType;
          programContent.setProgramRunId(id);
          programContent.setProgramStartEndTime(startTime, endTime);
          programContent.setRunningStatus(endTime);
        }
      });
      const dfProgramId = document.key;
      const originTitle = document.title
                            ? { originTitle: document.title }
                            : undefined;
      const properties: IDocumentProperties = { dfProgramId, dfRunId: id, ...originTitle };
      if (datasetName.length > 0) {
        properties.dfHasData = "true";
      }
      // create and load the new document
      const params: ICreateOtherDocumentParams = {
              title: datasetName || `${document.title}-${getLocalTimeStamp(Date.now())}`,
              properties,
              content: JSON.parse(documentContent.publish())
            };
      const newPersonalDocument = await db.createPersonalDocument(params);
      this.switchToDocument(newPersonalDocument);
    }
  }

  private handleProgramChange = (program: any) => {
    this.getContent().setProgram(program);
  }

  private handleShowOriginalProgram = () => {
    const { documents } = this.stores;
    const document = this.getDocument();
    const originDocumentId = document && document.properties.get("dfProgramId");
    const originDocument = originDocumentId && documents.getDocument(originDocumentId);
    originDocument && this.switchToDocument(originDocument);
  }

  private handleSetProgramRunId = (id: string) => {
    this.getContent().setProgramRunId(id);
  }

  private handleSetProgramStartTime = (time: number) => {
    this.getContent().setProgramStartTime(time);
  }
  private handleCheckProgramRunState = (endTime: number) => {
    this.getContent().setRunningStatus(endTime);
  }
  private handleSetProgramEndTime = (time: number) => {
    this.getContent().setProgramEndTime(time);
    this.getContent().setRunningStatus(time);
  }

  private handleSetProgramStartEndTime = (startTime: number, endTime: number) => {
    this.getContent().setProgramStartEndTime(startTime, endTime);
    this.getContent().setRunningStatus(endTime);
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
