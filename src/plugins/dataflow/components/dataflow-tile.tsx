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
import { addAttributeToDataSet } from "../../../models/data/data-set";
import { DataflowLinkTableButton } from "./ui/dataflow-program-link-table-button";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";

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
    const numNodes = program.nodes.size;
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
                  readOnly={readOnly}
                  documentProperties={this.getDocumentProperties()}
                  program={program}
                  onProgramChange={this.handleProgramChange}
                  programDataRate={programDataRate}
                  onProgramDataRateChange={this.handleProgramDataRateChange}
                  programZoom={programZoom}
                  onZoomChange={this.handleProgramZoomChange}
                  size={size}
                  tileHeight={height}
                  tileId={model.id}
                  //state
                  programMode={this.determineProgramMode()}
                  isPlaying={this.state.isPlaying}
                  playBackIndex={this.state.playBackIndex}
                  recordIndex={this.state.recordIndex}
                  //state handlers
                  onRecordDataChange={this.handleChangeOfRecordingMode}
                  handleChangeIsPlaying={this.handleChangeIsPlaying}
                  updatePlayBackIndex={this.updatePlayBackIndex}
                  updateRecordIndex={this.updateRecordIndex}
                  numNodes={numNodes}
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
      title && this.getContent().setTitle(title);
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
    this.setState({isEditingTitle: true});
  };

  private handleTitleChange = (title?: string) => {
    if (title){
      this.getContent().setTitle(title);
      dataflowLogEvent("changeprogramtitle", { programTitleValue: this.getTitle() }, this.props.model.id);
      this.setState({isEditingTitle: false});
    }
  };

  private renderTitle() {
    const size = {width: null, height: null};
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
    const { model, onRequestTilesOfType, documentId } = this.props;
    const isLinkButtonEnabled = (this.determineProgramMode() === ProgramMode.Done);

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
        actionHandlers={actionHandlers}
      />
    );
  }

  private handleRequestTableLink = (tableId: string) => {
    this.getContent().addLinkedTable(tableId);
  };

  private handleRequestTableUnlink = (tableId: string) => {
    this.getContent().removeLinkedTable(tableId);
  };

  private getTitle() {
    return this.getContent().title || "";
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

  private pairNodesToAttributes = () => {
    const tileContent = this.getContent();
    // dataSet looks like
    // Time   |  Node 1 | Node 2 | Node 3 etc
    //    0   |   val    | val    |  val
    addAttributeToDataSet(tileContent.dataSet, { name: "Time (sec)" }); //time quantized to nearest sampling rate
    tileContent.program.nodes.forEach((n) => { //add attributes based on nodes in tile
      tileContent.addNewAttrFromNode(n.id, n.name);
    });
  };


  private handleChangeOfRecordingMode = () => {
    const tileContent = this.getContent();
    const programMode = this.determineProgramMode();

    const clearAttributes = () => {
      const allAttributes = tileContent.dataSet.attributes;
      allAttributes.forEach((attr)=>{
        tileContent.dataSet.removeAttribute(attr.id);
      });
    };
    const clearCases = () => {
      const ids = tileContent.dataSet.cases.map(({__id__}) => ( __id__));
      tileContent.dataSet.removeCases(ids);
    };

    switch (programMode){
      case ProgramMode.Ready:
        clearAttributes(); //clear X | Y attributes from previous state
        this.setState({isPlaying: false}); //reset isPlaying
        this.setState({isRecording: true});
        this.pairNodesToAttributes();
        break;
      case ProgramMode.Recording:
        this.setState({isRecording: false});
        break;
      case ProgramMode.Done:
        tileContent.setFormattedTime("000:00"); //set formattedTime to 000:00
        //clear the dataSet;
        clearAttributes();
        clearCases();
        // create a default dataSet x | y table
        addAttributeToDataSet(tileContent.dataSet, { name: "x" });
        addAttributeToDataSet(tileContent.dataSet, { name: "y" });
        break;
    }
  };

  private determineProgramMode = () => { //used to prop drill to children
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
    this.setState({isPlaying: !this.state.isPlaying});
  };

  private updatePlayBackIndex = (update: string) => {
    if (update === UpdateMode.Increment){
      this.setState({playBackIndex: this.state.playBackIndex + 1});
    }
    if (update === UpdateMode.Reset){
      this.setState({playBackIndex: 0});
    }
  };

  private updateRecordIndex = (update: string) => {
    if (update === UpdateMode.Increment){
      this.setState({recordIndex: this.state.recordIndex + 1});
    }
    if (update === UpdateMode.Reset){
      this.setState({recordIndex: 0});
    }
  };

  private getContent() {
    return this.props.model.content as DataflowContentModelType;
  }
}


