import React from "react";
import { isAlive } from "mobx-state-tree";
import { observable, runInAction } from "mobx";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import { DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";

import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowGroupsOverlay } from "./ui/dataflow-groups-overlay";
import { ProgramDataRates } from "../model/utilities/node";
import { DocumentContextReact } from "../../../components/document/document-context";
import { ITileProps } from "../../../components/tiles/tile-component";
import { ObjectBoundingBox } from "../../../models/annotations/clue-object";

import { recordCase } from "../model/utilities/recording-utilities";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { ReteManager } from "../rete/rete-manager";
import { DeviceChoice, getDeviceConnection } from "../model/device-connection";
import {
  connectDeviceForTile, disconnectDeviceForTile, reconnectDeviceForTile
} from "../utilities/device-actions";

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
  tileId?: string;
  program?: DataflowProgramModelType;
  programDataRate: number;
  // Not read from ReadOnlyContext: this class already claims contextType for
  // DocumentContextReact, and readOnly is needed outside render (componentDidMount,
  // setDataRate, tick) where a Consumer would not reach.
  readOnly?: boolean;
  tileHeight?: number;
  tileContent: DataflowContentModelType;
  tileElt: HTMLElement | null;
  onRegisterTileApi: ITileProps["onRegisterTileApi"];
  onReteManagerRef?: (reteManager: ReteManager | undefined) => void;
  onProgramContainerRef?: (el: HTMLElement | null) => void;
  onProgramApiRef?: (api: IDataflowProgramApi | null) => void;
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
}

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private toolDiv: HTMLElement | null;
  private intervalHandle?: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private reteManager: ReteManager | undefined;
  private programContainerEl: HTMLElement | null = null;
  private updateObservable = observable({updateCount: 0});
  private disposeChannelSource: (() => void) | undefined;

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

  private get deviceConnection() {
    return getDeviceConnection(this.stores.serialDevice);
  }

  private handleConnectDevice = (choice: DeviceChoice) => {
    connectDeviceForTile({
      connection: this.deviceConnection, content: this.props.tileContent, tileId: this.tileId, choice
    });
  };

  private handleReconnectDevice = () => {
    reconnectDeviceForTile({
      connection: this.deviceConnection, content: this.props.tileContent, tileId: this.tileId
    });
  };

  private handleDisconnectDevice = () => {
    disconnectDeviceForTile({
      connection: this.deviceConnection, content: this.props.tileContent, tileId: this.tileId
    });
  };

  public render() {
    const { tileContent, programDataRate } = this.props;
    const isRecording = tileContent.isRecording;

    const editorClassForDisplayState = "full";
    const editorClass = `editor ${editorClassForDisplayState}`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showProgramToolbar = !isRecording;

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
          onConnectDevice={this.handleConnectDevice}
          onReconnectDevice={this.handleReconnectDevice}
          onDisconnectDevice={this.handleDisconnectDevice}
          connection={this.deviceConnection}
          programDataRates={ProgramDataRates}
          dataRate={programDataRate}
          onRateSelectClick={this.handleRateSelectClick}
          showRateUI={showRateUI}
          lastIntervalDuration={this.state.lastIntervalDuration}
          serialDevice={this.stores.serialDevice}
          tileContent={tileContent}
        />
        <div className="dataflow-program-body">
          <div className="dataflow-program-content">
            <DataflowDropZone
              addNode={this.addNode}
              className="editor-graph-container"
              reteManager={this.reteManager}
              style={this.getEditorStyle}
              tileId={this.tileId}
            >
              <div
                className={editorClass}
              >
                <div
                  className="flow-tool"
                  ref={elt => this.toolDiv = elt}
                />
                { this.reteManager &&
                  <DataflowGroupsOverlay reteManager={this.reteManager} /> }
                { this.shouldShowProgramCover() &&
                  <DataflowProgramCover editorClass={editorClassForDisplayState} /> }
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

  public componentDidMount() {
    this.initReteManagersIfNeeded();

    // Auto-fit content if in read-only mode.
    if (this.props.readOnly && this.reteManager) {
      this.reteManager.setupComplete.then(() => this.reteManager?.fitContent());
    }

    this.props.onProgramApiRef?.({ getObjectBoundingBox: this.getObjectBoundingBox });

    document.addEventListener("keydown", this.handleConnectingKeyDown, true);

    if (!this.props.readOnly) {
      this.disposeChannelSource = this.stores.serialDevice.registerChannelSource(
        () => this.props.tileContent.channels
      );
    }
  }

  public componentWillUnmount() {
    this.disposeChannelSource?.();
    this.disposeChannelSource = undefined;
    document.removeEventListener("keydown", this.handleConnectingKeyDown, true);
    clearInterval(this.intervalHandle);
    // isRecording is volatile on the content model, which outlives this component: without this a
    // run left by navigating away strands the tile with its cover up and its toolbar busy. The
    // read-only guard matters because a read-only view of the same document also mounts this
    // component, and its unmount must not stop the live run.
    if (!this.props.readOnly && isAlive(this.props.tileContent)) this.props.tileContent.stopRecording();
    this.reteManager?.dispose();
    this.reteManager = undefined;
    this.props.onReteManagerRef?.(undefined);
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

    // Observe the updateCount so every time the component is updated
    // we recompute the bounding boxes. This is mainly important so changes
    // to the recording state are taken into account.
    // Read this, and the canvas transform, before the bail-out below: returning without
    // touching an observable registers no dependency, so nothing can ever re-run this.
    // A box that is only momentarily unavailable — the manager's nodeViews are still being
    // populated — would then stay missing for good, taking its annotation with it.
    // eslint-disable-next-line unused-imports/no-unused-vars -- need to observe
    const {updateCount} = this.updateObservable;

    // Observe program canvas changes like translation and zooming.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const {dx, dy, scale: programScale} = this.props.tileContent.liveProgramZoom;

    const nodeModel = this.props.program?.nodes.get(objectId);

    const reteManager = this.reteManager;
    const nodeView = reteManager?.area.nodeViews.get(objectId);
    const { tileElt } = this.props;
    if (!nodeModel || !nodeView || !tileElt) return undefined;

    // Observe node position changes. We use liveX and liveY so we update during
    // the drag.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const {liveX, liveY} = nodeModel;

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

    // Bump an observable that getObjectBoundingBox watches, so the bounding boxes are recomputed
    // after each update. A newly created manager's elements aren't set up yet, so wait for that
    // before recomputing.
    const reteManager = this.reteManager;
    reteManager?.setupComplete.then(() =>
      runInAction(() => this.updateObservable.updateCount++)
    );
  }

  private initReteManagersIfNeeded() {
    if (!this.reteManager && this.toolDiv) {
      this.initProgram();
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
      this.toolDiv, this.props.tileContent, this.stores, this.props.readOnly);

    this.reteManager = reteManager;
    this.props.onReteManagerRef?.(reteManager);
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
    // Only while a run is in progress. A finished recording leaves the program editable, and
    // editing it detaches the capture rather than being blocked.
    return this.props.readOnly || this.props.tileContent.isRecording;
  }

  private addNode = (nodeType: string, position?: [number, number]) => {
    this.reteManager?.createAndAddNode(nodeType, position);
  };

  private clearProgram = () => {
    this.reteManager?.editor.clear();
  };

  private tick = () => {
    const { readOnly, tileContent } = this.props;
    const { reteManager } = this;

    if (!reteManager) return;

    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    reteManager.tickAndProcessNodes();
    if (tileContent.isRecording && !readOnly) {
      // Checked before appending, not after: Record stays available once a run hits the cap, and
      // appending first would let every further click push the dataset one row past it.
      if (tileContent.dataSet.cases.length >= tileContent.maxRecordableCases) {
        tileContent.stopRecording();
      } else {
        recordCase(tileContent);
      }
    }
    reteManager.updateSharedProgramData();
  };
}
