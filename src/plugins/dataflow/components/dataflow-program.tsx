import React from "react";
import { observable, runInAction } from "mobx";
import { getSnapshot } from "mobx-state-tree";
import { inject, observer } from "mobx-react";
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
import { ProgramMode } from "./types/dataflow-tile-types";
import { IDataSet } from "../../../models/data/data-set";
import { ObjectBoundingBox } from "../../../models/annotations/clue-object";

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

export interface IDataflowProgramApi {
  getObjectBoundingBox: (objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
}

interface IProps {
  documentProperties?: { [key: string]: string };
  tileId?: string;
  program?: DataflowProgramModelType;
  programDataRate: number;
  readOnly?: boolean;
  tileHeight?: number;
  tileContent: DataflowContentModelType;
  tileElt: HTMLElement | null;
  onRegisterTileApi: ITileProps["onRegisterTileApi"];
  onReteManagerCreated?: (reteManager: ReteManager | undefined) => void;
  onProgramContainerRef?: (el: HTMLElement | null) => void;
  onProgramApiRef?: (api: IDataflowProgramApi | null) => void;
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
  private programContainerEl: HTMLElement | null = null;
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
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showZoomControl = !documentProperties?.dfHasData;
    const disableToolBarModes = programMode === ProgramMode.Recording || programMode === ProgramMode.Done;
    const showProgramToolbar = showZoomControl && !disableToolBarModes;

    // The palette must be a sibling of content (not a descendant) so the focus
    // trap can treat it as its own single-tab-stop slot without nested-slot
    // patches; `.dataflow-program-body` holds them as flex siblings.
    return (
      <div
        className="dataflow-program-container"
        ref={el => {
          this.programContainerEl = el;
          this.props.onProgramContainerRef?.(el);
        }}
      >
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
        <div className="dataflow-program-body">
          <div className="dataflow-program-content">
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
            <div
              aria-live="polite"
              className="visually-hidden"
              data-testid="dataflow-announcer"
            >
              {this.reteManager?.announcement.value ?? ""}
            </div>
          </div>
          { showProgramToolbar && <DataflowProgramToolbar
            disabled={!!readOnly}
            isTesting={isTesting}
            onClearClick={this.clearProgram}
            onNodeCreateClick={this.addNode}
            tileId={this.tileId}
          /> }
        </div>
      </div>
    );
  }

  // Routes ArrowKey / Escape / Tab to the rete manager's connection-mode state machine.
  // Registered as a document capture-phase listener (rather than a React onKeyDown
  // on the program container) because the focus trap's own document capture-phase
  // listener handles Escape by exiting the trap (which refocuses the tile
  // container) — that would override our refocus to the source socket. Children
  // mount before parents, so this listener is registered before the trap's (which
  // lives on the parent TileComponent) and fires first in capture order. We use
  // `stopImmediatePropagation` for Escape because the trap controller's listener
  // is a sibling document-capture listener; plain `stopPropagation` would not
  // prevent it from also seeing the event.
  //
  // Follow-up: this listener predates the `escapeHandlers` API added to
  // @concord-consortium/accessibility-tools during CLUE-453. Once that
  // API is broadly adopted, dataflow should register an `escapeHandler`
  // on its tile slot rather than installing a sibling document-level
  // listener. The handler approach is correct by construction (no
  // stopPropagation/stopImmediatePropagation foot-gun) and slot-scoped
  // rather than document-global.
  private handleConnectingKeyDown = (e: KeyboardEvent) => {
    const reteManager = this.reteManager;
    if (!reteManager?.isConnecting) return;

    // Only intercept when the keydown originates inside this tile's program
    // container. Otherwise — e.g. the user mouse-clicked outside the tile while
    // connecting mode was still active — the document-level capture would
    // hijack Arrow/Escape from elsewhere on the page. Cancel the in-flight
    // connection and bail so subsequent keys aren't trapped either.
    const container = this.programContainerEl;
    const target = e.target as Node | null;
    if (!container || !target || !container.contains(target)) {
      reteManager.cancelConnecting();
      return;
    }

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        reteManager.moveConnectingCandidate(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        reteManager.moveConnectingCandidate(-1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopImmediatePropagation();
        reteManager.cancelConnecting();
        break;
      case "Tab":
        // Cancel and let Tab proceed so the trap controller can move focus on.
        reteManager.cancelConnecting();
        break;
    }
  };

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

    this.props.onProgramApiRef?.({ getObjectBoundingBox: this.getObjectBoundingBox });

    document.addEventListener("keydown", this.handleConnectingKeyDown, true);
  }

  public componentWillUnmount() {
    document.removeEventListener("keydown", this.handleConnectingKeyDown, true);
    clearInterval(this.intervalHandle);
    this.reteManager?.dispose();
    this.reteManager = undefined;
    this.playbackReteManager?.dispose();
    this.playbackReteManager = undefined;
    this.props.onReteManagerCreated?.(undefined);
    this.props.onProgramApiRef?.(null);
  }

  public getObjectBoundingBox = (objectId: string, _objectType?: string): ObjectBoundingBox | undefined => {
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
  };

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
    this.props.onReteManagerCreated?.(reteManager);
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
