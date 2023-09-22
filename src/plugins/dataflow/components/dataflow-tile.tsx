import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";

import { DataflowProgram } from "./dataflow-program";
import { BaseComponent } from "../../../components/base";
import { ITileModel } from "../../../models/tiles/tile-model";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileProps } from "../../../components/tiles/tile-component";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { DataflowContentModelType } from "../model/dataflow-content";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { ToolTitleArea } from "../../../components/tiles/tile-title-area";
import { dataflowLogEvent } from "../dataflow-logger";
import { DataflowLinkTableButton } from "./ui/dataflow-program-link-table-button";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";
import { ITileLinkMetadata } from "../../../models/tiles/tile-link-types";

import "./dataflow-tile.scss";

interface IProps extends ITileProps{
  model: ITileModel;
  readOnly?: boolean;
  height?: number;
}

interface IDataflowTileState {
  isRecording: boolean;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number; //# of ticks for record
  isEditingTitle: boolean;
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IDataflowTileState> {
  public static tileHandlesSelection = true;

  constructor(props: IProps) {
    super(props);
    this.state = {
      isRecording: false,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
      isEditingTitle: false
    };
  }
  public render() {
    const { readOnly, height, model } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programDataRate, programZoom } = this.getContent();
    const tileContent = this.getContent();

    return (
      <>
        <ToolTitleArea>
          {this.renderTitle()}
          {this.renderTableLinkButton()}
        </ToolTitleArea>
        <div className={classes}>
          <SizeMe monitorHeight={true}>
            {({ size }: SizeMeProps) => {
              return (
                <DataflowProgram
                  documentProperties={this.getDocumentProperties()}
                  model={model}
                  onProgramChange={this.handleProgramChange}
                  onProgramDataRateChange={this.handleProgramDataRateChange}
                  onZoomChange={this.handleProgramZoomChange}
                  program={program}
                  programDataRate={programDataRate}
                  programZoom={programZoom}
                  readOnly={readOnly}
                  size={size}
                  tileHeight={height}
                  //state
                  programMode={this.determineProgramMode()}
                  isPlaying={this.state.isPlaying}
                  playBackIndex={this.state.playBackIndex}
                  recordIndex={this.state.recordIndex}
                  //state handlers
                  handleChangeOfProgramMode={this.handleChangeOfProgramMode}
                  handleChangeIsPlaying={this.handleChangeIsPlaying}
                  updatePlayBackIndex={this.updatePlayBackIndex}
                  updateRecordIndex={this.updateRecordIndex}
                  tileContent={tileContent}

                />
              );
            }}
          </SizeMe>
        </div>
      </>
    );
  }

  public componentDidMount() {
    this.props.onRegisterTileApi({
      getTitle: () => {
        return this.getTitle();
      },
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.getContent().exportJson(options);
      }
    });

    if (this.getTitle() === '') {
      const { model: { id }, onRequestUniqueTitle } = this.props;
      const title = onRequestUniqueTitle(id);
      title && this.props.model.setTitle(title);
    }
  }

  private getDocument() {
    const { documents, ui: { problemWorkspace: { primaryDocumentKey } } } = this.stores;
    return primaryDocumentKey ? documents.getDocument(primaryDocumentKey) : undefined;
  }

  private getDocumentProperties() {
    const document = this.getDocument();
    return document && document.properties.toJSON();
  }

  private handleBeginEditTitle = () => {
    this.setState({ isEditingTitle: true });
  };

  private handleTitleChange = (title?: string) => {
    if (title){
      this.props.model.setTitle(title);
      dataflowLogEvent("changeprogramtitle", { programTitleValue: this.getTitle() }, this.props.model.id);
      this.setState({ isEditingTitle: false });
    }
  };

  private renderTitle() {
    const size = { width: null, height: null };
    const { readOnly, scale } = this.props;
    return (
      <EditableTileTitle
        key="dataflow-title"
        size={size}
        scale={scale}
        getTitle={this.getTitle.bind(this)}
        readOnly={readOnly}
        measureText={(text) => measureText(text, defaultTileTitleFont)}
        onBeginEdit={this.handleBeginEditTitle}
        onEndEdit={this.handleTitleChange}
      />
    );
  }

  private renderTableLinkButton() {
    const { model, documentId, onRequestTilesOfType, onRequestLinkableTiles } = this.props;
    const isLinkButtonEnabled = onRequestLinkableTiles && onRequestLinkableTiles().consumers.length > 0;
    const actionHandlers = {
                             handleRequestTableLink: this.handleRequestTableLink,
                             handleRequestTableUnlink: this.handleRequestTableUnlink
                           };

    return (!this.state.isEditingTitle && !this.props.readOnly &&
      <DataflowLinkTableButton
        key="link-button"
        isLinkButtonEnabled={isLinkButtonEnabled}
        //use in useTableLinking
        documentId={documentId}
        model={model}
        onRequestTilesOfType={onRequestTilesOfType}
        onRequestLinkableTiles={onRequestLinkableTiles}
        actionHandlers={actionHandlers}
      />
    );
  }

  private handleRequestTableLink = (tileInfo: ITileLinkMetadata) => {
    this.getContent().addLinkedTile(tileInfo.id);
  };

  private handleRequestTableUnlink = (tileInfo: ITileLinkMetadata) => {
    this.getContent().removeLinkedTable(tileInfo.id);
  };

  private getTitle() {
    return this.props.model.title || "";
  }

  private handleProgramChange = (program: any) => {
    this.getContent().setProgram(program);
  };

  private handleProgramDataRateChange = (program: any) => {
    this.getContent().setProgramDataRate(program);
  };

  private handleProgramZoomChange = (dx: number, dy: number, scale: number) => {
    this.getContent().setProgramZoom(dx, dy, scale);
  };

  private handleChangeOfProgramMode = () => {
    const tileContent = this.getContent();
    const programMode = this.determineProgramMode();

    switch (programMode){
      case ProgramMode.Ready:
        tileContent.prepareRecording();
        this.setState({ isPlaying: false }); //reset isPlaying
        this.setState({ isRecording: true });
        break;
      case ProgramMode.Recording:
        this.setState({ isRecording: false });
        break;
      case ProgramMode.Done:
        tileContent.resetRecording();
        break;
    }
  };

  private determineProgramMode = () => {
    const { isRecording } = this.state;
    const tileContent = this.getContent();
    if (!isRecording && tileContent.isDataSetEmptyCases){
      return ProgramMode.Ready;
    }
    else if (isRecording){
      return ProgramMode.Recording;
    }
    else if (!isRecording && !tileContent.isDataSetEmptyCases){
     return ProgramMode.Done;
    }
    return ProgramMode.Ready;
  };

  private handleChangeIsPlaying = () => {
    this.setState({ isPlaying: !this.state.isPlaying });
  };

  private updatePlayBackIndex = (update: string) => {
    if (update === UpdateMode.Increment){
      const newPlayBackIndex = this.state.playBackIndex + 1;
      const tileContent = this.getContent();
      const recordedCases = tileContent.dataSet.cases.length;
      if (newPlayBackIndex >= recordedCases) {
        this.setState({ isPlaying: false });
      } else {
        this.setState({ playBackIndex: newPlayBackIndex });
      }
    }
    if (update === UpdateMode.Reset){
      this.setState({ playBackIndex: 0 });
    }
  };

  private updateRecordIndex = (update: string) => {
    if (update === UpdateMode.Increment){
      const newRecordIndex = this.state.recordIndex + 1;
      if (newRecordIndex >= this.getContent().maxRecordableCases) {
        this.setState({ isRecording: false });
      } else {
        this.setState({ recordIndex: newRecordIndex });
      }
    }
    if (update === UpdateMode.Reset){
      this.setState({ recordIndex: 0 });
    }
  };
  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}


