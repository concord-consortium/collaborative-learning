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


import "./dataflow-tile.scss";

interface IProps extends ITileProps{
  model: ITileModel;
  readOnly?: boolean;
  height?: number;
}

interface IDataflowTileState {
  programRecordingMode: number; // TODO: convert to enum
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number; //# of ticks for record
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IDataflowTileState> {

  public static tileHandlesSelection = true;

  constructor(props: IProps) {
    super(props);
    this.state = {
      programRecordingMode: 0,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
    };
  }

  public render() {
    const { readOnly, height, model } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `dataflow-tool disable-tile-content-drag ${editableClass}`;
    const { program, programDataRate, programZoom } = this.getContent();
    const numNodes = program.nodes.size;
    const tileModel = this.getContent();
    const disabledRecordingStates = (this.state.programRecordingMode === 1 || this.state.programRecordingMode === 2);
    const dataFlowTileReadOnly = readOnly || disabledRecordingStates;

    return (
      <>
        <ToolTitleArea>{this.renderTitle()}</ToolTitleArea>
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
                  programRecordState={this.state.programRecordingMode}
                  isPlaying={this.state.isPlaying}
                  playBackIndex={this.state.playBackIndex}
                  recordIndex={this.state.recordIndex}
                  //state handlers
                  onRecordDataChange={this.handleChangeOfRecordingMode}
                  handleChangeIsPlaying={this.handleChangeIsPlaying}
                  updatePlayBackIndex={this.updatePlayBackIndex}
                  updateRecordIndex={this.updateRecordIndex}
                  numNodes={numNodes}
                  tileModel={tileModel}
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

  private handleTitleChange = (title?: string) => {
    if (title){
      this.getContent().setTitle(title);
      dataflowLogEvent("changeprogramtitle", { programTitleValue: this.getTitle() }, this.props.model.id);
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
        onEndEdit={this.handleTitleChange}
      />
    );
  }

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
    // dataSet looks like
    // Time_Quantized | Time_Actual | Node 1 | Node 2 | Node 3 etc
    //    0           |  0          | val    | val    |  val
    model.addNewAttrFromNode(0, "Time_Quantized");
    model.addNewAttrFromNode(1, "Time_Actual");

    model.program.nodes.forEach((n) => {
      model.addNewAttrFromNode(n.id, n.name);
    });

    // dataset attributes against nodes on tile, if an attribute is not on the tile - remove it.
    const dataSet = model.dataSet;
    const dataSetAttributes = dataSet.attributes;

    dataSetAttributes.forEach((attribute, idx) => {
      if (idx > 1) { //skip 0 and 1 index because those attribute are Time
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

    const mode = this.state.programRecordingMode;
    const model = this.getContent();

    if (mode === 0){ //when Record is pressed
      this.setState({isPlaying: false}); //reset isPlaying
      this.pairNodesToAttributes();
    }
    if (mode === 2){ // Clear pressed - remove all dataSet
      const allAttributes = model.dataSet.attributes;
      const ids = model.dataSet.cases.map(({__id__}) => ( __id__));
      model.dataSet.removeCases(ids);
      allAttributes.forEach((attr)=>{
        model.dataSet.removeAttribute(attr.id);
      });
    }

    this.setState({
      programRecordingMode:  (mode + 1) % 3
    });
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
