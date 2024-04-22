import React from "react";
import "regenerator-runtime/runtime";
import { inject, observer } from "mobx-react";
import { SizeMeProps } from "react-sizeme";

import { BaseComponent } from "../../../components/base";
import { ProgramZoomType, DataflowContentModelType } from "../model/dataflow-content";
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

import { ClassicPreset } from "rete";

import { recordCase } from "../model/utilities/recording-utilities";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { ReteManager } from "../nodes/rete-manager";

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
  programZoom?: ProgramZoomType;
  readOnly?: boolean;
  runnable?: boolean;
  tileHeight?: number;
  //state
  programMode: ProgramMode;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number;
  //state handlers
  handleChangeOfProgramMode: () => void;
  handleChangeIsPlaying: () => void;
  updatePlayBackIndex: (update: string) => void;
  updateRecordIndex: (update: string) => void;
  tileContent: DataflowContentModelType;
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
}

const numSocket = new ClassicPreset.Socket("Number value");

const RETE_APP_IDENTIFIER = "dataflow@0.1.0";

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private toolDiv: HTMLElement | null;
  private previousChannelIds = "";
  private intervalHandle?: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private reteManager: ReteManager | undefined;

  constructor(props: IProps) {
    super(props);
    this.state = {
      editorContainerWidth: 0,
      lastIntervalDuration: 0,
    };
    this.lastIntervalTime = Date.now();
  }

  private get tileId() {
    return this.props.tileId || "";
  }

  public render() {
    const { readOnly, documentProperties, tileContent, programDataRate,
            isPlaying, playBackIndex, handleChangeIsPlaying, handleChangeOfProgramMode, programMode} = this.props;

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
          handleChangeIsPlaying={handleChangeIsPlaying}
          tileContent={tileContent}
          handleChangeOfProgramMode={handleChangeOfProgramMode}
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
                // If we could make this be a component that does the setup
                // of Rete that would be a nice way to encapsulate the configuration
                // and then we can make a copy of it for the playback
              }
              <div
                className="flow-tool"
                ref={elt => this.toolDiv = elt}
                onWheel={e => this.handleWheel(e, this.toolDiv) }
              />
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
  }

  public componentDidUpdate(prevProps: IProps) {
    if (!this.reteManager && this.toolDiv) {
      this.initProgram();
    }

    if (this.props.programDataRate !== prevProps.programDataRate) {
      this.setDataRate(this.props.programDataRate);
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
      this.toolDiv, this.props.tileContent, this.stores, this.props.runnable, this.props.readOnly);

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
    const { programMode } = this.props;
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
    if (!caseId) return;
    // Keep TS happy
    return "foo";
  };

  private tick = () => {
    const { runnable, tileContent: tileModel, playBackIndex, programMode,
            isPlaying,  updateRecordIndex, updatePlayBackIndex } = this.props;
    const { reteManager } = this;

    if (!reteManager) return;

    const dataSet = tileModel.dataSet;
    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    this.updateChannels();

    switch (programMode){
      case ProgramMode.Ready:
        reteManager.tickAndProcessNodes();
        break;
      case ProgramMode.Recording:
        if (runnable) {
          recordCase(this.props.tileContent, this.props.recordIndex);
        }
        reteManager.tickAndProcessNodes();
        updateRecordIndex(UpdateMode.Increment);
        break;
      case ProgramMode.Done:
        if (isPlaying) {
          this.playbackNodesWithCaseData(dataSet, playBackIndex);
          updatePlayBackIndex(UpdateMode.Increment);
        } else {
          updatePlayBackIndex(UpdateMode.Reset);
        }
        updateRecordIndex(UpdateMode.Reset);
        break;
    }
  };
}
