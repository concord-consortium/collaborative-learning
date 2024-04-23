import React from "react";
import "regenerator-runtime/runtime";
import { getSnapshot } from "mobx-state-tree";
import { inject, observer } from "mobx-react";
import { SizeMeProps } from "react-sizeme";

import { BaseComponent } from "../../../components/base";
import { DataflowContentModel, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";
import { simulatedChannel } from "../model/utilities/simulated-channel";

import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { serialSensorChannels } from "../model/utilities/channel";
import { ProgramDataRates } from "../model/utilities/node";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";
import { DocumentContextReact } from "../../../components/document/document-context";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";
import { IDataSet } from "../../../models/data/data-set";


import { getAttributeIdForNode, recordCase } from "../model/utilities/recording-utilities";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { ReteManager } from "../nodes/rete-manager";
import { IBaseNodeModel } from "../nodes/base-node";
import { calculatedRecentValues } from "../utilities/playback-utils";

import "./dataflow-program.sass";

export interface IStartProgramParams {
  runId: string;
  startTime: number;
  endTime: number;
  hasData: boolean;
  title: string;
}

interface IProps extends SizeMeProps {
  documentProperties?: { [key: string]: string };
  tileId?: string;
  program?: DataflowProgramModelType;
  programDataRate: number;
  readOnly?: boolean;
  runnable?: boolean;
  tileHeight?: number;
  tileContent: DataflowContentModelType;
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number; //# of ticks for record
}

const RETE_APP_IDENTIFIER = "dataflow@0.1.0";

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private toolDiv: HTMLElement | null;
  private playbackToolDiv: HTMLDivElement | null;
  private previousChannelIds = "";
  private intervalHandle?: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private reteManager: ReteManager | undefined;
  private playbackReteManager: ReteManager | undefined;

  constructor(props: IProps) {
    super(props);
    this.state = {
      editorContainerWidth: 0,
      lastIntervalDuration: 0,
      isRecording: false,
      isPlaying: false,
      playBackIndex: 0,
      recordIndex: 0,
    };
    this.lastIntervalTime = Date.now();
  }

  private get tileId() {
    return this.props.tileId || "";
  }

  public render() {
    const { readOnly, documentProperties, tileContent, programDataRate } = this.props;
    const { playBackIndex, isPlaying } = this.state;
    const programMode = this.determineProgramMode();

    const editorClassForDisplayState = "full";
    const editorClass = `editor ${editorClassForDisplayState}`;
    const toolbarEditorContainerClass = `toolbar-editor-container`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showZoomControl = !documentProperties?.dfHasData;
    const disableToolBarModes = programMode === ProgramMode.Recording || programMode === ProgramMode.Done;
    const showProgramToolbar = showZoomControl && !disableToolBarModes;

    return (
      <div className="dataflow-program-container">
        <DataflowProgramTopbar
          onSerialRefreshDevices={this.serialDeviceRefresh}
          programDataRates={ProgramDataRates}
          dataRate={programDataRate}
          onRateSelectClick={this.handleRateSelectClick}
          readOnly={!!readOnly}
          showRateUI={showRateUI}
          lastIntervalDuration={this.state.lastIntervalDuration}
          serialDevice={this.stores.serialDevice}
          programMode={programMode}
          playBackIndex={playBackIndex}
          isPlaying={isPlaying}
          handleChangeIsPlaying={this.handleChangeIsPlaying}
          tileContent={tileContent}
          handleChangeOfProgramMode={this.handleChangeOfProgramMode}
        />
        <div className={toolbarEditorContainerClass}>
          { showProgramToolbar && <DataflowProgramToolbar
            disabled={!!readOnly}
            isTesting={isTesting}
            onClearClick={this.clearProgram}
            onNodeCreateClick={this.addNode}
            tileId={this.tileId}
          /> }
          <DataflowDropZone
            addNode={this.addNode}
            className="editor-graph-container"
            reteManager={this.reteManager}
            readOnly={readOnly}
            style={this.getEditorStyle}
            tileId={this.tileId}
          >
            <div
              className={editorClass}
            >
              {
                // the main flow-tool div is just hidden so its reteManager doesn't have
                // to be disposed and recreated each time the recording finishes
              }
              <div
                className={`flow-tool ${programMode === ProgramMode.Done ? "hidden" : ""}`}
                ref={elt => this.toolDiv = elt}
                onWheel={e => this.handleWheel(e, this.toolDiv) }
              />
              { programMode === ProgramMode.Done &&
                <div
                  className="flow-tool"
                  ref={elt => this.playbackToolDiv = elt}
                />
              }
              { this.shouldShowProgramCover() &&
                <DataflowProgramCover editorClass={editorClassForDisplayState} /> }
              {showZoomControl && this.reteManager &&
                <DataflowProgramZoom
                  onZoomInClick={this.reteManager.zoomIn}
                  onZoomOutClick={this.reteManager.zoomOut}
                  disabled={false}
                /> }
            </div>
          </DataflowDropZone>
        </div>
      </div>
    );
  }

  private handleWheel(e: any, toolDiv: HTMLElement | null) {
    if (toolDiv !== null) {
      const documentContent = toolDiv.closest(".document-content");
      documentContent?.scrollBy(e.deltaX, e.deltaY);
    }
  }

  public componentDidMount() {
    if (!this.reteManager && this.toolDiv) {
      this.initProgram();
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalHandle);
    this.reteManager?.dispose();
    this.reteManager = undefined;
    this.playbackReteManager?.dispose();
    this.playbackReteManager = undefined;
  }

  public componentDidUpdate(prevProps: IProps) {
    if (!this.reteManager && this.toolDiv) {
      this.initProgram();
    }

    if (this.props.programDataRate !== prevProps.programDataRate) {
      this.setDataRate(this.props.programDataRate);
    }

    if (this.playbackToolDiv && !this.playbackReteManager) {
      const contentSnapshot = getSnapshot(this.props.tileContent);
      const contentCopy = DataflowContentModel.create(contentSnapshot);
      this.playbackReteManager = new ReteManager(
        contentCopy.program, this.tileId, this.playbackToolDiv, contentCopy, this.stores,
        this.props.runnable, this.props.readOnly, true
      );

      // When we first show the playbackToolDiv after finishing recording it would show
      // the last nodeValues and recent values if we don't do anything.
      // However the playback slider and the time display will be showing the start of the
      // recording.
      // The code below resets the shown nodeValues and recentValues to match the slider
      // position
      const dataSet = this.props.tileContent.dataSet;
      this.playbackNodesWithCaseData(dataSet, 0);
    }
  }

  private handleRateSelectClick = (rate: number) => {
    this.props.tileContent.setProgramDataRate(rate);
  };

  private getEditorStyle = () => {
    const style: React.CSSProperties = {};
    const documentElt = document.querySelector(".document-content");
    const kBottomResizeHandleHeight = 10;
    const kProgramTopbarHeight = 44;
    const topbarHeight = kProgramTopbarHeight;
    const editorHeight = documentElt
                         ? documentElt.clientHeight - topbarHeight - kBottomResizeHandleHeight
                         : 500;
    if (!this.props.tileHeight) {
      style.height = `${editorHeight}px`;
    }
    return style;
  };

  private initProgram = () => {
    this.initProgramEditor(true);

    this.setDataRate(this.props.programDataRate);
  };

  private initProgramEditor = (clearHistory = false) => {
    if (!this.toolDiv || !this.props.program) return;

    const reteManager = new ReteManager(this.props.program, this.tileId,
      this.toolDiv, this.props.tileContent, this.stores, this.props.runnable, this.props.readOnly, false);

    this.reteManager = reteManager;
  };

  private setDataRate = (rate: number) => {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    // Do not tick if we are readOnly,
    // in this case we are relying on state changes from the editable diagram that is
    // ticking.
    if (this.props.readOnly) return;

    this.intervalHandle = setInterval(() => this.tick(), rate);
  };

  private get simulatedChannels() {
    return this.props.tileContent
      ? this.props.tileContent.inputVariables?.map(variable => simulatedChannel(variable)) ?? []
      : [];
  }

  private updateChannels = () => {
    const channels = [...virtualSensorChannels, ...this.simulatedChannels, ...serialSensorChannels];
    const channelIds = channels.map(c => c.channelId).join(",");
    if (channelIds !== this.previousChannelIds) {
      this.previousChannelIds = channelIds;
      this.props.tileContent.setChannels(channels);

      this.reteManager?.countSerialDataNodes();
    }
  };

  private shouldShowProgramCover() {
    return this.props.readOnly || this.inDisabledRecordingState;
  }

  //disable the right side when recordingMode in stop or clear
  private get inDisabledRecordingState() {
    const programMode = this.determineProgramMode();
    return ( programMode === ProgramMode.Recording || programMode === ProgramMode.Done);
  }

  private keepNodesInView = () => {
    const margin = 5;
  };

  private addNode = (nodeType: string, position?: [number, number]) => {
    this.reteManager?.createAndAddNode(nodeType, position);
  };

  private serialDeviceRefresh = () => {
    if (!this.stores.serialDevice.hasPort()){
      this.stores.serialDevice.requestAndSetPort()
        .then(() => {
          this.stores.serialDevice.handleStream(this.props.tileContent.channels);
        });
    }

    if (this.stores.serialDevice.hasPort()){
      // TODO - if necessary
      // https://web.dev/serial/#close-port
    }
  };

  private clearProgram = () => {
    this.reteManager?.editor.clear();
  };

  private playbackNodesWithCaseData = (dataSet: IDataSet, playBackIndex: number) => {
    const caseId = dataSet.getCaseAtIndex(playBackIndex)?.__id__;
    if (!caseId || !this.playbackReteManager) return;

    const { program } = this.playbackReteManager.mstContent;
    let idx = 0;
    program.nodes.forEach((_node) => {
      const node = _node.data as IBaseNodeModel;
      const attrId = getAttributeIdForNode(this.props.tileContent.dataSet, idx);
      const valForNode = dataSet.getValue(caseId, attrId) as number;
      node.setNodeValue(valForNode);

      const recentValues = calculatedRecentValues(dataSet, playBackIndex, attrId);
      node.setRecentValues(recentValues);
      idx++;
    });
  };

  private tick = () => {
    const { runnable, tileContent: tileModel } = this.props;
    const { playBackIndex, isPlaying, recordIndex } = this.state;
    const programMode = this.determineProgramMode();
    const { reteManager } = this;

    if (!reteManager) return;

    const dataSet = tileModel.dataSet;
    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    switch (programMode){
      case ProgramMode.Ready:
        this.updateChannels();
        reteManager.tickAndProcessNodes();
        break;
      case ProgramMode.Recording:
        this.updateChannels();
        if (runnable) {
          recordCase(this.props.tileContent, recordIndex);
        }
        reteManager.tickAndProcessNodes();
        this.incrementRecordIndex(UpdateMode.Increment);
        break;
      case ProgramMode.Done:
        if (isPlaying) {
          this.playbackNodesWithCaseData(dataSet, playBackIndex);
          this.incrementPlayBackIndex();
        }
        break;
    }
  };

  private stopRecording() {
    this.setState({isRecording: false, recordIndex: 0});
  }

  private handleChangeOfProgramMode = () => {
    const { tileContent } = this.props;
    const programMode = this.determineProgramMode();

    switch (programMode){
      case ProgramMode.Ready:
        tileContent.prepareRecording();
        this.setState({isPlaying: false, playBackIndex: 0}); //reset isPlaying
        this.setState({isRecording: true});
        break;
      case ProgramMode.Recording:
        this.stopRecording();
        break;
      case ProgramMode.Done:
        if (this.playbackReteManager) {
          this.playbackReteManager.dispose();
          this.playbackReteManager = undefined;
        }
        tileContent.resetRecording();
        break;
    }
  };

  private determineProgramMode = () => {
    const { isRecording } = this.state;
    const { tileContent } = this.props;
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
    const newIsPlaying = !this.state.isPlaying;
    if (newIsPlaying) {
      // If we are starting to play again, figure out if we un-pausing
      // or restarting after hitting the end of the recording
      const { tileContent } = this.props;
      const newPlayBackIndex = this.state.playBackIndex + 1;
      const recordedCases = tileContent.dataSet.cases.length;
      if (newPlayBackIndex >= recordedCases) {
        this.setState({isPlaying: newIsPlaying, playBackIndex: 0});
      } else {
        this.setState({isPlaying: newIsPlaying});
      }
    } else {
      this.setState({isPlaying: newIsPlaying});
    }

  };

  private incrementPlayBackIndex = () => {
    const { tileContent } = this.props;
    const newPlayBackIndex = this.state.playBackIndex + 1;
    const recordedCases = tileContent.dataSet.cases.length;
    if (newPlayBackIndex >= recordedCases) {
      // TODO: It'd be nice to record this so the button could show "restart" or "play again"
      this.setState({isPlaying: false});
    } else {
      this.setState({playBackIndex: newPlayBackIndex});
    }
  };

  private incrementRecordIndex = (update: string) => {
    const { tileContent } = this.props;
    const newRecordIndex = this.state.recordIndex + 1;
    if (newRecordIndex >= tileContent.maxRecordableCases) {
      this.stopRecording();
    } else {
      this.setState({recordIndex: newRecordIndex});
    }
  };

}
