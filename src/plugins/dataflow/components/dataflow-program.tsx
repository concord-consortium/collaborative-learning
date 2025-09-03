import React from "react";
import { observable, runInAction } from "mobx";
import { getSnapshot } from "mobx-state-tree";
import { inject, observer } from "mobx-react";
import { SizeMeProps } from "react-sizeme";

import { BaseComponent } from "../../../components/base";
import { DataflowContentModel, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";

import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { ProgramDataRates } from "../model/utilities/node";
import { DocumentContextReact } from "../../../components/document/document-context";
import { ITileProps } from "../../../components/tiles/tile-component";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ProgramMode } from "./types/dataflow-tile-types";
import { IDataSet } from "../../../models/data/data-set";

import { recordCase } from "../model/utilities/recording-utilities";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { ReteManager } from "../nodes/rete-manager";

import "./dataflow-program.scss";

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
  tileHeight?: number;
  tileContent: DataflowContentModelType;
  tileElt: HTMLElement | null;
  onRegisterTileApi: ITileProps["onRegisterTileApi"];
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number; //# of ticks for record
}

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private toolDiv: HTMLElement | null;
  private playbackToolDiv: HTMLDivElement | null;
  private intervalHandle?: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private reteManager: ReteManager | undefined;
  private playbackReteManager: ReteManager | undefined;
  private updateObservable = observable({updateCount: 0});

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
                  onZoomInClick={this.handleZoomIn}
                  onZoomOutClick={this.handleZoomOut}
                  disabled={false}
                /> }
            </div>
          </DataflowDropZone>
        </div>
      </div>
    );
  }

  private handleZoomIn = () => {
    const zoomManager = this.playbackReteManager || this.reteManager;
    zoomManager?.zoomIn();
  };

  private handleZoomOut = () => {
    const zoomManager = this.playbackReteManager || this.reteManager;
    zoomManager?.zoomOut();
  };

  public componentDidMount() {
    this.initReteManagersIfNeeded();

    // Auto-fit content if in read-only mode.
    if (this.props.readOnly && this.reteManager) {
      this.reteManager.setupComplete.then(() => this.reteManager?.fitContent());
    }

    this.props.onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return this.props.tileContent.exportJson(options);
      },
      // Note: when the component mounts it is likely that the tileElt will be undefined.
      // So we use an arrow function so we can access `this` and look up the tileElt from
      // props when it is needed.
      getObjectBoundingBox: (objectId, objectType) => {
        // The annotation layer adds the tile border when computing the position of the
        // tile in the document. So basically it is figuring out the "inside" top left
        // corner of the tile. This makes sense, since internally in the tile its elements
        // are positioned inside of this border.
        // However tileElt.getBoundClientRect gives the position include the width of the
        // border. So this is the position of the "outside" of the tile element. Thus when
        // we provide our bounding boxes we also need to subtract off the tile border width
        // so they will line up when the annotation layer re-adds this border width.
        const tileBorder = 2;
        const padding = 5;

        const nodeModel = this.props.program?.nodes.get(objectId);

        const reteManager = this.playbackReteManager || this.reteManager;
        const nodeView = reteManager?.area.nodeViews.get(objectId);
        const { tileElt } = this.props;
        if (!nodeModel || !nodeView || !tileElt) return undefined;


        // Observe the updateCount so every time the component is updated
        // we recompute the bounding boxes. This is mainly important so changes
        // to the recording state are taken into account.
        // eslint-disable-next-line unused-imports/no-unused-vars -- need to observe
        const {updateCount} = this.updateObservable;

        // Observe node position changes. We use liveX and liveY so we update during
        // the drag.
        // eslint-disable-next-line unused-imports/no-unused-vars
        const {liveX, liveY} = nodeModel;

        // Observe program canvas changes like translation and zooming.
        // eslint-disable-next-line unused-imports/no-unused-vars
        const {dx, dy, scale: programScale} = this.props.tileContent.liveProgramZoom;

        const tileRect = tileElt.getBoundingClientRect();
        const scale = tileElt.offsetWidth / tileRect.width;
        const nodeRect = nodeView.element.getBoundingClientRect();

        return {
          left: (nodeRect.left-tileRect.left) * scale - tileBorder - padding,
          top:  (nodeRect.top-tileRect.top) * scale - tileBorder - padding,
          width: nodeRect.width * scale + padding*2,
          height: nodeRect.height * scale + padding*2
        };
      }
    });

  }

  public componentWillUnmount() {
    clearInterval(this.intervalHandle);
    this.reteManager?.dispose();
    this.reteManager = undefined;
    this.playbackReteManager?.dispose();
    this.playbackReteManager = undefined;
  }

  public componentDidUpdate(prevProps: IProps) {
    this.initReteManagersIfNeeded();

    if (this.props.programDataRate !== prevProps.programDataRate) {
      this.setDataRate(this.props.programDataRate);
    }

    // We need to update an observable that the getObjectBoundingBox
    // can watch. This is because the location of the blocks changes
    // when the reteManager changes and when the recording mode changes.
    // If the playbackReteManager has just been created its elements
    // won't be setup yet so we need to wait for that to finish before
    // the boundingBoxes are re computed.
    const reteManager = this.playbackReteManager || this.reteManager;
    reteManager?.setupComplete.then(() =>
      runInAction(() => this.updateObservable.updateCount++)
    );
  }

  private initReteManagersIfNeeded() {
    if (!this.reteManager && this.toolDiv) {
      this.initProgram();
    }

    if (!this.playbackReteManager && this.playbackToolDiv) {
      const contentSnapshot = getSnapshot(this.props.tileContent);
      const contentCopy = DataflowContentModel.create(contentSnapshot);
      this.playbackReteManager = new ReteManager(
        contentCopy.program, this.tileId, this.playbackToolDiv, contentCopy, this.stores,
        true, true
      );

      // When we first show the playbackToolDiv after finishing recording it would show
      // the last nodeValues and recent values if we don't do anything.
      // However the playback slider and the time display will be showing the start of the
      // recording (00:00)
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
      this.toolDiv, this.props.tileContent, this.stores, this.props.readOnly, false);

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

  private shouldShowProgramCover() {
    return this.props.readOnly || this.inDisabledRecordingState;
  }

  //disable the right side when recordingMode in stop or clear
  private get inDisabledRecordingState() {
    const programMode = this.determineProgramMode();
    return ( programMode === ProgramMode.Recording || programMode === ProgramMode.Done);
  }

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

  private playbackNodesWithCaseData(dataSet: IDataSet, playBackIndex: number) {
    if (!this.playbackReteManager) return;
    this.playbackReteManager.mstContent.program.playbackNodesWithCaseData(dataSet, playBackIndex);
  }

  private tick = () => {
    const { readOnly, tileContent: tileModel } = this.props;
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
        reteManager.tickAndProcessNodes();
        break;
      case ProgramMode.Recording:
        reteManager.tickAndProcessNodes();
        if (!readOnly) {
          recordCase(this.props.tileContent, recordIndex);
        }
        this.incrementRecordIndex();
        break;
      case ProgramMode.Done:
        if (isPlaying) {
          this.playbackNodesWithCaseData(dataSet, playBackIndex);
          this.incrementPlayBackIndex();
        }
        break;
    }
    reteManager.updateSharedProgramData();
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

  private incrementRecordIndex = () => {
    const { tileContent } = this.props;
    const newRecordIndex = this.state.recordIndex + 1;
    if (newRecordIndex >= tileContent.maxRecordableCases) {
      this.stopRecording();
    } else {
      this.setState({recordIndex: newRecordIndex});
    }
  };

}
