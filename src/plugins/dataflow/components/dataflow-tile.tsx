import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { observer, inject } from "mobx-react";
import { DataflowProgram, UpdateMode } from "./dataflow-program";
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

import "./dataflow-tile.scss";

interface IProps extends ITileProps{
  model: ITileModel;
  readOnly?: boolean;
  height?: number;
}
//TODO:
// when localState (programRecordingMode )is  active, its only writing once to table
// when we move the state to the model (dataflow-content.ts), it writes twice, due to the left side copy of DF <-> Table
//observation: when we have it in localState its only rendering on the right side

// when we put state in MST model, its rendering on both sides, and then when we close left side it only renders once on the right side.

//
//stop should on left should always be disabled
//maybe left side button should not update state


//theory - we need to differential left and right side
//we can use either isPrimary, readOnly as a flag (See stickie)

interface IDataflowTileState {
  // programRecordingMode: number;
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
      // programRecordingMode: 0,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
      isEditingTitle: false
    };
  }
  public render() {
    // console.log("dataflow-tile.tsx > with programRecordingMode:", this.state.programRecordingMode);
    const { readOnly, height, model } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programDataRate, programZoom } = this.getContent();
    const numNodes = program.nodes.size;
    const tileContent = this.getContent();
    // const disabledRecordingStates = (this.state.programRecordingMode === 1 || this.state.programRecordingMode === 2);
    const disabledRecordingStates = (tileContent.programRecordingMode === 1 || tileContent.programRecordingMode === 2);
    const dataFlowTileReadOnly = readOnly || disabledRecordingStates;
    console.log("----- dataflow-tile >  render ()----------");
    // console.log("dataFlowTileReadOnly:", dataFlowTileReadOnly);
    console.log("\t dataflow-tile > original readOnly:", readOnly);
    // console.log("programRecordingMode local:", this.state.programRecordingMode);
    // console.log("\t programRecordingMode Model:", tileContent.programRecordingMode);



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
                  readOnly={dataFlowTileReadOnly}
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
                  // programRecordState={this.state.programRecordingMode}
                  programRecordState={tileContent.programRecordingMode}
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
    const tileContent = this.getContent();

    // const isLinkButtonEnabled = (this.state.programRecordingMode === 2);
    const isLinkButtonEnabled = (tileContent.programRecordingMode === 2);

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
    const model = this.getContent();
    const dataSet = model.dataSet;
    const dataSetAttributes = dataSet.attributes;

    // dataSet looks like
    // Time   |  Node 1 | Node 2 | Node 3 etc
    //    0   |   val    | val    |  val
    addAttributeToDataSet(model.dataSet, { name: "Time (sec)" }); //this is time quantized to nearest sampling rate

    model.program.nodes.forEach((n) => {
      model.addNewAttrFromNode(n.id, n.name);
    });

    // compare dataset attributes against nodes on tile, if an attribute is not on the tile - remove it.
    dataSetAttributes.forEach((attribute, idx) => {
      if (idx >= 1) { //skip 0 index (Time)
        model.removeAttributesInDatasetMissingInTile(attribute.id);
      }
    });
  };

  private handleChangeOfRecordingMode = () => {
    //0 program: executing, dataSet: empty
    //1 program: executing, dataSet: writing in progress
    //2 program: not executing,  dataSet: populated
    //below are "substates" of #2 above
    //isPlaying: playbackIndex incrementing, Nodes updated "by hand" rather than via execution
    //isPaused: playbackIndex not incrementing, nodes stay as they were at last index above


    const tileContent = this.getContent();
    // const mode = this.state.programRecordingMode; //old
      const mode = tileContent.programRecordingMode; //added


    if (mode === 0){ //when Record is pressed
      this.setState({isPlaying: false}); //reset isPlaying
      this.pairNodesToAttributes();
    }
    if (mode === 2){ // Clear pressed - remove all dataSet
      const allAttributes = tileContent.dataSet.attributes;
      const ids = tileContent.dataSet.cases.map(({__id__}) => ( __id__));
      tileContent.dataSet.removeCases(ids);
      allAttributes.forEach((attr)=>{
        tileContent.dataSet.removeAttribute(attr.id);
      });
    }

    // this.setState({ //old
    //   programRecordingMode: (mode + 1) % 3
    // });

    tileContent.setProgramRecordingMode();

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


